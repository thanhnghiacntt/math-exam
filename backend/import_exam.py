"""Nhập đề thi từ file JSON (kèm ảnh) vào hệ thống.

Cách dùng (chạy trong thư mục backend):
    python import_exam.py de-01.json                     # nhập 1 đề, trạng thái Nháp
    python import_exam.py thu_muc_de/                    # nhập mọi file .json trong thư mục (cả thư mục con)
    python import_exam.py thu_muc_de/ --public           # đăng công khai luôn
    python import_exam.py thu_muc_de/ --replace          # đề trùng (cùng nhóm + tiêu đề) sẽ bị thay bằng bản mới

Đề được ghi vào database theo biến DATABASE_URL (mặc định backend/data/exam.db), ảnh vào UPLOAD_DIR
(mặc định backend/uploads) — giống hệt server. Script in ra hai đường dẫn này khi chạy xong.

Định dạng JSON:
{
  "title": "...", "category": "Nhóm đề (tuỳ chọn)", "description": "...",
  "duration_minutes": 60, "max_attempts": 0, "shuffle": false, "show_answers": true,
  "questions": [
    {"content": "...", "image": "images/q01.png" | null,
     "options": [{"text": "...", "image": null}, ...],
     "correct_index": 0, "points": 4, "explanation": "...", "explanation_image": null}
  ]
}
Đường dẫn ảnh tính tương đối theo vị trí file JSON.
"""
import argparse
import io
import json
import sys
import uuid
from pathlib import Path

from PIL import Image
from sqlalchemy import select

from app.config import UPLOAD_DIR
from app.db import SessionLocal, engine
from app.main import app  # noqa: F401  (tạo bảng, nâng cấp cột, tạo admin nếu chưa có)
from app.models import Exam, Question, User

ALLOWED = {"PNG": "png", "JPEG": "jpg", "GIF": "gif", "WEBP": "webp"}


def store_image(base: Path, rel: str | None) -> str | None:
    if not rel:
        return None
    if rel.startswith("/uploads/") or rel.startswith("https://"):
        return rel
    data = (base / rel).resolve().read_bytes()
    Image.open(io.BytesIO(data)).verify()
    fmt = Image.open(io.BytesIO(data)).format
    if fmt not in ALLOWED:
        raise ValueError(f"{rel}: định dạng {fmt} không được hỗ trợ")
    name = f"{uuid.uuid4().hex}.{ALLOWED[fmt]}"
    (UPLOAD_DIR / name).write_bytes(data)
    return f"/uploads/{name}"


def validate(spec: dict) -> list[str]:
    errors = []
    if not spec.get("title"):
        errors.append("thiếu title")
    for i, q in enumerate(spec.get("questions", []), 1):
        opts = q.get("options", [])
        if not (q.get("content") or q.get("image")):
            errors.append(f"câu {i}: thiếu nội dung/ảnh")
        if len(opts) < 2 or not 0 <= q.get("correct_index", -1) < len(opts):
            errors.append(f"câu {i}: phương án/đáp án không hợp lệ")
    if not spec.get("questions"):
        errors.append("không có câu hỏi")
    return errors


def import_one(db, path: Path, public: bool, replace: bool, admin_id: int | None) -> str:
    spec = json.loads(path.read_text(encoding="utf-8"))
    errors = validate(spec)
    if errors:
        raise ValueError("; ".join(errors))
    category = (spec.get("category") or "").strip()[:100]
    title = spec["title"].strip()[:200]
    existing = db.scalars(select(Exam).where(Exam.title == title, Exam.category == category)).all()
    if existing and not replace:
        return f"BỎ QUA (đã có, dùng --replace để thay): [{category}] {title}"
    for e in existing:
        db.delete(e)

    base = path.parent
    exam = Exam(
        title=title, category=category, description=spec.get("description", ""),
        duration_minutes=int(spec.get("duration_minutes", 30)), max_attempts=int(spec.get("max_attempts", 0)),
        shuffle=bool(spec.get("shuffle", False)), show_answers=bool(spec.get("show_answers", True)),
        visibility="public" if public else "draft", created_by=admin_id,
    )
    for pos, q in enumerate(spec["questions"]):
        exam.questions.append(Question(
            position=pos, content=q.get("content", ""), image_url=store_image(base, q.get("image")),
            options=[{"text": o.get("text", ""), "image": store_image(base, o.get("image"))} for o in q["options"]],
            correct_index=q["correct_index"], points=float(q.get("points", 1)),
            explanation=q.get("explanation", ""), explanation_image=store_image(base, q.get("explanation_image")),
        ))
    db.add(exam)
    db.flush()
    action = "THAY" if existing else "NHẬP"
    return f"{action} #{exam.id}: [{category or '—'}] {title} — {len(exam.questions)} câu, {exam.visibility}"


def main() -> None:
    ap = argparse.ArgumentParser(description="Nhập đề thi từ JSON")
    ap.add_argument("paths", nargs="+", type=Path, help="file .json hoặc thư mục chứa các file .json")
    ap.add_argument("--public", action="store_true", help="Đăng công khai ngay (mặc định: Nháp)")
    ap.add_argument("--replace", action="store_true", help="Thay đề đã có cùng nhóm + tiêu đề")
    args = ap.parse_args()

    files: list[Path] = []
    for p in args.paths:
        files += sorted(p.rglob("*.json")) if p.is_dir() else [p]
    if not files:
        sys.exit("Không tìm thấy file .json nào")

    ok = fail = 0
    with SessionLocal() as db:
        admin = db.scalar(select(User).where(User.role == "admin").order_by(User.id))
        for f in files:
            try:
                print(import_one(db, f, args.public, args.replace, admin.id if admin else None))
                db.commit()
                ok += 1
            except Exception as e:  # noqa: BLE001
                db.rollback()
                print(f"LỖI {f}: {e}")
                fail += 1
    print(f"\nXong: {ok} file thành công, {fail} lỗi.")
    print(f"Database   : {engine.url.render_as_string(hide_password=True)}")
    print(f"Thư mục ảnh: {UPLOAD_DIR}")


if __name__ == "__main__":
    main()
