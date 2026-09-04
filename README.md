# WMS Frontend

## รันบนเครื่องตัวเอง (ทดสอบก่อน Deploy)

1. `npm install`
2. คัดลอก `.env.local.example` เป็น `.env.local` แล้วใส่ค่า Supabase URL/Key ของโปรเจกต์จริง
3. `npm run dev` แล้วเปิด `http://localhost:3000`

## Deploy ขึ้น Vercel

1. Push โฟลเดอร์นี้ขึ้น GitHub repo
2. เข้า [vercel.com](https://vercel.com) → New Project → เลือก repo นี้
3. ใส่ Environment Variables ใน Vercel ให้ตรงกับ `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. กด Deploy — ได้ URL ใช้งานจริงทันที ทุกครั้งที่ push โค้ดใหม่จะ deploy ให้อัตโนมัติ

## โครงสร้างที่มีตอนนี้

- `/login` — หน้าเข้าสู่ระบบ
- `/dashboard` — รายการสต๊อกสินค้า พร้อม Stat cards, ตัวกรองแผนก/ประเภท, และปุ่มพิมพ์ QR ต่อแถว

## หน้าที่ยังไม่ได้ทำ (รอทำต่อ)

- `/pick-lists` — ใบสั่งหยิบสินค้า (เชื่อมกับ `create_pick_list_item` / `confirm_pick_list_shipment` ที่มีอยู่แล้วใน Database)
- `/import` — พอร์ตจาก `import.html` ที่ทำไว้แล้วมาเป็นหน้า React
- `/automation` — จัดการ Automation Rules (เพิ่ม/แก้/ปิดใช้งาน Rule ผ่านหน้าเว็บแทนการเขียน SQL เอง)
- `/print-tag`, `/scan` — พอร์ตจาก `print-tag.html`/`scan.html` เดิม

โครงสร้างและแพทเทิร์นการเขียน (fetch ข้อมูลจาก Supabase ตรงๆ, ไม่มี Backend Server) ใช้ซ้ำกับหน้าใหม่ได้ทั้งหมด
