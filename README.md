# EVFTA Challenge V2 – Vượt ải xuất khẩu gạo

> Game web multiplayer cho môn MLN122: 5 ải, 4 đội, mỗi sinh viên tự vào bằng điện thoại hoặc máy tính, bỏ phiếu theo đội và so tài bằng **lợi nhuận**. Host có thể cấu hình câu hỏi/trò chơi trước khi bắt đầu.

## 1. Chức năng

| Vai trò | Trang | Chức năng |
|---|---|---|
| Host | `/host` | Đăng nhập bằng `HOST_PASSWORD`, tạo phòng 6 số, đổi tên 4 đội, chỉnh 5 ải, chỉnh câu hỏi A/B/C/D và đáp án, thêm/xóa câu, đổi giờ, chi phí, doanh thu, nhập/xuất JSON, bắt đầu/chốt lượt/chơi lại |
| Người chơi | `/play?room=123456` | Nhập nickname, tự chọn đội, vào phòng qua link, vote bằng thiết bị riêng, xem vốn/lãi và kết quả |
| Màn hình lớn | `/screen?room=123456` | Bản đồ 4 con tàu, 5 ải, đồng hồ, bảng xếp hạng, số phiếu **không lộ giá đấu khi lượt còn chạy** |

### Cơ chế 5 ải / 8 lượt mặc định

1. **Chọn lô gạo:** mỗi đội cùng vote chọn gạo phổ thông (chi 3, doanh thu 8) hoặc gạo thơm (chi 5, doanh thu 12).
2. **Kiểm định SPS/MRLs:** 3 câu trắc nghiệm, mỗi người trả lời riêng. Đáp án nhiều phiếu nhất quyết định câu trả lời của đội; đúng +1 xu, sai/hòa/không vote trừ 1 xu (host chỉnh được).
3. **Đấu giá thẻ ưu đãi (giả lập):** mỗi đội vote bí mật mức 0–3 xu; hai đội đặt giá cao nhất giành thẻ +4 xu lúc kết toán. Đội thắng trả giá đấu, đội thua không trả. Nếu nhiều đội cùng giá ở ranh giới thắng, hệ thống bốc thăm ngẫu nhiên. Nếu phiếu nội bộ hòa, đội chọn mức thấp hơn trong các mức hòa.
4. **Biến cố logistics:** mỗi đội chọn mua bảo hiểm, không dự phòng hoặc dự phòng một phần. Server bốc thăm tình hình vận tải sau khi hết giờ (mặc định 65% xảy ra biến cố). Chi phí và thiệt hại tùy chiến lược.
5. **Xây dựng thương hiệu:** đội chọn bán cho nhà phân phối (+2 xu cuối trận) hoặc đầu tư thương hiệu (chi 2 xu, nếu vượt câu hỏi thương hiệu nhận +6 xu). Host có thể thêm câu hỏi; khi đầu tư thương hiệu cần đúng ít nhất một nửa số câu.

**Đội thắng:** Đội đang tham gia có `lợi nhuận = vốn cuối trận − vốn khởi đầu` lớn nhất. Mỗi đội chỉ có một ngân sách chung, không cộng xu theo số người; các phiếu cá nhân quyết định phương án chung.

**Quy tắc hòa/không vote:** trắc nghiệm hòa → không đạt; chọn lô và thương hiệu không có đa số → áp dụng lựa chọn đầu tiên; biến cố logistics không có đa số → áp dụng lựa chọn thứ hai; đấu giá nội bộ hòa → mức giá nhỏ hơn; đấu giá giữa các đội hòa tại vị trí tranh thẻ → bốc thăm ngẫu nhiên.

**Phân biệt game và thực tế:** xu, thẻ ưu đãi, đấu giá và rủi ro 65% là cơ chế game hư cấu phục vụ học tập. EVFTA **không** cấp hạn ngạch nhập khẩu gạo bằng cách đấu giá như game. Câu hỏi mẫu minh họa kiến thức, nên rà soát cùng giáo trình và tài liệu của nhóm trước khi dùng làm kiểm tra.

## 2. Chạy trên Windows 10/11

### Chuẩn bị

- Node.js **20 trở lên**: https://nodejs.org/en/download
- Một trình soạn thảo (VS Code nếu muốn): https://code.visualstudio.com/
- Internet cho bước cài thư viện.

Giải nén ZIP, mở PowerShell trong thư mục có file `package.json`:

```powershell
node -v
npm -v
Copy-Item .env.example .env
notepad .env
```

