# GP Work Tracking Pilot

สถานะ: Sprint 1 กำลังพัฒนา — Core + Dashboard Prototype + CSV Import Core ผ่าน CI

## เป้าหมาย
สร้างแกนติดตามงานสำหรับการทดลองใช้ภายในองค์กรก่อน โดยไม่รอ Tavily และไม่กระทบเมนู AI ทั่วไปเดิม

## ขอบเขต MVP ระยะแรก
- โครงข้อมูล Organization / Project / Task / Status / Progress / Budget
- รองรับ `organization_id` ตั้งแต่ต้น เพื่อพร้อมขยายเป็น multi-tenant ภายหลัง
- Dashboard ภาพรวมงานแบบไม่พึ่ง LLM
- กติกาสถานะสี เขียว/เหลือง/แดง จากข้อมูลจริง
- Pilot แรก: โครงการก่อสร้างกองช่าง
- Audit trail เป็น requirement ตั้งแต่ต้น แต่ยังไม่เปิด persistence จริงจนกว่าจะเลือก backend/database

## ทำเสร็จแล้วใน Sprint 1
- [x] Work Tracking domain model แบบ deterministic
- [x] Project fields สำหรับงานก่อสร้าง: พื้นที่ เลขสัญญา ผู้รับจ้าง งบประมาณ แผน/ผลจริง กำหนดเสร็จ ปัญหา
- [x] Risk scoring เขียว/เหลือง/แดง โดยใช้ progress variance, deadline, blocked status และ stale update
- [x] Organization scoping: ถ้าไม่มี `organizationId` จะไม่คืนข้อมูล เพื่อป้องกันการเห็นข้อมูลข้ามองค์กรโดยพลาด
- [x] Dashboard view model + search/filter ตามสถานะและความเสี่ยง
- [x] หน้า `work-tracking-pilot.html` แบบ responsive โดยใช้ข้อมูลจำลอง ไม่เชื่อมฐานข้อมูลจริง
- [x] Priority queue สำหรับงานที่ควรติดตามก่อน
- [x] CSV import core ทำงานในฝั่ง client และบังคับ `organizationId` จากระบบ ไม่เชื่อค่าจากไฟล์ผู้ใช้
- [x] Unit tests ครอบคลุม risk, tenant isolation, dashboard summary/filter และ CSV import
- [x] GitHub Actions ผ่านบน branch pilot

## งานถัดไป
1. ต่อ CSV import เข้าหน้า Pilot ให้เจ้าหน้าที่เลือกไฟล์และ Preview ก่อนยืนยัน
2. เพิ่ม validation/data quality เช่น วันที่ผิดรูปแบบ ตัวเลขผิดปกติ และข้อมูลซ้ำ
3. สร้าง schema สำหรับ Project / Task / Audit Event / User Role
4. เลือก backend/database สำหรับ persistence จริงตาม Issue #20
5. เพิ่ม Login + Role และบังคับ tenant isolation ที่ backend/database
6. ทดลองข้อมูลจริงแบบจำกัดในกองช่าง ก่อนขยาย รพ.สต. / Solar / ถนน

## สิ่งที่ยังไม่ทำในระยะแรก
- Citizen Report
- GIS
- SLA เต็มรูปแบบ
- Tavily / official web search integration
- AI auto-decision
- production database migration

## หลักการ
1. ระบบเดิมต้องยังใช้งานได้เหมือนเดิม
2. Dashboard คำนวณด้วย code/database ก่อนเรียก AI
3. AI ทำหน้าที่สรุป วิเคราะห์ และร่างข้อเสนอ ไม่ตัดสินใจแทนเจ้าหน้าที่
4. ข้อมูลแต่ละองค์กรต้องแยกด้วย `organization_id`
5. สิทธิและ audit log เป็นส่วนพื้นฐาน ไม่ใช่ premium feature
6. Pilot ใช้ข้อมูลจำลองหรือข้อมูลที่ผ่านการคัดกรองก่อน จนกว่าระบบสิทธิและฐานข้อมูลจริงพร้อม
