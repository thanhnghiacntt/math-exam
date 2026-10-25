"""Tạo dữ liệu mẫu:  python seed_demo.py"""
import uuid

from PIL import Image, ImageDraw
from sqlalchemy import select

from app.config import UPLOAD_DIR
from app.db import SessionLocal
from app.main import app  # noqa: F401  (tạo bảng + admin)
from app.models import Exam, ExamGroup, ExamUser, Group, GroupMember, Question, User, utcnow
from app.security import hash_password


def make_image(draw_fn, size=(520, 320)) -> str:
    img = Image.new("RGB", size, "white")
    draw_fn(ImageDraw.Draw(img), size)
    name = f"{uuid.uuid4().hex}.png"
    img.save(UPLOAD_DIR / name)
    return f"/uploads/{name}"


def triangle(d: ImageDraw.ImageDraw, size):
    A, B, C = (80, 270), (440, 270), (80, 60)
    d.polygon([A, B, C], outline="black", width=3)
    d.rectangle([80, 250, 100, 270], outline="black", width=2)
    d.text((60, 275), "A", fill="black")
    d.text((445, 275), "B", fill="black")
    d.text((60, 45), "C", fill="black")
    d.text((250, 280), "AB = 4 cm", fill="#2b4c8c")
    d.text((20, 160), "AC = 3 cm", fill="#2b4c8c")
    d.text((270, 150), "BC = ?", fill="#b4372f")


def parabola(d: ImageDraw.ImageDraw, size, a=1.0):
    w, h = size
    ox, oy, s = w // 2, h - 60, 40
    d.line([(20, oy), (w - 20, oy)], fill="gray", width=1)
    d.line([(ox, 10), (ox, h - 10)], fill="gray", width=1)
    pts = [(ox + x * s / 10, oy - a * (x / 10) ** 2 * s) for x in range(-50, 51)]
    d.line([p for p in pts if p[1] > 5], fill="#2b4c8c", width=3)
    d.text((w - 30, oy + 5), "x", fill="black")
    d.text((ox + 6, 12), "y", fill="black")
    d.text((ox + 4, oy + 4), "O", fill="black")


def line_graph(d: ImageDraw.ImageDraw, size):
    w, h = size
    ox, oy = w // 2, h // 2
    d.line([(20, oy), (w - 20, oy)], fill="gray")
    d.line([(ox, 10), (ox, h - 10)], fill="gray")
    d.line([(ox - 150, oy + 150), (ox + 120, oy - 120)], fill="#b4372f", width=3)
    d.text((ox + 4, oy + 4), "O", fill="black")


db = SessionLocal()
admin = db.scalar(select(User).where(User.role == "admin"))


def user(username, name):
    u = db.scalar(select(User).where(User.username == username))
    if not u:
        u = User(username=username, password_hash=hash_password("123456"), full_name=name)
        db.add(u)
        db.flush()
    return u


an, binh = user("hocsinh1", "Nguyễn Văn An"), user("hocsinh2", "Trần Thị Bình")
lop10 = Group(name="Lớp 10A1", type="class", description="Lớp Toán 10 — năm học 2026–2027", created_by=admin.id)
clb = Group(name="CLB Toán nâng cao", type="group", description="Ôn luyện thi học sinh giỏi", created_by=admin.id)
db.add_all([lop10, clb])
db.flush()
db.add(GroupMember(group_id=lop10.id, user_id=an.id, status="approved", decided_at=utcnow(), decided_by=admin.id))
db.add(GroupMember(group_id=lop10.id, user_id=binh.id, status="pending"))


def exam(title, desc, vis, minutes, questions):
    e = Exam(title=title, description=desc, visibility=vis, duration_minutes=minutes, created_by=admin.id)
    for i, q in enumerate(questions):
        content, opts, correct, *rest = q
        img = rest[1] if len(rest) > 1 else None
        e.questions.append(Question(
            position=i, content=content, image_url=img, correct_index=correct, points=1,
            explanation=rest[0] if rest else "",
            options=[o if isinstance(o, dict) else {"text": o, "image": None} for o in opts],
        ))
    db.add(e)
    db.flush()
    return e


exam("Kiểm tra nhanh: Đại số & Hình học", "Bài công khai. Có câu hỏi dạng ảnh.", "public", 15, [
    ("Nghiệm của phương trình $2x + 6 = 0$ là:", ["$x = 3$", "$x = -3$", "$x = 6$", "$x = -6$"], 1, "$2x = -6 \\Rightarrow x = -3$"),
    ("", ["$5$ cm", "$7$ cm", "$\\sqrt{7}$ cm", "$25$ cm"], 0, "Pitago: $BC = \\sqrt{3^2+4^2} = 5$", make_image(triangle)),
    ("Đồ thị bên là của hàm số nào?", ["$y = x^2$", "$y = -x^2$", "$y = 2x$", "$y = x^3$"], 0, "", make_image(parabola)),
    ("Đường thẳng nào có đồ thị như hình?", [
        {"text": "$y = x$", "image": None}, {"text": "$y = -x$", "image": None},
        {"text": "$y = x + 2$", "image": None}, {"text": "$y = 2$", "image": None}], 0, "", make_image(line_graph)),
    ("Đạo hàm của $f(x) = x^3$ là:", ["$3x$", "$x^2$", "$3x^2$", "$\\frac{x^4}{4}$"], 2, "$(x^n)' = n x^{n-1}$"),
])

e2 = exam("Lớp 10A1 — Mệnh đề và tập hợp", "Chỉ dành cho thành viên Lớp 10A1", "restricted", 20, [
    ("Cho $A = \\{1;2;3\\}$, $B = \\{2;3;4\\}$. Tập $A \\cap B$ là:", ["$\\{2;3\\}$", "$\\{1;4\\}$", "$\\{1;2;3;4\\}$", "$\\varnothing$"], 0),
    ("Số tập con của tập có $3$ phần tử là:", ["$3$", "$6$", "$8$", "$9$"], 2, "Có $2^3 = 8$ tập con"),
])
db.add(ExamGroup(exam_id=e2.id, group_id=lop10.id))

e3 = exam("Đề luyện HSG: Tích phân", "Giao riêng", "restricted", 30, [
    ("$\\displaystyle\\int_0^1 2x\\,dx$ bằng:", ["$0$", "$1$", "$2$", "$\\frac12$"], 1, "$[x^2]_0^1 = 1$"),
])
db.add(ExamUser(exam_id=e3.id, user_id=an.id))
db.add(ExamGroup(exam_id=e3.id, group_id=clb.id))

db.commit()
print("Đã tạo dữ liệu mẫu. User: hocsinh1 / 123456 (đã vào Lớp 10A1), hocsinh2 / 123456 (đang chờ duyệt).")
