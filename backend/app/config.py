import os
import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "uploads"))
FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", BASE_DIR.parent / "frontend" / "dist"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'exam.db'}")


def _load_secret() -> str:
    if os.getenv("JWT_SECRET"):
        return os.environ["JWT_SECRET"]
    f = DATA_DIR / ".jwt_secret"
    if f.exists():
        return f.read_text().strip()
    s = secrets.token_hex(48)
    f.write_text(s)
    try:
        f.chmod(0o600)
    except OSError:
        pass
    return s


JWT_SECRET = _load_secret()
TOKEN_TTL_HOURS = int(os.getenv("TOKEN_TTL_HOURS", "168"))  # 7 ngày
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")
ALLOW_REGISTER = os.getenv("ALLOW_REGISTER", "true").lower() != "false"
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

MAX_UPLOAD_MB = float(os.getenv("MAX_UPLOAD_MB", "5"))
MAX_IMAGE_SIDE = int(os.getenv("MAX_IMAGE_SIDE", "2000"))  # ảnh lớn hơn sẽ được thu nhỏ
GRACE_SECONDS = 30  # cho phép nộp trễ do mạng
