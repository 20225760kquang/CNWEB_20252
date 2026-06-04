### Lệnh để thực hiện Data Migration với Alembic 

- Đảm bảo đã activate venv 
- Thực hiện các lệnh sau: 
```bash
alembic revision --autogenerate -m "message"
alembic upgrade head
```
-> Giải thích : 
alembic revision --autogenerate -m "message" : Tự động tạo ra file migration dựa trên sự thay đổi của các model (ví dụ: thêm trường mới vào model User) 
alembic upgrade head : Thực hiện nâng cấp database lên phiên bản mới nhất 
