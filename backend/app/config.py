import os
import secrets
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.engine import URL, make_url

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "uploads"))
FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", BASE_DIR.parent / "frontend" / "dist"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

def _database_url() -> URL:
    # A complete URL takes precedence over individual connection settings.
    raw_url = os.getenv("DATABASE_URL", "").strip()
    if raw_url:
        url = make_url(raw_url)
        if url.drivername in {"postgres", "postgresql"}:
            url = url.set(drivername="postgresql+psycopg")
    else:
        db_type = os.getenv("DB_TYPE", "sqlite").strip().lower()
        if db_type == "sqlite":
            path = os.getenv("SQLITE_PATH", "").strip()
            database = Path(path) if path else DATA_DIR / "exam.db"
            if path == ":memory:":
                return URL.create("sqlite", database=path)
            if not database.is_absolute():
                database = BASE_DIR / database
            database.parent.mkdir(parents=True, exist_ok=True)
            url = URL.create("sqlite", database=str(database))
        elif db_type == "postgresql":
            sslmode = os.getenv("DB_SSLMODE", "").strip()
            url = URL.create(
                "postgresql+psycopg",
                username=os.getenv("DB_USER", "postgres"),
                password=os.getenv("DB_PASSWORD", ""),
                host=os.getenv("DB_HOST", "localhost"),
                port=int(os.getenv("DB_PORT", "5432")),
                database=os.getenv("DB_NAME", "math_exam"),
                query={"sslmode": sslmode} if sslmode else {},
            )
        else:
            raise ValueError("DB_TYPE must be sqlite or postgresql")
    if url.get_backend_name() not in {"sqlite", "postgresql"}:
        raise ValueError("DATABASE_URL must use SQLite or PostgreSQL")
    return url


DATABASE_URL = _database_url()


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
