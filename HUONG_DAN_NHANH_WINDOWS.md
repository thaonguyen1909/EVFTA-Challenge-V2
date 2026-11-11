# HƯỚNG DẪN NHANH – WINDOWS & RENDER

## A. Chạy ngay trên Windows

1. Cài Node.js phiên bản 20+.
2. Giải nén file ZIP; vào thư mục chứa `package.json`.
3. Mở PowerShell tại thư mục này, chạy:

```powershell
Copy-Item .env.example .env
notepad .env
```

4. Thay dòng `HOST_PASSWORD=` bằng mật khẩu riêng **ít nhất 12 ký tự**; lưu file.
5. Chạy:

```powershell
npm install
npm test
npm start
```

6. Trên máy host mở `http://localhost:3000/host`.
7. Nhập mật khẩu → Tạo phòng → chọn ải để sửa câu hỏi → **Lưu cấu hình vào phòng** → **Xuất JSON** để dự phòng.
8. Bấm **Trình chiếu**, mở `/screen` trên cửa sổ/màn hình phụ.

## B. Đưa lên Internet qua Render

1. Tạo repo GitHub, tải lên **các file source**; không tải lên `.env` hay `node_modules`.
2. Render Dashboard → **New → Web Service** → Connect repo GitHub.
3. Language: `Node`; Build: `npm install --omit=dev`; Start: `npm start`.
4. Thêm Environment Variable `HOST_PASSWORD` = mật khẩu host mạnh.
5. Deploy; mở `https://TEN-APP.onrender.com/health` kiểm tra.
6. Host mở `/host` tạo phòng. Chia sẻ link bằng nút **Link tham gia** cho tất cả sinh viên.
7. Học sinh/sinh viên mở link đó bằng máy riêng → nhập tên → chọn 1 trong 4 đội → thi đấu.

**Lưu ý:** Render Free có thể ngủ sau 15 phút không có lưu lượng; khi khởi động lại, phòng và điểm chơi trong RAM bị mất. Bộ câu hỏi phải **xuất JSON** trước để nhập lại khi cần. Chạy thử ít nhất 4 thiết bị, không deploy code khi đang chơi.

Đọc `README.md` để xem luật chơi chi tiết, cách đổi câu hỏi và cách khắc phục lỗi.
