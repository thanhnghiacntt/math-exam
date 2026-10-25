import re
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .config import JWT_SECRET, TOKEN_TTL_HOURS
from .db import get_db
from .models import User

USERNAME_RE = re.compile(r"^[A-Za-z0-9._-]{3,32}$")


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode()[:72], bcrypt.gensalt(10)).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode()[:72], h.encode())
    except ValueError:
        return False


def valid_username(u: str) -> bool:
    return bool(USERNAME_RE.match(u or ""))


def valid_password(p: str) -> bool:
    return isinstance(p, str) and 6 <= len(p) <= 128


def create_token(user: User) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS)
    return jwt.encode({"sub": str(user.id), "exp": exp}, JWT_SECRET, algorithm="HS256")


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Bắt buộc đăng nhập. Luôn đọc lại user từ DB để khoá/đổi quyền có hiệu lực ngay."""
    h = request.headers.get("authorization", "")
    if not h.startswith("Bearer "):
        raise HTTPException(401, "Chưa đăng nhập")
    try:
        payload = jwt.decode(h[7:], JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Phiên đăng nhập hết hạn")
    user = db.get(User, int(payload["sub"]))
    if not user:
        raise HTTPException(401, "Tài khoản không tồn tại")
    if not user.active:
        raise HTTPException(403, "Tài khoản đã bị khoá")
    return user


def admin_user(user: User = Depends(current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(403, "Chỉ admin mới có quyền này")
    return user


def public_user(u: User) -> dict:
    from .services import iso
    return {
        "id": u.id, "username": u.username, "full_name": u.full_name, "email": u.email,
        "role": u.role, "active": u.active, "created_at": iso(u.created_at),
    }
