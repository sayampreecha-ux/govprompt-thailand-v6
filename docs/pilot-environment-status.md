# GP Work Tracking — Pilot Environment Status

วันที่ตรวจล่าสุด: 2026-08-26

## Supabase Pilot
- Project ref: `bswokqqhfuvmsomzulyl`
- Region: `ap-northeast-2`
- ก่อนเริ่ม Work Tracking ไม่มี public business tables และไม่มี migration history

## Migrations ที่ apply แล้วใน environment จริง
1. `work_tracking_pilot`
2. `project_progress_rpc`
3. `task_rpc`
4. `harden_direct_mutations`
5. `create_rpcs`
6. `assignment_hardening`
7. `import_commit_rpc`
8. `security_cleanup`
9. `rls_performance`

## Live verification ที่ผ่านแล้ว
- RLS เปิดบน `organizations`, `departments`, `organization_memberships`, `projects`, `tasks`, `import_batches`, `audit_events`
- `anon` ไม่มี SELECT บน business tables
- `authenticated` มี SELECT ตาม RLS แต่ไม่มี direct INSERT/UPDATE/DELETE บน `projects` / `tasks`
- mutation ใช้ reviewed RPC path
- event-trigger helper `public.rls_auto_enable()` ถูก revoke EXECUTE จาก public/anon/authenticated แล้ว
- Performance Advisor: ปัญหา `auth_rls_initplan` และ unindexed foreign keys ถูกแก้ด้วย migration 009
- Security Advisor: เหลือคำเตือน SECURITY DEFINER สำหรับ reviewed Work Tracking RPCs ซึ่งเป็น intentional design และทุก RPC ตรวจ `auth.uid()` + membership/role ภายใน function

## Auth / RLS Integration Gate
ปัจจุบัน `auth.users` ยังไม่มีบัญชี Pilot จึงยังไม่สามารถทำ end-to-end test ด้วย JWT จริงสำหรับ ORG-A / ORG-B / ทุก Role ได้

โค้ดหน้า `work-login-pilot.html` และ `src/work-tracking/supabase-browser.mjs` เตรียม Supabase Auth แล้ว โดยใช้ publishable browser key เท่านั้น ไม่มี service-role/secret key ใน client

เมื่อมีบัญชี Pilot แรก:
1. สร้าง Organization + Department ทดสอบ
2. กำหนด Membership ให้บัญชี
3. สร้างชุด ORG-A / ORG-B และ role matrix
4. ทดสอบ SELECT/RPC ผ่าน session จริง
5. ยืนยัน tenant isolation, department scope, assigned-owner scope
6. ทดสอบ optimistic concurrency + atomic audit
7. จึงเชื่อม Dashboard/Command Center กับข้อมูลฐานจริง

## Data Gate
ยังไม่ใช้ข้อมูลราชการจริงจนกว่า Auth/RLS integration gate + export/backup/restore gate จะผ่าน
