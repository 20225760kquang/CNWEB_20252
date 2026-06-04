## Cam.ai — Video Management System
# Hệ thống quản lý camera: live stream (WebRTC), xem lại (HLS), ghi hình, AI phát hiện người (YOLOv8n).

## Thành viên nhóm

| Họ và tên | MSSV |
|-----------|------|
| Nguyễn Khắc Quang | 20225760 |
| Seng Saikchhun | 20239708 |
| Chu Đình Sơn | 20215636 |

## Yêu cầu

- **Python** ≥ 3.10
- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14
- **Docker Desktop** (cho MediaMTX + MinIO)
- **FFmpeg** (cài sẵn trong PATH)

## 1. Khởi động MediaMTX & MinIO

```bash
cd backend
docker compose up -d
```

Kiểm tra:
- MinIO Console: http://localhost:9001 (minioadmin / minioadmin)
- MediaMTX API: http://localhost:9997

## 2. Cấu hình & chạy Backend

```bash
cd backend

# Tạo .env từ template
cp .env.example .env
# Sửa .env: DATABASE_URL, JWT_SECRET_KEY, CORS_ORIGINS (thêm URL frontend)
```

```bash
# Tạo venv & cài dependencies
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

pip install -r requirements.txt
```

```bash
# Tạo database (PostgreSQL)
createdb vms_db                # hoặc tạo qua pgAdmin

# Chạy migration
alembic upgrade head

# Khởi chạy
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

API docs: http://localhost:8000/docs

## 3. Cấu hình & chạy Frontend

```bash
cd frontend

# Tạo .env.local
cp .env.example .env.local
# Sửa: NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

```bash
npm install
npm run dev
```

Mở: http://localhost:3000

## 4. Tạo tài khoản Admin đầu tiên

Dùng Swagger UI tại http://localhost:8000/docs hoặc gọi API trực tiếp:

```bash
curl -X POST http://localhost:8000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","email":"admin@cam.ai","password":"admin123","role":"admin"}'
```

> ⚠️ Endpoint tạo user yêu cầu quyền Admin. Lần đầu có thể cần insert trực tiếp vào DB hoặc tạm bỏ auth check.

## Cấu trúc dự án

```
cam.ai/
├── backend/          # FastAPI + Python
│   ├── docker-compose.yml   # MediaMTX + MinIO
│   ├── main.py
│   └── ...
├── frontend/         # Next.js 16 + TypeScript
│   └── ...
└── system_design_2_roles.md  # Tài liệu thiết kế
```
