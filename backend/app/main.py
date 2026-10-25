from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import ADMIN_PASSWORD, ADMIN_USERNAME, CORS_ORIGINS, FRONTEND_DIST, UPLOAD_DIR
from .db import Base, SessionLocal, engine
from .models import User
from .routers import admin, auth, uploads, user
from .security import hash_password

app = FastAPI(title="Thi Toán Trắc Nghiệm", version="2.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")


# ---------- Khởi tạo DB + admin mặc định ----------
Base.metadata.create_all(engine)
with SessionLocal() as _db:
    if not _db.scalar(select(User.id).where(User.role == "admin")):
        _db.add(User(username=ADMIN_USERNAME, password_hash=hash_password(ADMIN_PASSWORD),
                     full_name="Quản trị viên", role="admin"))
        _db.commit()
        print(f"[seed] Đã tạo tài khoản admin: {ADMIN_USERNAME} / {ADMIN_PASSWORD} — hãy đổi mật khẩu ngay.")


# ---------- Lỗi trả về dạng {"error": "..."} ----------
@app.exception_handler(StarletteHTTPException)
async def http_error(_: Request, exc: StarletteHTTPException):
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    msgs = []
    for e in exc.errors()[:5]:
        loc = ".".join(str(x) for x in e.get("loc", []) if x != "body")
        msgs.append(f"{loc}: {e.get('msg')}")
    return JSONResponse({"error": "Dữ liệu không hợp lệ — " + "; ".join(msgs)}, status_code=400)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Referrer-Policy"] = "same-origin"
    if not request.url.path.startswith("/api/docs"):
        resp.headers["X-Frame-Options"] = "DENY"
    return resp


if CORS_ORIGINS:  # chỉ cần khi FE chạy ở domain khác
    app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router)
app.include_router(uploads.router)
app.include_router(admin.router)
app.include_router(user.router)


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
def api_not_found(path: str):
    raise HTTPException(404, "API không tồn tại")


# ---------- File tĩnh ----------
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = (FRONTEND_DIST / path).resolve()
        if path and f.is_file() and FRONTEND_DIST.resolve() in f.parents:
            return FileResponse(f)
        return FileResponse(FRONTEND_DIST / "index.html")