Sửa `HOST_PASSWORD=` trong `.env` thành **mật khẩu riêng từ 12 ký tự trở lên**, khác giá trị mẫu; lưu lại. Ví dụ không nên dùng mật khẩu công khai trong các hướng dẫn hoặc chia sẻ ảnh màn hình.

```powershell
npm install
npm test
npm start
```

Ứng dụng chạy mặc định trên `http://localhost:3000`.

- Host: `http://localhost:3000/host`
- Người chơi: `http://localhost:3000/play`
- Kiểm tra server: `http://localhost:3000/health`

Để dừng server: bấm `Ctrl + C` trong cửa sổ PowerShell. Nếu gặp PowerShell execution policy với `npm.ps1`, thử lệnh `npm.cmd install` / `npm.cmd start`, hoặc dùng Command Prompt.

### Chạy thử trên một máy

1. Mở `/host`, nhập mật khẩu và bấm **Tạo phòng mới**.
2. Trong **Cấu hình game**, chọn ải 2 → xem/sửa câu hỏi; bấm **Lưu cấu hình vào phòng**.
3. Mở 2 cửa sổ ẩn danh hoặc trình duyệt khác vào `/play?room=MÃ_PHÒNG` với nickname khác nhau, chọn **hai đội khác nhau**.
4. Quay lại host → **Bắt đầu trận**; thử bỏ phiếu ở các tab.
5. Host chọn **Chốt lượt** hoặc đợi đồng hồ hết → xem kết quả → **Ải/câu tiếp theo**.
6. Mở **Trình chiếu** để có màn hình riêng cho máy chiếu.

> Khi game đã bắt đầu, người chơi mới vẫn có thể vào đội. Muốn **đổi đội**, người chơi phải rời đội trước khi trận bắt đầu; nếu đang thi đấu thì chỉ có thể kết nối lại bằng cùng trình duyệt/thiết bị đã lưu định danh.

## 3. Host tự thay câu hỏi

- Host chọn **Ải 2 – Kiểm định** hoặc **Ải 5 – Xây dựng thương hiệu**.
- Chọn `Câu 1`, `Câu 2`... hoặc `+ Thêm câu`.
- Sửa **Nội dung**, **đáp án A/B/C/D**, **đáp án đúng**, **giải thích**.
- Sửa **thời gian mỗi lượt** (cùng thời gian cho mọi câu trong ải đó).
- Bấm **Lưu cấu hình vào phòng**. Chỉ được lưu **trước khi bắt đầu trận**.
- Bấm **Xuất JSON** để tải bộ câu hỏi/luật về máy, sau đó có thể **Nhập JSON** để dùng lại. File JSON mẫu nằm tại `config/default-game.json`.

**Quan trọng:** lưu cấu hình vào phòng chỉ lưu trong RAM. Nên xuất JSON **ngay khi soạn xong**, để dùng lại sau khi server restart, thay vì chỉ trông chờ vào chức năng lưu tạm.

## 4. Deploy trên Render để mỗi máy tự vào bằng Internet

### A – Đưa source lên GitHub

1. Tạo repo mới trên https://github.com/new, ví dụ `evfta-challenge-mln122`.
2. Trong PowerShell tại thư mục dự án:

```powershell
git init
git add .
git commit -m "EVFTA Challenge V2 initial"
git branch -M main
git remote add origin https://github.com/USERNAME/evfta-challenge-mln122.git
git push -u origin main
```

Thay `USERNAME` bằng tên GitHub của bạn. Nếu máy chưa cài Git, tải từ https://git-scm.com/downloads/win.

**Không được đẩy `.env`, mật khẩu host hoặc thư mục `node_modules/` lên GitHub.** Các thư mục đó đã được nêu trong `.gitignore`.

### B – Deploy Render

1. Vào https://dashboard.render.com/ → **New → Web Service**.
2. Kết nối GitHub và chọn repo của bạn.
3. Thiết lập:

| Trường Render | Giá trị |
|---|---|
| Language / Runtime | Node |
| Build Command | `npm install --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/health` (nếu có phần tùy chọn) |
| Instance | Free để thử; cân nhắc trả phí nếu buổi thuyết trình quan trọng |

4. Ở **Environment**, thêm `HOST_PASSWORD` = mật khẩu riêng của bạn (ít nhất 12 ký tự). **Không cần khai báo `PORT` trên Render**; code tự đọc cổng do Render cấp và lắng nghe ở `0.0.0.0`.
5. Bấm **Create Web Service** và đợi thông báo deploy thành công. Render sẽ cấp URL dạng `https://ten-ung-dung.onrender.com`.
6. Truy cập `https://ten-ung-dung.onrender.com/health` → nếu hiện `ok:true`, mở `/host` tạo phòng.

