import time

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import ALLOW_REGISTER
from ..db import get_db
from ..models import User
from ..schemas import ChangePasswordIn, LoginIn, ProfileIn, RegisterIn
from ..security import (create_token, current_user, hash_password, public_user, valid_password,
                        valid_username, verify_password)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Giới hạn đăng nhập sai: 8 lần / 15 phút theo IP + username (bộ nhớ trong)
_failed: dict[str, list[float]] = {}
WINDOW = 15 * 60


def _too_many(key: str) -> bool:
    f = _failed.get(key)
    return bool(f and f[0] >= 8 and time.time() - f[1] < WINDOW)


def _mark_fail(key: str) -> None:
    f = _failed.get(key)
    if not f or time.time() - f[1] > WINDOW:
        _failed[key] = [1, time.time()]
    else:
        f[0] += 1


@router.post("/register", status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if not ALLOW_REGISTER:
        raise HTTPException(403, "Hệ thống đang tắt đăng ký, liên hệ admin")
    username, full_name = body.username.strip(), body.full_name.strip()[:100]
    if not valid_username(username):
        raise HTTPException(400, "Tên đăng nhập 3–32 ký tự, chỉ gồm chữ, số, dấu . _ -")
    if not valid_password(body.password):
        raise HTTPException(400, "Mật khẩu tối thiểu 6 ký tự")
    if not full_name:
        raise HTTPException(400, "Vui lòng nhập họ tên")
    if db.scalar(select(User.id).where(func.lower(User.username) == username.lower())):
        raise HTTPException(409, "Tên đăng nhập đã tồn tại")
    u = User(username=username, password_hash=hash_password(body.password),
             full_name=full_name, email=body.email.strip()[:150])
    db.add(u)
    db.commit()
    return {"token": create_token(u), "user": public_user(u)}


@router.post("/login")
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    username = body.username.strip()
    key = f"{request.client.host if request.client else ''}|{username.lower()}"
    if _too_many(key):
        raise HTTPException(429, "Sai quá nhiều lần, thử lại sau 15 phút")
    u = db.scalar(select(User).where(func.lower(User.username) == username.lower()))
    if not u or not verify_password(body.password, u.password_hash):
        _mark_fail(key)
        raise HTTPException(401, "Sai tên đăng nhập hoặc mật khẩu")
    if not u.active:
        raise HTTPException(403, "Tài khoản đã bị khoá")
    _failed.pop(key, None)
    return {"token": create_token(u), "user": public_user(u)}


@router.get("/me")
def me(user: User = Depends(current_user)):
    return public_user(user)


@router.put("/me")
def update_me(body: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not body.full_name.strip():
        raise HTTPException(400, "Vui lòng nhập họ tên")
    user.full_name = body.full_name.strip()[:100]
    user.email = body.email.strip()[:150]
    db.merge(user)
    db.commit()
    return public_user(user)


@router.put("/me/password")
def change_password(body: ChangePasswordIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_password(body.old_password, user.password_hash):
        raise HTTPException(400, "Mật khẩu hiện tại không đúng")
    if not valid_password(body.new_password):
        raise HTTPException(400, "Mật khẩu mới tối thiểu 6 ký tự")
    user.password_hash = hash_password(body.new_password)
    db.merge(user)
    db.commit()
    return {"ok": True}
