# GP Work Tracking Pilot

สถานะ: Sprint 2 กำลังพัฒนา — Data Quality + Access Control + Audit Core + Data Model

## เป้าหมาย
สร้างแกนติดตามงานสำหรับการทดลองใช้ภายในองค์กรก่อน โดยไม่รอ Tavily และไม่กระทบเมนู AI ทั่วไปเดิม

## ขอบเขต MVP ระยะแรก
- โครงข้อมูล Organization / Project / Task / Status / Progress / Budget
- รองรับ `organization_id` ตั้งแต่ต้น เพื่อพร้อมขยายเป็น multi-tenant ภายหลัง
- Dashboard ภาพรวมงานแบบไม่พึ่ง LLM
- กติกาสถานะสี เขียว/เหลือง/แดง จากข้อมูลจริง
- Pilot แรก: โครงการก่อสร้างกองช่าง
- Audit trail เป็น requirement ตั้งแต่ต้น แต่ยังไม่เปิด persistence จริงจนกว่าจะเลือก backend/database

## ทำเสร็จแล้ว — Sprint 1
- [x] Work Tracking domain model แบบ deterministic
- [x] Project fields สำหรับงานก่อสร้าง: พื้นที่ เลขสัญญา ผู้รับจ้าง งบประมาณ แผน/ผลจริง กำหนดเสร็จ ปัญหา
- [x] Risk scoring เขียว/เหลือง/แดง โดยใช้ progress variance, deadline, blocked status และ stale update
- [x] Organization scoping: ถ้าไม่มี `organizationId` จะไม่คืนข้อมูล เพื่อป้องกันการเห็นข้อมูลข้ามองค์กรโดยพลาด
- [x] Dashboard view model + search/filter ตามสถานะและความเสี่ยง
- [x] หน้า `work-tracking-pilot.html` แบบ responsive โดยไม่เพิ่มเมนูบนหน้า GP หลัก
- [x] Priority queue สำหรับงานที่ควรติดตามก่อน
- [x] CSV import core ทำงานฝั่ง client และบังคับ `organizationId` จากระบบ ไม่เชื่อค่าจากไฟล์ผู้ใช้
- [x] CSV Preview เชื่อมเข้าหน้า Pilot: เลือกไฟล์ → อ่านใน Browser → สร้าง Dashboard โดยยังไม่ส่งข้อมูลขึ้น Server
- [x] ไฟล์ CSV ตัวอย่างสำหรับให้เจ้าหน้าที่จัดรูปแบบข้อมูล
- [x] Unit/static tests ครอบคลุม risk, tenant isolation, dashboard/filter, CSV import และขอบเขตหน้า Pilot

## ทำแล้ว — Sprint 2
- [x] Data Quality Gate: ชื่อ/หน่วยงาน/ผู้รับผิดชอบ/งบประมาณ/วันที่/สถานะ/ความก้าวหน้า/ข้อมูลซ้ำ
- [x] Batch validation แยก ERROR กับ WARNING และกันรายการ error ออกจาก valid batch
- [x] Role model: ORG_ADMIN / EXECUTIVE / DIRECTOR / OFFICER / AUDITOR
- [x] Access-control core แบบ fail closed: tenant mismatch ปฏิเสธก่อนตรวจ role
- [x] Department scope สำหรับ Director/Officer และ owner scope สำหรับการแก้ไขของ Officer
- [x] Privacy-safe Audit Event core แบบ metadata allowlist ไม่รับ raw PII โดยอัตโนมัติ
- [x] Data model สำหรับ Organization / Department / User / Membership / Project / Task / Attachment / Import Batch / Audit Event
- [x] CI เพิ่ม syntax check สำหรับ Work Tracking modules
- [x] Unit tests สำหรับ access boundary และ audit core

## งานถัดไป — Sprint 2 ต่อเนื่อง
1. เชื่อม Data Quality Gate เข้าหน้า CSV Preview ให้เห็น “ผ่าน / เตือน / ไม่ผ่าน” ก่อนใช้ข้อมูล
2. เพิ่ม row-level import result เพื่อชี้กลับไปยังบรรทัดต้นทางได้แม้รหัสโครงการว่างหรือซ้ำ
3. ออกแบบ backend contract/API สำหรับ Project / Task / Import / Audit โดย tenant มาจาก session ไม่มาจาก client
4. ประเมิน backend/database ตาม Issue #20 และเลือกทาง Pilot ที่ rollback/export ได้ง่าย
5. ทำ Login + Membership resolver + Role enforcement ฝั่ง backend/database
6. ทำ persistence เฉพาะ Pilot กองช่าง แล้วทดลองข้อมูลจริงแบบจำกัด
7. ผ่าน Pilot กองช่างแล้วค่อยเพิ่ม Template รพ.สต. / Solar / ถนน

## สิ่งที่ยังไม่ทำในระยะแรก
- Citizen Report
- GIS
- SLA เต็มรูปแบบ
- Tavily / official web search integration
- AI auto-decision
- production database migration สำหรับการเปิดใช้ทั่วไป

## หลักการ
1. ระบบเดิมต้องยังใช้งานได้เหมือนเดิม
2. Dashboard คำนวณด้วย code/database ก่อนเรียก AI
3. AI ทำหน้าที่สรุป วิเคราะห์ และร่างข้อเสนอ ไม่ตัดสินใจแทนเจ้าหน้าที่
4. ข้อมูลแต่ละองค์กรต้องแยกด้วย `organization_id`
5. สิทธิและ audit log เป็นส่วนพื้นฐาน ไม่ใช่ premium feature
6. Pilot ใช้ข้อมูลจำลองหรือข้อมูลที่ผ่านการคัดกรองก่อน จนกว่าระบบสิทธิและฐานข้อมูลจริงพร้อม
7. Client-side validation เป็น UX เท่านั้น; authorization และ tenant isolation ต้องบังคับซ้ำที่ backend/database
