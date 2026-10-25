"""Upload ảnh cho đề thi (chỉ admin)."""
import io
import re
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from ..config import MAX_IMAGE_SIDE, MAX_UPLOAD_MB, UPLOAD_DIR
from ..models import User
from ..security import admin_user

router = APIRouter(prefix="/api/admin/uploads", tags=["uploads"])

ALLOWED = {"PNG": "png", "JPEG": "jpg", "GIF": "gif", "WEBP": "webp"}
URL_RE = re.compile(r"^(/uploads/[a-f0-9]{32}\.(png|jpg|gif|webp)|https://[^\s\"'<>]{1,280})$")
Image.MAX_IMAGE_PIXELS = 40_000_000  # chặn "decompression bomb"


def valid_image_url(u: str | None) -> str | None:
    """Chỉ chấp nhận ảnh đã upload lên hệ thống hoặc URL https."""
    if not u:
        return None
    u = u.strip()
    return u if URL_RE.match(u) else None


@router.post("")
async def upload_image(file: UploadFile = File(...), _: User = Depends(admin_user)):
    limit = int(MAX_UPLOAD_MB * 1024 * 1024)
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"Ảnh tối đa {MAX_UPLOAD_MB:g} MB")
    if not data:
        raise HTTPException(400, "File rỗng")

    # Xác minh đúng là ảnh bằng Pillow, không tin vào đuôi file / content-type
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()
        img = Image.open(io.BytesIO(data))
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(400, "File không phải ảnh hợp lệ (chỉ nhận PNG, JPG, GIF, WEBP)")
    fmt = img.format
    if fmt not in ALLOWED:
        raise HTTPException(400, "Chỉ nhận ảnh PNG, JPG, GIF, WEBP")

    ext = ALLOWED[fmt]
    name = f"{uuid.uuid4().hex}.{ext}"
    path = UPLOAD_DIR / name

    if fmt == "GIF" and getattr(img, "is_animated", False):
        path.write_bytes(data)  # giữ nguyên GIF động
    else:
        # Xoay theo EXIF, thu nhỏ ảnh quá lớn, lưu lại để loại bỏ metadata (vị trí GPS, ...)
        img = ImageOps.exif_transpose(img)
        if max(img.size) > MAX_IMAGE_SIDE:
            img.thumbnail((MAX_IMAGE_SIDE, MAX_IMAGE_SIDE))
        if fmt == "JPEG":
            img.convert("RGB").save(path, "JPEG", quality=88, optimize=True)
        else:
            img.save(path, fmt, optimize=True)

    w, h = Image.open(path).size
    return {"url": f"/uploads/{name}", "width": w, "height": h}
