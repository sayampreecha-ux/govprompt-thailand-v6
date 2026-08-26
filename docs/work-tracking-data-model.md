# GP Work Tracking — Data & Security Model (Pilot)

## เป้าหมาย
กำหนดโครงข้อมูลกลางก่อนเลือกฐานข้อมูลจริง เพื่อให้ Pilot ใช้กับองค์กรเดียวได้ก่อน แต่ไม่ปิดทางการขยายเป็น multi-tenant ภายหลัง

## หลักบังคับ
1. ทุกตารางเชิงธุรกิจต้องมี `organization_id` และ backend/database ต้องบังคับ tenant isolation
2. การซ่อนเมนูใน Frontend ไม่ถือเป็นการควบคุมสิทธิ
3. Audit log ต้องเป็น append-only ในระบบจริง และไม่เก็บ raw PII ที่ไม่จำเป็น
4. Dashboard คำนวณจากข้อมูลที่ผู้ใช้มีสิทธิเห็นเท่านั้น
5. AI ไม่ได้รับข้อมูลส่วนบุคคล/ข้อมูลอ่อนไหวโดยอัตโนมัติ และไม่มีสิทธิเปลี่ยนสถานะราชการเอง
6. การ Import ต้องผ่าน Preview + Data Quality Gate + Human confirmation ก่อนบันทึกจริง

## Entities ขั้นต่ำ

### organizations
- id (PK)
- name
- organization_type
- province
- active
- created_at

### departments
- id (PK)
- organization_id (FK)
- name
- active

### users
- id (PK)
- display_name
- email_or_login_identifier
- active
- created_at

> ข้อมูลการยืนยันตัวตนจริงควรอยู่ใน Auth provider ไม่เก็บ password แบบ plaintext ใน application database

### organization_memberships
- id (PK)
- organization_id (FK)
- user_id (FK)
- department_id (FK, nullable สำหรับผู้บริหารระดับองค์กร)
- role: ORG_ADMIN / EXECUTIVE / DIRECTOR / OFFICER / AUDITOR
- active
- created_at
- updated_at

Unique: `(organization_id, user_id)`

### projects
- id (PK)
- organization_id (FK)
- department_id (FK)
- project_code
- project_type
- name
- owner_user_id (FK, nullable)
- location_text
- contract_no
- contractor_name
- budget_amount
- spent_amount
- planned_progress
- actual_progress
- start_date
- due_date
- status
- problem_summary
- last_updated_at
- created_by_user_id
- created_at
- updated_at

Unique ภายในองค์กร: `(organization_id, project_code)`
Index: organization_id, department_id, status, due_date, owner_user_id, contract_no

### tasks
- id (PK)
- organization_id (FK)
- project_id (FK)
- department_id (FK)
- title
- assigned_user_id (FK)
- status
- priority
- due_at
- completed_at
- created_by_user_id
- created_at
- updated_at

### attachments
- id (PK)
- organization_id (FK)
- entity_type
- entity_id
- storage_key
- original_filename
- mime_type
- size_bytes
- uploaded_by_user_id
- created_at

> เก็บ metadata ใน DB; ไฟล์จริงควรอยู่ object storage แบบ private และออก signed URL ตามสิทธิ

### import_batches
- id (PK)
- organization_id (FK)
- department_id (FK)
- filename
- total_rows
- valid_rows
- error_rows
- warning_count
- status: PREVIEW / CONFIRMED / REJECTED / COMMITTED
- created_by_user_id
- created_at
- committed_at

### audit_events
- id (PK)
- organization_id (FK)
- actor_user_id (FK)
- action
- entity_type
- entity_id
- occurred_at
- request_id
- metadata_json (allowlist only)

Index: organization_id + occurred_at, entity_type + entity_id

## Access Policy เบื้องต้น

| Role | Dashboard | Project | Task | Import | Audit | Users |
|---|---|---|---|---|---|---|
| ORG_ADMIN | ทั้งองค์กร | CRUD | CRUD | Commit | Read | Manage |
| EXECUTIVE | ทั้งองค์กร | Read | Read | Preview | Read | - |
| DIRECTOR | กองตนเอง | Create/Update | Assign/Update | Commit | Read | - |
| OFFICER | กองตนเอง | Read/Create + Update งานที่รับผิดชอบ | Create/Update งานที่รับผิดชอบ | Preview | - | - |
| AUDITOR | ทั้งองค์กรตามสิทธิตรวจสอบ | Read | Read | - | Read | - |

## Tenant Isolation — Fail Closed
- request ไม่มี organization context → ปฏิเสธ
- record.organization_id ไม่ตรง membership.organization_id → ปฏิเสธ
- API รับ organization_id จาก session/membership ไม่เชื่อค่าที่ส่งมาจาก CSV หรือ browser form
- สำหรับฐานข้อมูลที่รองรับ Row Level Security ให้มี policy จาก membership ทุกตารางธุรกิจ

## Workflow การ Import จริง
CSV/Excel → Parse ใน Browser/Backend → Preview → Data Quality Gate → ผู้ใช้แก้ไข/ยืนยัน → Backend ตรวจสิทธิซ้ำ → Transaction บันทึก Project/Task → Audit Event → Dashboard refresh

ห้ามให้ Preview เขียน production data และห้ามให้ client-side validation เป็นด่านความปลอดภัยเพียงด่านเดียว

## Backup / Export / Exit
ก่อน Production ต้องมี:
- scheduled backup + restore test
- export CSV/JSON และไฟล์แนบตามสิทธิ
- retention policy
- deletion/offboarding procedure
- tenant-level export เมื่อต้องย้ายหรือเลิกใช้บริการ

## สิ่งที่ยังไม่ตัดสินในเอกสารนี้
- ผู้ให้บริการฐานข้อมูล
- Auth provider
- Object storage
- Cloud region
- ค่าใช้จ่ายและ SLA

รายการเหล่านี้ให้ตัดสินจาก Pilot requirements + PDPA/security + deployment compatibility ก่อนผูก vendor
