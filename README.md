# Thi Toán Trắc Nghiệm v2 — React + TypeScript / Python FastAPI

- **backend/**: Python 3.10+, FastAPI, SQLAlchemy 2, SQLite (đổi sang PostgreSQL/MySQL qua `DATABASE_URL`), JWT, bcrypt, Pillow
- **frontend/**: React 19 + TypeScript (strict) + Vite + React Router, công thức hiển thị bằng KaTeX

## Chạy nhanh (production: backend phục vụ luôn FE đã build)

```bash
# 1. Build frontend
cd frontend
npm install
npm run build            # tạo frontend/dist

# 2. Chạy backend
cd ../backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python seed_demo.py      # (tuỳ chọn) dữ liệu mẫu, có câu hỏi dạng ảnh
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Mở http://localhost:8000. Tài khoản admin tạo lần đầu: **admin / admin123** (đổi ngay).
User mẫu: `hocsinh1 / 123456` (đã vào Lớp 10A1), `hocsinh2 / 123456` (đang chờ duyệt).
Tài liệu API (Swagger): http://localhost:8000/api/docs

## Chạy khi phát triển

```bash
cd backend && uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev        # http://localhost:5173, tự proxy /api và /uploads sang :8000
```

## Biến môi trường (backend)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | `sqlite:///backend/data/exam.db` | Chuỗi kết nối SQLAlchemy |
| `JWT_SECRET` | tự sinh, lưu `data/.jwt_secret` | Khoá ký token |
| `TOKEN_TTL_HOURS` | 168 | Thời hạn đăng nhập |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | admin / admin123 | Admin tạo lần đầu |
| `ALLOW_REGISTER` | `true` | `false` = tắt tự đăng ký |
| `UPLOAD_DIR` | `backend/uploads` | Thư mục lưu ảnh |
| `MAX_UPLOAD_MB` | 5 | Dung lượng ảnh tối đa |
| `MAX_IMAGE_SIDE` | 2000 | Ảnh lớn hơn sẽ tự thu nhỏ (px) |
| `CORS_ORIGINS` | (trống) | Chỉ cần khi FE chạy ở domain khác, vd `https://exam.example.com` |

## Ảnh trong đề thi

Trong trình soạn đề, mỗi câu hỏi có thể có:
- **Ảnh đề bài**: dùng thay cho nội dung chữ (chụp đề, hình học, đồ thị), hoặc bổ sung cho nội dung
- **Ảnh cho từng phương án** (ví dụ: chọn đồ thị đúng)
- **Ảnh lời giải**

Có 3 cách thêm ảnh: bấm chọn file, kéo-thả, hoặc bấm vào ô rồi **Ctrl+V** dán ảnh chụp màn hình. Có nút "Xem trước như học sinh thấy". Học sinh bấm vào ảnh để phóng to.

Server xác minh file bằng Pillow (chỉ nhận PNG/JPG/GIF/WEBP, không tin đuôi file), tự xoay theo EXIF, thu nhỏ ảnh quá lớn, xoá metadata (GPS…), đặt tên ngẫu nhiên. Chỉ admin được upload. Ảnh nằm ở `backend/uploads/` — nhớ sao lưu thư mục này cùng database.

## Chức năng

**User**: tự đăng ký; thấy và làm bài công khai + bài được giao trực tiếp hoặc qua nhóm/lớp đã được duyệt; đồng hồ theo giờ server, tự lưu, tự nộp khi hết giờ; xem điểm (thang 10), lịch sử, xem lại bài + lời giải; đăng ký nhóm/lớp (chờ admin duyệt), huỷ yêu cầu, rời nhóm.

**Admin**: quản lý user (tạo, sửa, khoá, đặt lại mật khẩu, xoá, xem lịch sử); **set quyền admin** (không tự hạ quyền, luôn còn ≥1 admin); soạn đề với LaTeX + ảnh, nhập nhanh từ văn bản, điểm từng câu, thời gian, số lượt, giờ mở/đóng, xáo câu, ẩn/hiện đáp án; trạng thái Nháp / Công khai / Giới hạn (giao cho nhóm, lớp, user); tạo nhóm/lớp, duyệt từng yêu cầu hoặc hàng loạt; kết quả, xếp hạng, xuất CSV.

## Cấu trúc

```
backend/
  app/main.py            FastAPI app, seed admin, phục vụ /uploads và frontend/dist
  app/models.py          Bảng: users, groups, group_members, exams, questions, exam_users, exam_groups, attempts
  app/security.py        bcrypt, JWT, dependency current_user / admin_user
  app/services.py        Quyền xem đề, chấm điểm, tự nộp bài quá giờ
  app/routers/auth.py    /api/auth/*
  app/routers/user.py    /api/exams, /api/attempts, /api/history, /api/groups
  app/routers/admin.py   /api/admin/*
  app/routers/uploads.py /api/admin/uploads (upload ảnh)
  seed_demo.py
frontend/src/
  api.ts, auth.tsx, ui.tsx, types.ts, utils.ts
  components/            MathText (KaTeX), ImageUpload, Layout, shared
  pages/                 Auth, Exams, ExamInfo, Take, Result, History, Groups, Profile
  pages/admin/           Dashboard, Users, Groups, Requests, ExamsAdmin, ExamEditor, ExamResults
```

## Bảo mật

- Đáp án đúng **không** gửi xuống client khi đang làm bài; chấm điểm và kiểm tra hạn nộp ở server (cho trễ 30 giây).
- Mỗi request đọc lại user từ DB nên khoá tài khoản / đổi quyền có hiệu lực ngay.
- Giới hạn đăng nhập sai 8 lần / 15 phút. URL ảnh trong đề chỉ nhận ảnh đã upload hoặc `https://`.
- Lưu ý: ảnh trong `/uploads` truy cập được bằng URL trực tiếp (tên file ngẫu nhiên 128-bit, không đoán được) — đừng dùng ảnh cho nội dung cần giữ bí mật tuyệt đối trước giờ thi.
