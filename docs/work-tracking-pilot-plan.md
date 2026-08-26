# GP Work Tracking Pilot

สถานะ: **Pilot Candidate — Live Supabase integration + Security/Data Quality/Import/Export gates ผ่านระดับทดสอบภายใน**

## เป้าหมาย
สร้าง Work Tracking / Command Center สำหรับทดลองใช้ภายในองค์กรก่อน โดยไม่รอ Tavily และไม่กระทบเมนู AI ทั่วไปเดิม

## Pilot Core — ทำแล้ว
- [x] Deterministic Project / Task models + Risk / Urgency scoring
- [x] Dashboard ก่อสร้าง + search/filter + priority queue
- [x] Command Center รวม Project risk + Task urgency
- [x] Role model: ORG_ADMIN / EXECUTIVE / DIRECTOR / OFFICER / AUDITOR
- [x] Tenant / Department / Assigned-owner authorization แบบ fail closed
- [x] Project/Task assignment แยกจาก generic update เพื่อกัน privilege escalation
- [x] Privacy-minimal Audit Event + no-op audit guards
- [x] Session / Membership resolver

## Supabase Pilot — ทำแล้ว
ADR-001 เลือก **Supabase (Postgres + Auth + RLS)** สำหรับ Pilot

- [x] Schema: organizations / departments / organization_memberships / projects / tasks / import_batches / audit_events / pilot_invites
- [x] RLS ทุก business table + minimum grants
- [x] Browser อ่านผ่าน RLS แต่ไม่มี direct INSERT/UPDATE/DELETE บน business tables
- [x] Atomic audited RPCs: create/update/assign Project + Task
- [x] Optimistic concurrency สำหรับ mutation ที่แก้รายการเดิม
- [x] Invitation + membership claim flow
- [x] Privacy-minimal member directory
- [x] Live Dashboard / Operations / Tasks / Assignment / Members UI
- [x] Supabase migrations ถูก apply ใน Pilot environment จริง
- [x] Security audit: authenticated/anon ไม่มี CREATE บน public schema; RPC ไม่เปิด EXECUTE ให้ public/anon
- [x] Unique database constraint `(organization_id, project_code)` ป้องกัน duplicate/race ชั้นฐานข้อมูล

## CSV Import — ทำแล้ว
- [x] Local-only Preview แยกจาก Live Commit
- [x] Strict parser: ตัวเลข/ค่าติดลบ/progress/date/status ผิดถูกบล็อกก่อน normalize
- [x] รองรับ ISO date และวันที่ไทย `DD/MM/YYYY` รวม พ.ศ.
- [x] ERROR / WARNING / VALID พร้อม source row
- [x] Human confirmation + warning acknowledgement
- [x] Server-side revalidation + transactional batch commit + audit
- [x] จำกัด 500 แถว / 2 MB สำหรับ Pilot
- [x] กอง/หน่วยใน CSV ไม่ตรงกับปลายทาง = block
- [x] ชื่อผู้รับผิดชอบจาก CSV ไม่ถูกเดาเป็น user account; ต้องรับทราบและมอบหมายผ่าน Directory
- [x] Legacy `วันที่อัปเดต` ถูกเปิดเผยว่าไม่เขียนทับ server timestamp
- [x] Raw CSV และ source filename ไม่ถูกส่ง/เก็บถาวร;ฐานเก็บ generic import label
- [x] Thai UTF-8 BOM CSV template สำหรับ Excel และ publish อยู่ใต้ `/pilot/`

## Export / Exit Gate — ทำแล้ว
- [x] Audited organization logical snapshot RPC `export_work_tracking_snapshot`
- [x] Export จำกัด ORG_ADMIN / AUDITOR และตรวจ active membership + tenant ที่ Server
- [x] Snapshot รวม organization / departments / projects / tasks / import batches / audit events
- [x] ไม่รวม `auth.users`, pilot invite emails หรือ raw CSV
- [x] เก็บ opaque user IDs ที่จำเป็นต่อ referential integrity
- [x] Browser download เป็น JSON ไม่มี localStorage/sessionStorage/IndexedDB
- [x] E2E transaction test ใน Supabase จริงยืนยัน snapshot + role denial + privacy fields และ rollback test data

## Authentication — ทำแล้วใน Pilot UI
- [x] เปลี่ยน Pilot login เป็น passwordless Magic Link
- [x] Membership ยังเป็น data-access gate; มี Auth account อย่างเดียวไม่เห็นข้อมูลองค์กร
- [x] Browser ใช้เฉพาะ Supabase publishable key; ไม่มี service/secret key

## CI / Deployment
- [x] Node unit/static security suite บน GitHub Actions
- [x] Pilot Pages workflow แยก `/pilot/` และ preserve GP production root จาก `main`
- [x] Work Tracking HTML/modules/CSV template publish จาก branch Pilot เท่านั้น
- [x] Deployment assertions ป้องกันหน้า/แม่แบบสำคัญหายจาก Pages

## Operational Gate ก่อนใส่ข้อมูลจริงจำนวนมาก
- [ ] เปิด **Leaked Password Protection** ที่ Supabase project setting หากองค์กรจะเปิด password login ในอนาคต; Pilot UI ปัจจุบันเป็น passwordless และไม่มีช่องรหัสผ่าน
- [ ] ยืนยันนโยบาย managed backup / restore ของ Supabase plan และทำ restore rehearsal ก่อน Production rollout
- [ ] Visual/UAT กับผู้ใช้จริงจำนวนจำกัดก่อน merge ฟีเจอร์ใด ๆ เข้าหน้า GP หลัก

สามรายการข้างต้นเป็น operational/platform gate ไม่ใช่งานแกน Work Tracking ที่ต้องเพิ่มโค้ดใน Pilot branch

## หลัง Internal Pilot
- Template รพ.สต.
- Asset + Solar/ไฟสาธารณะ
- ถนน/งานซ่อม
- SLA
- Citizen Report
- GIS
- AI Executive Summary / natural-language query โดย AI เป็น read/analyze/draft ไม่ใช่ผู้อนุมัติ

## ยังแยกจาก Work Tracking
- Tavily / official web search integration เป็นงานอีกเส้นหนึ่ง ไม่บล็อก Pilot นี้

## หลักบังคับ
1. ระบบ GP เดิมต้องยังใช้งานได้เหมือนเดิม
2. Dashboard/ตัวเลขคำนวณด้วย Code/Database ก่อนเรียก AI
3. AI วิเคราะห์/สรุป/ร่าง แต่ไม่ approve/close/accept งานเอง
4. `organization_id` + membership ถูกบังคับที่ backend/database ไม่ใช่ Frontend
5. สิทธิและ audit log เป็น baseline security ไม่ใช่ premium feature
6. Import ต้อง Preview + Quality Gate + Human confirmation + server-side revalidation
7. Mutation สำคัญต้องบันทึก business change + audit แบบ atomic
8. ห้ามมี service/secret key ใน Browser
9. Data export ต้อง tenant-scoped, audited และไม่ดึง Auth directory/คำเชิญออกมาโดยไม่จำเป็น