### C – Cho cả lớp vào game

- Host: `https://ten-ung-dung.onrender.com/host`
- Sinh viên: `https://ten-ung-dung.onrender.com/play?room=123456` (thay mã phòng 6 số của bạn).
- Máy chiếu: `https://ten-ung-dung.onrender.com/screen?room=123456`.
- **Mỗi sinh viên tự mở link, nhập nickname và chọn đội. Không bắt buộc cùng Wi-Fi.**
- Chọn **Link tham gia** trong giao diện host để sao chép URL đúng với mã phòng hiện tại.

### D – Điểm cần kiểm tra trước thuyết trình

- Render Free có thể **ngủ sau 15 phút không có lưu lượng**, thời gian khởi động lại có thể khoảng 1 phút. Một lần restart/redeploy/spin down có thể khiến phòng, lượt, phiếu bầu, vốn **mất toàn bộ** do ứng dụng dùng RAM. Nếu cần tránh rủi ro này, cân nhắc gói có thời gian chạy ổn định và bổ sung database/khả năng phục hồi phòng.
- Đăng nhập host, tạo phòng và chạy test **ít nhất 4 thiết bị** trước lớp. Không deploy phiên bản code mới khi game đang chạy.
- Cần dùng 1 instance server, không scale nhiều instance vì chưa có Socket.IO adapter hoặc kho dữ liệu chia sẻ.
- Nếu người dùng mất mạng, khi kết nối lại trên **cùng trình duyệt**, định danh cũ được dùng để tiếp tục. Xóa dữ liệu trình duyệt hoặc chuyển thiết bị có thể khiến người đó được tính là người chơi mới.

Tài liệu chính thức:
- Render Express: https://render.com/docs/deploy-node-express-app
- Render free-tier: https://render.com/docs/free
- Render web service: https://render.com/docs/web-services
- Socket.IO: https://socket.io/docs/v4/

## 5. Cấu trúc source

```text
EVFTA_Challenge_V2/
├─ .env.example                # biến môi trường mẫu
├─ .gitignore                  # tránh đưa mật khẩu lên Git
├─ package.json                # scripts npm và thư viện
├─ server.js                   # Express + Socket.IO + quản lý phòng
├─ game-core.js                # luật tính vốn, kiểm định, đấu giá, biến cố
├─ config/default-game.json    # 5 ải + câu hỏi MLN122 mặc định
├─ public/
│  ├─ index.html               # người chơi
│  ├─ host.html                # dashboard host
│  ├─ screen.html              # màn hình lớn
│  ├─ common.js                # các thành phần hiển thị chung
│  ├─ player.js                # tham gia, bỏ phiếu
│  ├─ host.js                  # chỉnh JSON, câu hỏi, điều khiển
│  ├─ screen.js                # bảng trình chiếu
│  └─ style.css                # giao diện responsive
└─ tests/
   ├─ game.test.js            # kiểm thử luật game
   └─ server-events.test.js   # mô phỏng sự kiện Socket.IO bằng mock
```

## 6. Phạm vi bản demo

Đã thực hiện kiểm tra cú pháp các file JS; 10 bài test tự động phần logic và sự kiện mock; kiểm tra ảnh chụp giao diện host, người chơi và màn hình chiếu trên Chromium giả lập. **Chưa chạy thử Socket.IO trên internet, không có URL deployment công khai trong gói này**, vì môi trường tạo mã nguồn không tải được dependencies từ npm. Vui lòng chạy `npm install` trên máy Windows và thử với ít nhất hai đội trước khi dùng thật.

### Nâng cấp đề xuất nếu dùng lâu dài

- Lưu bộ câu hỏi, lịch sử trận và phiên người chơi vào PostgreSQL/Redis để sống qua restart.
- Host xác thực bằng phiên được quản lý an toàn hơn, giới hạn tạo phòng và số lần nhập mật khẩu.
- Chống spam tài khoản, kiểm soát tên hiển thị, host có thể kick/duyệt thành viên.
- QR được tạo thật, hoạt ảnh tàu vượt ải, âm thanh sự kiện và hiệu ứng thắng thua.
- Tùy chọn điểm thưởng/bảo hiểm và điều chỉnh luật không cần sửa code.
