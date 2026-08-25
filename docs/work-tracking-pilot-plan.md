# GP Work Tracking Pilot

สถานะ: Sprint 1 เสร็จระดับ Prototype — Core + Dashboard + CSV Preview ผ่าน CI

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
- [x] หน้า `work-tracking-pilot.html` แบบ responsive โดยไม่เพิ่มเมนูบนหน้า GP หลัก
- [x] Priority queue สำหรับงานที่ควรติดตามก่อน
- [x] CSV import core ทำงานฝั่ง client และบังคับ `organizationId` จากระบบ ไม่เชื่อค่าจากไฟล์ผู้ใช้
- [x] CSV Preview เชื่อมเข้าหน้า Pilot: เลือกไฟล์ → อ่านใน Browser → สร้าง Dashboard โดยยังไม่ส่งข้อมูลขึ้น Server
- [x] ไฟล์ CSV ตัวอย่างสำหรับให้เจ้าหน้าที่จัดรูปแบบข้อมูล
- [x] Unit/static tests ครอบคลุม risk, tenant isolation, dashboard/filter, CSV import และขอบเขตหน้า Pilot
- [x] GitHub Actions ผ่านบน branch pilot

## งานถัดไป — Sprint 2
1. เพิ่ม Data Quality Gate ก่อนรับข้อมูล: วันที่ผิดรูปแบบ ตัวเลขผิดปกติ ร้อยละเกินช่วง ข้อมูลซ้ำ และรายการที่ขาดข้อมูลสำคัญ
2. ทำ Import Preview แบบแสดงแถวผ่าน/ไม่ผ่านก่อนยืนยัน
3. สร้าง schema สำหรับ Organization / User / Role / Project / Task / Audit Event
4. ประเมินและเลือก backend/database สำหรับ persistence จริงตาม Issue #20
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
