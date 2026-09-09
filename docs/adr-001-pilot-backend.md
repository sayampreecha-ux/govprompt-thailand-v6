# ADR-001: Pilot Backend / Database

สถานะ: **Pilot decision — เลือก Supabase เป็นตัวเลือกแรกสำหรับการทดลองภายในองค์กร**

วันที่ตัดสินใจ: 2026-08-26

## Context
GP Work Tracking ต้องการฐานข้อมูลเชิงสัมพันธ์, auth, role/membership, tenant isolation, audit trail, import transaction, attachment storage และทางออก export/backup โดย Pilot ต้องทำได้เร็วแต่ไม่แลกความปลอดภัยของข้อมูลข้ามองค์กร

## ตัวเลือกที่ประเมิน

### 1. Supabase (Postgres + Auth + RLS) — เลือกสำหรับ Pilot
เหตุผล:
- Postgres เหมาะกับ Project/Task/Membership/Audit ที่มีความสัมพันธ์ชัด
- Row Level Security (RLS) บังคับสิทธิระดับแถวในฐานข้อมูลได้ ไม่พึ่งการซ่อนข้อมูลใน Frontend
- Auth ใช้ JWT และเชื่อมกับ RLS ได้
- สามารถใช้ Data API หรือวาง Edge Function/server logic คั่นกลางได้
- Storage สามารถผูก access policy ได้
- SQL/CSV export และ portability ดีกับข้อมูลราชการเชิงตาราง

เงื่อนไขก่อน Production:
- ตรวจ region/data residency ที่เลือกใช้จริง
- ตรวจ DPA/terms/security/compliance ที่หน่วยงานต้องการ
- ทดสอบ RLS policy ด้วย automated tests
- service/secret key ห้ามอยู่ใน Browser
- กำหนด backup/restore/export และ offboarding ให้ชัด

### 2. Cloudflare Workers + D1 — ตัวเลือกสำรองที่น่าสนใจ
ข้อดี:
- architecture เบาและเหมาะกับ Worker API
- D1 รองรับ foreign keys, prepared statements, batch transaction และ import/export
- ค่าใช้จ่ายเหมาะกับ workload ที่ไม่หนักมาก

ข้อควรระวังสำหรับ GP:
- tenant/role policy ต้องบังคับใน Worker/API query ทุกจุด; ไม่มี Postgres RLS layer แบบที่เราออกแบบไว้
- security correctness จึงพึ่ง application layer มากขึ้น
- ต้องประกอบ auth/membership/storage เพิ่มเองมากกว่า

เหมาะเป็นตัวเลือกถ้า GP ต้องการ consolidate บน Cloudflare และทีมพร้อมรับภาระ authorization testing มากขึ้น

### 3. Firebase / Firestore — ไม่เลือกเป็นแกนแรก
ข้อดี: realtime/client SDK และ Security Rules แข็งแรงเมื่อออกแบบถูก

ข้อจำกัดสำหรับกรณี GP:
- domain ปัจจุบันเป็น relational มาก: organization → membership → department → project → task → audit
- query/reporting/dashboard และ export แบบราชการเข้ากับ SQL ได้ตรงกว่า
- Firebase multi-tenancy ระดับ Identity Platform มีข้อกำหนดเพิ่ม และ server SDK มี security model คนละชั้นกับ client rules

## Decision
ใช้ **Supabase เป็น Pilot backend candidate** สำหรับกองช่าง โดยยังไม่ผูก Production policy ถาวร

Architecture ที่ตั้งใจ:
Browser GP → Supabase Auth → backend/Edge Function หรือ Data API ที่มี RLS → Postgres

สำหรับ mutation สำคัญให้ใช้ server-side function/API เพื่อทำ:
1. resolve membership
2. authorize role/tenant
3. validate data quality
4. transaction business change
5. append audit event

Read-only dashboard บางส่วนสามารถใช้ RLS-protected query/view ที่ทดสอบแล้วได้

## Pilot Exit Criteria
ก่อนถือว่า backend ผ่าน ต้องพิสูจน์อย่างน้อย:
- ORG-A อ่าน/แก้ ORG-B ไม่ได้ทุก path ที่ทดสอบ
- Officer แก้เฉพาะงานที่ได้รับมอบหมายตาม policy
- Director จำกัดกอง, Executive read-only ตาม policy
- import ที่ error เขียน DB ไม่ได้
- update + audit เป็น atomic operation
- export tenant data ทำได้
- backup/restore ทดสอบได้
- ไม่มี secret/service key ใน client bundle

## Sources checked
- Supabase Auth / Row Level Security / API security official documentation
- Cloudflare D1 Database / API proxy / import-export official documentation
- Firebase Security Rules / tenancy official documentation

การเลือก Production ต้องตรวจเอกสารผู้ให้บริการฉบับล่าสุดอีกครั้งก่อนใช้งานจริง
