# EVFTA Challenge V2 — Vượt ải xuất khẩu gạo

**Game web thi đấu theo nhóm dành cho buổi học MLN122 (Kinh tế chính trị Mác – Lênin).** Mỗi sinh viên tham gia bằng trình duyệt trên điện thoại hoặc máy tính; host điều khiển trận đấu và trình chiếu tiến độ xuất khẩu gạo từ Việt Nam sang EU.

> **Phiên bản hiện tại:** **6 đội cố định**, host chọn **đúng 6 tên nhóm** trong danh sách **Nhóm 4, 5, 6, 7, 8, 9, 10**. Mỗi đội **tối đa 6 người**, nhưng **không cần đủ 6 người mới được chơi**. Tổng sức chứa phòng: **36 người**. Đây **không phải** ứng dụng tùy chỉnh số lượng đội từ 4 đến 10.

## Mục lục

1. [Tính năng và vai trò](#1-tính-năng-và-vai-trò)
2. [Luật chơi 5 ải](#2-luật-chơi-5-ải)
3. [Chuẩn bị và chạy trên Windows](#3-chuẩn-bị-và-chạy-trên-windows)
4. [Hướng dẫn host tổ chức trận đấu](#4-hướng-dẫn-host-tổ-chức-trận-đấu)
5. [Host chỉnh sửa bộ câu hỏi](#5-host-chỉnh-sửa-bộ-câu-hỏi)
6. [Git & GitHub: commit/push đúng cách](#6-git--github-commitpush-đúng-cách)
7. [Deploy / redeploy trên Render](#7-deploy--redeploy-trên-render)
8. [Kiểm thử và xử lý sự cố](#8-kiểm-thử-và-xử-lý-sự-cố)
9. [Cấu trúc thư mục](#9-cấu-trúc-thư-mục)
10. [Giới hạn và lưu ý khi sử dụng](#10-giới-hạn-và-lưu-ý-khi-sử-dụng)

## 1. Tính năng và vai trò

| Vai trò | URL | Chức năng |
|---|---|---|
| **Host** | `/host` | Đăng nhập bằng mật khẩu, tạo/vào lại phòng 6 chữ số, chọn 6 nhóm, khóa/mở đăng ký, sửa câu hỏi, điều chỉnh luật chơi, bắt đầu/chốt/chuyển lượt, mở màn hình trình chiếu và xuất/nhập JSON. |
| **Sinh viên** | `/play?room=123456` | Nhập tên, chọn một trong 6 nhóm còn chỗ, trả lời hoặc bỏ phiếu bằng thiết bị riêng; theo dõi kết quả và kết nối lại khi mất mạng. |
| **Màn hình trình chiếu** | `/screen?room=123456` | Hiển thị tiến độ 5 ải, tàu, đồng hồ và bảng xếp hạng để cả lớp theo dõi. Không dùng màn hình này để điều khiển lượt. |
| **Kiểm tra server** | `/health` | Trả JSON trạng thái server, ví dụ `ok: true`. |

`123456` là **mã phòng ví dụ**, thay bằng mã host tạo ra.

### Quy tắc chia nhóm

- Mặc định: **Nhóm 4, 5, 6, 7, 8, 9**.
- Host được chọn **6 trong 7 nhóm** thuộc khoảng **Nhóm 4–10**, ví dụ **Nhóm 4, 5, 6, 7, 8, 10**.
- Mỗi nhóm **tối đa 6 người**; đội có ít người hơn vẫn tham gia và được chấm theo luật chung.
- Chỉ chọn đúng 6 tên nhóm; không thể thêm “đội thứ 7” vào cùng phòng trong phiên bản này.
- Backend kiểm soát giới hạn. Người thứ 7 của một nhóm sẽ bị từ chối.
- **Cần tối thiểu 2 đội có thành viên** để bắt đầu. Không cần cả 6 đội phải có người.
- Người mới chỉ có thể gia nhập **khi phòng đang ở lobby (trước trận)** và đăng ký chưa bị khóa; **không thể vào mới giữa trận**.
- Mất kết nối/refresh có thể khôi phục phiên cũ trên cùng trình duyệt nhờ thông tin lưu cục bộ. Mở tab mới không tạo thêm phiếu cho cùng một phiên.

## 2. Luật chơi 5 ải

| Ải | Nội dung | Cách chơi |
|---|---|---|
| **1. Chọn lô gạo** | Gạo phổ thông / gạo thơm cao cấp | Các thành viên bỏ phiếu quyết định loại gạo và mức đầu tư của đội. |
| **2. Kiểm định SPS/MRLs** | Trắc nghiệm kiến thức MLN122 | Mỗi người trả lời A/B/C/D; **phương án nhiều phiếu nhất trong đội** là đáp án chung. Đúng nhận thưởng; sai/hòa/không bỏ phiếu có thể mất xu theo cấu hình. |
| **3. Đấu giá thẻ ưu đãi** | Đấu giá giả lập | Mỗi người chọn một mức giá. Mức giá của đội được tổng hợp từ phiếu; các đội giành thẻ theo luật đấu giá. |
| **4. Biến cố logistics** | Chọn chiến lược phòng rủi ro | Đội thống nhất chiến lược; server tạo một tình huống vận tải dựa trên xác suất được host cấu hình. |
| **5. Xây dựng thương hiệu** | Bán qua nhà phân phối / đầu tư thương hiệu riêng | Các thành viên chọn hướng đi; phương án đầu tư thương hiệu còn có thử thách trắc nghiệm để nhận thưởng. |

**Cách tính thắng:** mỗi đội có **vốn chung**; lợi nhuận cuối trận = **vốn cuối − vốn khởi đầu**. Xếp hạng ưu tiên **đội có thành viên tham gia**, sau đó dựa trên lợi nhuận theo luật chương trình. **Không nhân điểm hay vốn theo sĩ số.**

**Các quy tắc quan trọng:**

- Đội có 4 người và đội có 6 người vẫn nhận cùng mức thu/chi nếu đạt cùng kết quả.
- Trắc nghiệm hòa phiếu hoặc không có phiếu: tính là **không vượt qua**; các tình huống chiến lược khác dùng quy tắc hòa xác định trong `game-core.js`.
- Đấu giá: nếu nhiều đội bằng giá tại ranh giới nhận thẻ, hệ thống có cơ chế xử lý hòa ngẫu nhiên.
- Mỗi người có **một phiếu hiện hành cho mỗi lượt**; có thể cập nhật lựa chọn trước khi lượt đóng, không thể nhân số phiếu bằng việc kết nối lại.
- Số câu hỏi trong ải 2 và ải 5 có thể chỉnh từ **1 đến 12 câu/ải**. Bộ mẫu hiện có 3 câu kiểm định và 1 câu thương hiệu, tương ứng **8 lượt** trong 5 ải.
- Thẻ ưu đãi, xu và xác suất rủi ro là **cơ chế mô phỏng phục vụ học tập**, **không phản ánh quy trình phân bổ hạn ngạch EVFTA ngoài đời**.

## 3. Chuẩn bị và chạy trên Windows

### Yêu cầu

- Windows 10/11.
- **Node.js 20+** và npm: <https://nodejs.org/en/download>.
- **Git for Windows** nếu muốn đẩy code: <https://git-scm.com/downloads/win>.
- VS Code (tùy chọn): <https://code.visualstudio.com/>.

Mở **CMD** tại thư mục dự án (thư mục chứa `package.json`):

```cmd
cd /d D:\Ki-8\MLN122\EVFTA_Challenge_V2
node -v
npm -v
```

**Lần đầu thiết lập máy local:**

```cmd
copy .env.example .env
notepad .env
```

Trong `.env`, thay `HOST_PASSWORD` bằng mật khẩu riêng dài **ít nhất 12 ký tự**, không dùng mật khẩu mẫu. Ví dụ cấu trúc file (không chép mật khẩu ví dụ lên repo):

```dotenv
HOST_PASSWORD=MAT_KHAU_RIENG_IT_NHAT_12_KY_TU
PORT=3000
```

**Chạy và kiểm thử:**

```cmd
npm ci
npm test
npm start
```

> Nếu `npm ci` báo lỗi vì `package-lock.json` không đồng bộ với `package.json`, chạy `npm install`, kiểm tra lại lockfile và commit thay đổi hợp lệ. Không xóa lockfile để né lỗi.

Trên máy host mở:

- Host: <http://localhost:3000/host>
- Người chơi: <http://localhost:3000/play>
- Health: <http://localhost:3000/health>

Dừng server bằng **Ctrl + C** trong cửa sổ CMD. `localhost` chỉ sử dụng trên chính máy đang chạy server; thiết bị khác không thể mở `localhost` của bạn để vào phòng.

## 4. Hướng dẫn host tổ chức trận đấu

1. Vào `/host`, nhập `HOST_PASSWORD` và chọn **Tạo phòng mới** (hoặc **Vào lại phòng** nếu phòng vẫn còn trên server).
2. Mở mục **Cấu hình nhóm**, chọn **chính xác 6** tên từ Nhóm 4–10 và bấm **Áp dụng danh sách 6 nhóm**.
3. Mở **Cấu hình game** để chỉnh các ải và bộ câu hỏi; **lưu cấu hình trước khi bắt đầu**.
4. **Xuất JSON** sau khi soạn xong để giữ bản sao dữ liệu trên máy.
5. Sao chép **Link tham gia** để gửi lớp, ví dụ `https://TEN-APP.onrender.com/play?room=123456`.
6. Sinh viên vào phòng và chọn nhóm. Host theo dõi sĩ số, tối đa 6 người/nhóm, có thể **Khóa đăng ký** trước khi bắt đầu.
7. Bấm **Bắt đầu trận** (nút điều khiển lượt trong trang host). Mở trang **Trình chiếu** ở một tab hoặc màn hình khác.
8. Mỗi lượt: chờ hết thời gian để tự chốt **hoặc** host bấm **Chốt lượt** → xem kết quả → host bấm **Ải/câu tiếp theo**.
9. Kết thúc, xem bảng xếp hạng và lợi nhuận. **Chơi lại** sẽ đặt lại kết quả trận; nên bảo đảm đã xuất JSON nếu cần giữ bộ câu hỏi tùy chỉnh.

**Lưu ý:** Màn hình `/screen` chỉ để trình chiếu, **host điều khiển tại `/host`**.

## 5. Host chỉnh sửa bộ câu hỏi

- Trong `/host`, mở **Cấu hình game** → chọn **Ải 2 – Kiểm định SPS/MRLs** hoặc **Ải 5 – Xây dựng thương hiệu**.
- Chọn câu hỏi cần sửa hoặc **Thêm câu**; chỉnh nội dung, bốn phương án **A/B/C/D**, đáp án đúng, giải thích.
- Đáp án đúng trong JSON lưu bằng số: `0=A`, `1=B`, `2=C`, `3=D`. Khi dùng giao diện host, chỉ cần chọn A/B/C/D.
- Có thể thay thời gian ải, số xu, chi phí và quy tắc sự kiện theo các ô mà host cung cấp.
- **Lưu cấu hình vào phòng** khi game chưa bắt đầu; xuất file JSON dự phòng. Có thể nhập lại JSON phù hợp với phiên bản 6 đội.
- File mẫu trong source: `config/default-game.json`.
- Bộ cấu hình cũ **4 đội** không thể lưu trực tiếp; khi nhập dữ liệu cũ, giao diện có thể yêu cầu xác nhận chuyển sang cấu hình 6 đội. Kiểm tra lại tên đội sau khi chuyển đổi.

**Cảnh báo nội dung học thuật:** Câu hỏi mẫu nên được soát lại với tài liệu môn MLN122 và nội dung nhóm trình bày trước khi sử dụng chính thức.

## 6. Git & GitHub: commit/push đúng cách

### A. Repo GitHub hiện có của nhóm

Repo bạn đã sử dụng:

<https://github.com/thaonguyen1909/EVFTA-Challenge-V2>

Dự án đã có `.git` và đã từng commit, **không cần chạy lại `git init`**. Mở CMD trong thư mục local rồi kiểm tra:

```cmd
cd /d D:\Ki-8\MLN122\EVFTA_Challenge_V2
git status
git branch --show-current
git remote -v
```

Nếu `origin` đang trỏ sai URL, **sửa** thay vì `git remote add origin` lần nữa:

```cmd
git remote set-url origin https://github.com/thaonguyen1909/EVFTA-Challenge-V2.git
git remote -v
```

> Chỉ dùng `git remote add origin URL` khi `git remote -v` chưa có `origin`. GitHub CLI (`gh`) **không bắt buộc** để commit hoặc push.

### B. Kiểm tra an toàn trước khi đưa file lên GitHub

`.gitignore` tối thiểu nên có nội dung sau (dùng VS Code để sửa nếu thiếu):

```gitignore
node_modules/
.env
.env.*
!.env.example
.npm/
*.log
*.zip
```

**Không upload** `.env` (mật khẩu host), `node_modules`, file ZIP chứa `.env`, token, khóa bí mật hoặc thư mục `.git` từ một bản giải nén khác.

Kiểm tra file `.env` có đang được Git theo dõi hay không:

```cmd
git ls-files -- .env
git check-ignore .env
```

- `git ls-files -- .env` **không nên in gì**.
- `git check-ignore .env` nên in `.env`.
- Nếu `.env` đã lỡ được Git theo dõi, chạy `git rm --cached .env`, đổi mật khẩu đã lộ và kiểm tra lịch sử commit; chỉ thêm `.gitignore` **không xóa bí mật khỏi lịch sử Git**.

**Kiểm tra code trước commit:**

```cmd
npm test
git diff --check
git status --short
```

### C. Nếu CHỈ thay README.md

```cmd
git add README.md
git diff --cached --name-only
git commit -m "docs: update README for 6-team EVFTA Challenge"
git push origin main
```

### D. Nếu muốn push TOÀN BỘ thay đổi source và test mà agent đã sửa

Sau khi xem kỹ `git status --short` và bảo đảm `.gitignore` đầy đủ:

```cmd
git add -A
git diff --cached --name-only
git diff --cached --check
git status
git commit -m "fix: finalize 6-team gameplay and documentation"
git push origin main
```

**Cực kỳ quan trọng:** trước `git commit`, kiểm tra danh sách staged. Nếu thấy file không muốn gửi, bỏ staging riêng file đó:

```cmd
git restore --staged TEN_FILE_KHONG_MUON_PUSH
```

Ví dụ: `git restore --staged backup.zip`.

**Nếu `git commit` báo `nothing to commit`:** không có thay đổi mới được stage hoặc các file đã được commit; kiểm tra `git status`, không cần commit trống.

**Nếu `git push` bị `non-fast-forward` / `rejected`:** repo trên GitHub có commit mới hơn. **Không dùng `--force`.** Kiểm tra rồi đồng bộ cẩn thận:

```cmd
git fetch origin
git status
git pull --rebase origin main
```

Nếu xuất hiện conflict, mở VS Code xử lý file bị conflict, chạy `git add TEN_FILE` rồi `git rebase --continue`; sau khi xong mới `git push origin main`. Không pull/rebase khi còn thay đổi chưa commit; hãy commit hoặc stash trước.

**Nếu muốn xem commit mới nhất:**

```cmd
git log -1 --oneline
git status
git remote -v
```

Thông thường `git status` sẽ báo nhánh đã đồng bộ và working tree clean sau khi push thành công.

## 7. Deploy / redeploy trên Render

### Render — tạo Web Service lần đầu

1. Mở <https://dashboard.render.com/> → **New → Web Service** → kết nối repo GitHub.
2. Chọn nhánh `main`, dịch vụ kiểu **Web Service**, runtime **Node**.
3. Đặt cấu hình:

| Mục | Giá trị |
|---|---|
| **Repository** | `thaonguyen1909/EVFTA-Challenge-V2` |
| **Branch** | `main` |
| **Root Directory** | **ĐỂ TRỐNG** nếu `package.json` nằm ngay gốc repo |
| **Build Command** | `npm ci --omit=dev` |
| **Start Command** | `npm start` |
| **Health Check Path** | `/health` |
| **Environment Variable** | `HOST_PASSWORD` = mật khẩu host riêng, >= 12 ký tự |
| **NODE_ENV** | `production` (tùy chọn) |

4. Không cần tự đặt `PORT`: `server.js` dùng `process.env.PORT` nếu Render cung cấp, và lắng nghe `0.0.0.0`.
5. Chọn instance phù hợp; gói Free phù hợp demo thử nghiệm, nhưng không nên dựa vào việc phòng luôn tồn tại sau khi server ngừng/khởi động lại.
6. Chọn deploy và xem log; khi hiện **Live**, kiểm tra `https://TEN-APP.onrender.com/health`.

### Render — cập nhật phiên bản đã deploy

Nếu Web Service **đã kết nối với GitHub và Auto Deploy bật**, mỗi lần bạn `git push origin main` có commit mới, Render thường sẽ build và redeploy tự động. Nếu Auto Deploy tắt: vào Render Dashboard → service → **Manual Deploy** → deploy commit mới nhất.

Sau deploy, thử:

```text
https://TEN-APP.onrender.com/health
https://TEN-APP.onrender.com/host
https://TEN-APP.onrender.com/play
```

**Quan trọng:** phòng, phiếu, vốn và trận đang chạy hiện **chỉ lưu trong RAM**. Restart, redeploy hoặc việc instance Free ngủ có thể làm mất phòng; mỗi lần phòng biến mất phải tạo lại mã phòng mới. Không redeploy khi lớp đang chơi. **Xuất JSON bộ câu hỏi trước khi deploy.**

Tham khảo: [Render Express](https://render.com/docs/deploy-node-express-app), [Render Web Services](https://render.com/docs/web-services), [Render Free](https://render.com/docs/free).

## 8. Kiểm thử và xử lý sự cố

**Trước khi push:**

```cmd
npm test
git diff --check
git status
```

Phiên bản ZIP mới nhất đã được rà soát trong hội thoại trước đó với **33 bài test tự động đạt**, nhưng sau khi bạn thay đổi code cần **chạy lại trên máy của mình**. Test tự động không thay thế buổi chơi thử trên server Render với thiết bị thật.

**Checklist chạy thử trên Render trước tiết học:**

1. Host tạo phòng; chọn 6 nhóm; kiểm tra hiển thị `0/6` tới `6/6`.
2. Thử cho người thứ 7 vào một nhóm đầy → bị từ chối.
3. Cho **ít nhất 2 nhóm** có người, bắt đầu trận.
4. Mỗi người bỏ phiếu A/B/C/D; thử một người sai, các thành viên khác đúng → kiểm tra phương án **đa số phiếu** là quyết định đội.
5. Kiểm tra sau chốt lượt: trình chiếu nhận kết quả, host chuyển lượt, mọi điện thoại tự đồng bộ.
6. Thử mất mạng/refresh một điện thoại → giữ đúng đội, không tăng sĩ số.
7. Chạy đủ 5 ải, kiểm tra tính vốn và lợi nhuận.
8. Trước buổi học, thử 6 nhóm/32 thiết bị trên đường truyền thực tế nếu có thể.

| Hiện tượng | Kiểm tra / khắc phục |
|---|---|
| `gh is not recognized` | Không cần dùng `gh`. Dùng `git`, hoặc cài thêm GitHub CLI nếu thật sự muốn. |
| `remote origin already exists` | Dùng `git remote set-url origin URL`, không dùng lại `git remote add origin`. |
| `git push` bị từ chối | Kiểm tra branch/remote; fetch và rebase sau khi commit local, không force push. |
| `npm` không tìm thấy | Cài Node.js, mở CMD mới và chạy `node -v`, `npm -v`. |
| `/health` không trả `ok:true` | Kiểm tra log Render / log CMD, lệnh Start, `HOST_PASSWORD`, port. |
| Không thể tạo phòng | Kiểm tra `HOST_PASSWORD` phải >= 12 ký tự và khác giá trị mẫu. |
| Sinh viên không vào được | Kiểm tra mã phòng, đội chưa đầy, phòng chưa khóa đăng ký/chưa bắt đầu, URL đúng. |
| Mất phòng sau deploy | Đây là hạn chế của việc lưu phiên trong RAM; tạo phòng mới, nhập lại JSON. |
| Cảnh báo `LF will be replaced by CRLF` | Thông báo xuống dòng phổ biến trên Windows, thường không ngăn commit/push. |

## 9. Cấu trúc thư mục

```text
EVFTA_Challenge_V2/
├── .env.example
├── .gitignore
├── README.md
├── HUONG_DAN_NHANH_WINDOWS.md
├── package.json
├── package-lock.json
├── server.js
├── game-core.js
├── config/
│   └── default-game.json
├── public/
│   ├── index.html
│   ├── host.html
│   ├── screen.html
│   ├── common.js
│   ├── host.js
│   ├── player.js
│   ├── screen.js
│   └── style.css
└── tests/
    ├── all-requirements.test.js
    ├── game.test.js
    └── server-events.test.js
```

`.env`, `.git/` và `node_modules/` có thể tồn tại **trên máy bạn** nhưng không phải phần mã nguồn cần upload.

## 10. Giới hạn và lưu ý khi sử dụng

- Chưa có database để khôi phục phòng, phiếu và kết quả sau restart.
- Nên triển khai với **một instance Node.js**; chưa cấu hình kho trạng thái dùng chung và adapter Socket.IO cho nhiều instance.
- Host nên lưu file JSON dự phòng, không chia sẻ mật khẩu host hoặc ZIP chứa `.env`.
- 6 đội là số lượng cố định trong phiên bản này; **Nhóm 4–10 là dải tên để chọn**, không phải số lượng đội được đổi thành 4–10.
- Game mô phỏng kiến thức MLN122; không thay thế tài liệu học thuật hoặc quy trình xuất khẩu gạo thực tế.
- Trước buổi thuyết trình chính thức, hãy hoàn tất ít nhất một trận thử trên chính URL Render sẽ sử dụng và trên nhiều thiết bị.

---

**Dành cho nhóm MLN122 — Đại học FPT.**
