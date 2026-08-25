# GP Work Tracking Pilot

สถานะ: เริ่มพัฒนา

## เป้าหมาย
สร้างแกนติดตามงานสำหรับการทดลองใช้ภายในองค์กรก่อน โดยไม่รอ Tavily และไม่กระทบเมนู AI ทั่วไปเดิม

## ขอบเขต MVP ระยะแรก
- โครงข้อมูล Organization / Project / Task / Status / Progress / Budget
- รองรับ `organization_id` ตั้งแต่ต้น เพื่อพร้อมขยายเป็น multi-tenant ภายหลัง
- Dashboard ภาพรวมงานแบบไม่พึ่ง LLM
- กติกาสถานะสี เขียว/เหลือง/แดง จากข้อมูลจริง
- Pilot แรก: โครงการก่อสร้างกองช่าง
- Audit trail เป็น requirement ตั้งแต่ต้น แต่ยังไม่เปิด persistence จริงจนกว่าจะเลือก backend/database

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

## ลำดับงาน
1. สำรวจโครงสร้าง V6/V7 ปัจจุบัน
2. เพิ่ม Work Tracking domain model แบบ deterministic
3. เพิ่ม unit tests
4. ต่อหน้า pilot dashboard โดยไม่เพิ่มความรกหน้าแรก
5. ทดสอบกับข้อมูลจำลองกองช่าง
6. ค่อยเลือก backend/database สำหรับ persistence จริง
