# GP Work Tracking Pilot

สถานะ: Sprint 2 — Prototype + Security Core + Supabase Pilot migrations พร้อมเข้าสู่ environment test

## เป้าหมาย
สร้าง Work Tracking / Command Center สำหรับทดลองใช้ภายในองค์กรก่อน โดยไม่รอ Tavily และไม่กระทบเมนู AI ทั่วไปเดิม

## ทำเสร็จแล้ว — Sprint 1
- [x] Work Tracking deterministic Project model + Risk scoring เขียว/เหลือง/แดง
- [x] Dashboard ก่อสร้าง responsive + search/filter + priority queue
- [x] CSV import/preview ฝั่ง Browser โดยยังไม่ส่งข้อมูลขึ้น Server
- [x] Construction CSV template + tenant injection จากระบบ
- [x] Organization scoping แบบ fail closed

## ทำเสร็จแล้ว — Sprint 2 Core
- [x] Data Quality Gate แยก ERROR / WARNING / VALID
- [x] Row-level CSV Preview พร้อมเลขแถวต้นทาง + commit gate
- [x] หน้า `work-tracking-import-preview.html` สำหรับตรวจไฟล์ก่อนนำเข้า
- [x] Role model: ORG_ADMIN / EXECUTIVE / DIRECTOR / OFFICER / AUDITOR
- [x] Tenant / Department / Assigned-owner authorization core
- [x] แยก Project Assignment และ Task Assignment ออกจาก generic update เพื่อกัน privilege escalation
- [x] Privacy-safe Audit Event core แบบ metadata allowlist
- [x] Project service + Task service: authorize → field allowlist → quality gate → audit event
- [x] Task model + urgency scoring + task priority queue
- [x] Command Center aggregator รวม Project risk + Task urgency
- [x] หน้า `work-command-center-pilot.html` สำหรับผู้บริหารจากข้อมูลจำลอง
- [x] Session/Membership resolver แบบ fail closed
- [x] Data model + Backend API contract

## Backend Pilot
ADR-001 เลือก **Supabase (Postgres + Auth + RLS)** เป็นตัวเลือกแรกสำหรับ Pilot; Cloudflare D1 เป็น fallback

ทำแล้ว:
- [x] Schema: organizations / departments / organization_memberships / projects / tasks / import_batches / audit_events
- [x] RLS ทุก business table + minimum grants
- [x] Harden mutation boundary: Browser อ่านผ่าน RLS แต่ไม่ mutate Project/Task โดยตรง
- [x] Atomic Project progress RPC: auth → membership/role → optimistic concurrency → update + audit
- [x] Atomic Task update / Task assignment RPC
- [x] Audited Project create / Task create RPC
- [x] Static security tests ป้องกัน RLS, grant และ RPC regression
- [x] Supabase row/domain adapter + RPC argument mapping

## งานถัดไป — Environment / Integration Gate
1. Provision Supabase Pilot project แยกจาก Production
2. Apply migrations ใน environment จริง
3. สร้างข้อมูลทดสอบ ORG-A / ORG-B + Role ทุกแบบ
4. Integration test ยืนยัน ORG-A ไม่มี path อ่าน/แก้ ORG-B
5. ทดสอบ Director scope / Officer owner scope / Executive & Auditor read-only
6. ทดสอบ atomic mutation + audit และ optimistic concurrency
7. เชื่อม Login + Membership resolver กับ Pilot UI
8. ต่อ Dashboard Read จากฐานจริง แล้วค่อยเปิด Project/Task mutation UI
9. ทำ Export + Backup/Restore test ก่อนใช้ข้อมูลจริง
10. ใช้ข้อมูลจริงกองช่างแบบจำกัดหลัง Security Gate ผ่าน

## หลัง Pilot กองช่าง
- Template รพ.สต.
- Asset + Solar/ไฟสาธารณะ
- ถนน/งานซ่อม
- SLA
- Citizen Report
- GIS
- AI Executive Summary/ถามข้อมูลด้วยภาษาธรรมชาติ โดย AI เป็น read/analyze/draft ไม่ใช่ผู้อนุมัติ

## ยังแยกจาก Work Tracking
- Tavily / official web search integration เป็นงานอีกเส้นหนึ่ง ไม่บล็อก Pilot นี้

## หลักบังคับ
1. ระบบ GP เดิมต้องยังใช้งานได้เหมือนเดิม
2. Dashboard/ตัวเลขคำนวณด้วย Code/Database ก่อนเรียก AI
3. AI วิเคราะห์/สรุป/ร่าง แต่ไม่ approve/close/accept งานเอง
4. `organization_id` + membership ต้องถูกบังคับที่ backend/database ไม่ใช่ Frontend
5. สิทธิและ audit log เป็น baseline security ไม่ใช่ premium feature
6. Import ต้อง Preview + Quality Gate + Human confirmation + server-side revalidation
7. Mutation สำคัญต้องบันทึก business change + audit แบบ atomic
8. ห้ามมี service/secret key ใน Browser
9. ข้อมูลจริงยังไม่เข้าระบบจน Supabase environment + RLS integration test + backup/export gate ผ่าน
