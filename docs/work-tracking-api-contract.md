# GP Work Tracking — Backend API Contract (Pilot Draft)

เป้าหมาย: กำหนด contract ก่อนเลือก framework/database เพื่อให้ security boundary ไม่ผูกกับ Frontend

## Authentication context
Backend ต้อง resolve จาก session/token เท่านั้น:
- user_id
- organization_id
- membership role
- department_id (ถ้ามี)
- active status

ห้ามเชื่อ `organization_id`, `role` หรือ `department_id` ที่ browser ส่งมาเพื่อกำหนดสิทธิ

## Read APIs

### GET /api/work/dashboard
Query: status, risk, q, department (เฉพาะ role ที่อนุญาต)

Backend:
1. resolve membership
2. authorize DASHBOARD_READ
3. scope query ด้วย organization_id จาก session
4. apply department scope ตาม role
5. return aggregate + rows ที่มีสิทธิเท่านั้น

### GET /api/work/projects/:id
- tenant scope บังคับใน query เอง
- ไม่ query ด้วย id อย่างเดียวแล้วค่อยตรวจภายหลัง

## Mutation APIs

### POST /api/work/projects
- authorize PROJECT_CREATE
- organization_id / created_by มาจาก session
- validate data quality
- transaction: project insert + audit event

### PATCH /api/work/projects/:id
- load record ภายใน tenant scope
- authorize PROJECT_UPDATE โดยใช้ department_id / owner_user_id ของ record เดิม
- field allowlist; ห้ามเปลี่ยน id / organization_id / department_id ผ่าน generic patch
- validate data quality หลัง merge
- transaction: update + audit event

### POST /api/work/import/preview
Phase Pilot อาจ parse client-side ได้ แต่ production endpoint ต้องรองรับ validation ซ้ำ
- organization context จาก session
- ไม่ persist business rows
- return row status VALID/WARNING/ERROR

### POST /api/work/import/commit
Input: import_batch_id + explicit confirmation
- authorize IMPORT_COMMIT
- re-validate batch server-side
- reject if batch has ERROR
- warnings require confirmed=true
- transaction all-or-nothing หรือ chunked transaction ที่มี checkpoint ชัดเจน
- write audit event with count, ไม่ฝัง raw CSV ลง audit metadata

## Audit APIs

### GET /api/work/audit
- authorize AUDIT_READ
- tenant scoped
- pagination required
- filter entity_type/entity_id/date range
- immutable from application UI

## Error contract
ใช้ machine-readable code เช่น:
- AUTH_REQUIRED
- MEMBERSHIP_INACTIVE
- TENANT_MISMATCH
- ROLE_FORBIDDEN
- DEPARTMENT_MISMATCH
- NOT_ASSIGNED_OWNER
- NOT_FOUND
- DATA_QUALITY_BLOCKED
- IMPORT_HAS_ERRORS
- WARNING_CONFIRMATION_REQUIRED
- CONFLICT_VERSION

อย่าส่งรายละเอียดภายในของ DB/stack trace ให้ client

## Concurrency
Project/Task production schema ควรมี `version` หรือ `updated_at` สำหรับ optimistic concurrency:
- client ส่ง expected version
- ถ้ามีผู้แก้ก่อนหน้า → 409 CONFLICT_VERSION
- ห้าม silent overwrite

## Transaction boundary
Mutation สำคัญต้องบันทึก business change และ audit event ใน transaction เดียวกัน เพื่อไม่เกิด “ข้อมูลเปลี่ยนแต่ไม่มีประวัติ”

## File attachments
- upload ผ่าน private object storage
- server ตรวจ membership + entity tenant ก่อนออก upload/download URL
- validate MIME/size
- random storage key; ไม่ใช้ filename เป็น path หลัก

## AI boundary
AI endpoint (ภายหลัง) รับเฉพาะข้อมูลที่ user มีสิทธิอ่านและผ่าน data-minimization แล้ว
AI ไม่มี direct database credential สำหรับ mutation และไม่เรียก approve/close/accept งานเอง
