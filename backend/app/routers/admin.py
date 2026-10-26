from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Attempt, Exam, ExamGroup, ExamUser, Group, GroupMember, Question, User, utcnow
from ..schemas import (AddMemberIn, AdminUserCreate, AdminUserUpdate, BulkIn, ExamIn, GroupIn, PasswordIn,
                       VisibilityIn)
from ..security import admin_user, hash_password, public_user, valid_password, valid_username
from ..services import attempt_row, finalize_expired, iso, parse_dt, summarize
from .uploads import valid_image_url

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _count(db: Session, stmt) -> int:
    return db.scalar(select(func.count()).select_from(stmt.subquery())) or 0


def _active_admins(db: Session) -> int:
    return _count(db, select(User.id).where(User.role == "admin", User.active.is_(True)))


# ---------------- TỔNG QUAN ----------------
@router.get("/stats")
def stats(_: User = Depends(admin_user), db: Session = Depends(get_db)):
    return {
        "users": _count(db, select(User.id).where(User.role == "user")),
        "admins": _count(db, select(User.id).where(User.role == "admin")),
        "exams": _count(db, select(Exam.id)),
        "published": _count(db, select(Exam.id).where(Exam.visibility != "draft")),
        "groups": _count(db, select(Group.id)),
        "pending": _count(db, select(GroupMember.user_id).where(GroupMember.status == "pending")),
        "attempts": _count(db, select(Attempt.id).where(Attempt.submitted_at.is_not(None))),
    }


# ---------------- 1 & 5. QUẢN LÝ USER, SET ADMIN ----------------
@router.get("/users")
def list_users(q: str = "", _: User = Depends(admin_user), db: Session = Depends(get_db)):
    like = f"%{q.strip()}%"
    users = db.scalars(select(User).where(or_(User.username.like(like), User.full_name.like(like), User.email.like(like)))
                       .order_by(User.role, User.created_at.desc())).all()
    attempts = dict(db.execute(select(Attempt.user_id, func.count()).where(Attempt.submitted_at.is_not(None))
                               .group_by(Attempt.user_id)).all())
    groups: dict[int, list[str]] = {}
    for uid, name in db.execute(select(GroupMember.user_id, Group.name).join(Group)
                                .where(GroupMember.status == "approved")):
        groups.setdefault(uid, []).append(name)
    return [{**public_user(u), "attempt_count": attempts.get(u.id, 0), "groups": ", ".join(groups.get(u.id, [])) or None}
            for u in users]


@router.post("/users", status_code=201)
def create_user(body: AdminUserCreate, _: User = Depends(admin_user), db: Session = Depends(get_db)):
    username, full_name = body.username.strip(), body.full_name.strip()[:100]
    if not valid_username(username):
        raise HTTPException(400, "Tên đăng nhập 3–32 ký tự, chỉ gồm chữ, số, dấu . _ -")
    if not valid_password(body.password):
        raise HTTPException(400, "Mật khẩu tối thiểu 6 ký tự")
    if not full_name:
        raise HTTPException(400, "Vui lòng nhập họ tên")
    if db.scalar(select(User.id).where(func.lower(User.username) == username.lower())):
        raise HTTPException(409, "Tên đăng nhập đã tồn tại")
    u = User(username=username, password_hash=hash_password(body.password), full_name=full_name,
             email=body.email.strip()[:150], role=body.role)
    db.add(u)
    db.commit()
    return public_user(u)


@router.put("/users/{user_id}")
def update_user(user_id: int, body: AdminUserUpdate, me: User = Depends(admin_user), db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Không tìm thấy user")
    role = body.role if body.role is not None else u.role
    active = body.active if body.active is not None else u.active
    # Không tự hạ quyền / tự khoá, và luôn giữ ít nhất 1 admin hoạt động
    if u.id == me.id and (role != "admin" or not active):
        raise HTTPException(400, "Không thể tự hạ quyền hoặc tự khoá tài khoản của mình")
    if u.role == "admin" and u.active and (role != "admin" or not active) and _active_admins(db) <= 1:
        raise HTTPException(400, "Phải còn ít nhất 1 admin")
    if body.full_name is not None:
        if not body.full_name.strip():
            raise HTTPException(400, "Vui lòng nhập họ tên")
        u.full_name = body.full_name.strip()[:100]
    if body.email is not None:
        u.email = body.email.strip()[:150]
    u.role, u.active = role, active
    db.commit()
    return public_user(u)


@router.put("/users/{user_id}/password")
def reset_password(user_id: int, body: PasswordIn, _: User = Depends(admin_user), db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Không tìm thấy user")
    if not valid_password(body.password):
        raise HTTPException(400, "Mật khẩu tối thiểu 6 ký tự")
    u.password_hash = hash_password(body.password)
    db.commit()
    return {"ok": True}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, me: User = Depends(admin_user), db: Session = Depends(get_db)):
    if user_id == me.id:
        raise HTTPException(400, "Không thể xoá chính mình")
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Không tìm thấy user")
    if u.role == "admin" and _active_admins(db) <= 1:
        raise HTTPException(400, "Phải còn ít nhất 1 admin")
    db.delete(u)
    db.commit()
    return {"ok": True}


@router.get("/users/{user_id}/attempts")
def user_attempts(user_id: int, _: User = Depends(admin_user), db: Session = Depends(get_db)):
    finalize_expired(db, user_id=user_id)
    return [attempt_row(a, with_exam=True) for a in db.scalars(
        select(Attempt).where(Attempt.user_id == user_id).order_by(Attempt.started_at.desc()))]


# ---------------- 3 & 4. NHÓM / LỚP, DUYỆT THÀNH VIÊN ----------------
def group_dict(g: Group) -> dict:
    return {"id": g.id, "name": g.name, "description": g.description, "type": g.type, "open": g.open,
            "created_at": iso(g.created_at)}


@router.get("/groups")
def list_groups(_: User = Depends(admin_user), db: Session = Depends(get_db)):
    counts: dict[tuple[int, str], int] = {
        (gid, st): n for gid, st, n in db.execute(
            select(GroupMember.group_id, GroupMember.status, func.count()).group_by(GroupMember.group_id, GroupMember.status))
    }
    exams = dict(db.execute(select(ExamGroup.group_id, func.count()).group_by(ExamGroup.group_id)).all())
    return [{**group_dict(g), "member_count": counts.get((g.id, "approved"), 0),
             "pending_count": counts.get((g.id, "pending"), 0), "exam_count": exams.get(g.id, 0)}
            for g in db.scalars(select(Group).order_by(Group.created_at.desc()))]


def _apply_group(g: Group, body: GroupIn):
    if not body.name.strip():
        raise HTTPException(400, "Vui lòng nhập tên nhóm/lớp")
    g.name, g.description = body.name.strip()[:120], body.description.strip()[:2000]
    g.type, g.open = body.type, body.open


@router.post("/groups", status_code=201)
def create_group(body: GroupIn, me: User = Depends(admin_user), db: Session = Depends(get_db)):
    g = Group(created_by=me.id)
    _apply_group(g, body)
    db.add(g)
    db.commit()
    return group_dict(g)


@router.put("/groups/{group_id}")
def update_group(group_id: int, body: GroupIn, _: User = Depends(admin_user), db: Session = Depends(get_db)):
    g = db.get(Group, group_id)
    if not g:
        raise HTTPException(404, "Không tìm thấy nhóm/lớp")
    _apply_group(g, body)
    db.commit()
    return group_dict(g)


@router.delete("/groups/{group_id}")
def delete_group(group_id: int, _: User = Depends(admin_user), db: Session = Depends(get_db)):
    g = db.get(Group, group_id)
    if g:
        db.delete(g)
        db.commit()
    return {"ok": True}


@router.get("/groups/{group_id}/members")
def group_members(group_id: int, _: User = Depends(admin_user), db: Session = Depends(get_db)):
    g = db.get(Group, group_id)
    if not g:
        raise HTTPException(404, "Không tìm thấy nhóm/lớp")
    order = {"pending": 0, "approved": 1, "rejected": 2}
    members = sorted(g.members, key=lambda m: (order.get(m.status, 3), m.requested_at))
    exams = db.execute(select(Exam.id, Exam.title, Exam.visibility).join(ExamGroup, ExamGroup.exam_id == Exam.id)
                       .where(ExamGroup.group_id == group_id)).all()
    return {
        "group": group_dict(g),
        "members": [{"id": m.user.id, "username": m.user.username, "full_name": m.user.full_name, "email": m.user.email,
                     "status": m.status, "requested_at": iso(m.requested_at), "decided_at": iso(m.decided_at)}
                    for m in members],
        "exams": [{"id": i, "title": t, "visibility": v} for i, t, v in exams],
    }


@router.get("/requests")
def pending_requests(_: User = Depends(admin_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(GroupMember).where(GroupMember.status == "pending").order_by(GroupMember.requested_at)).all()
    return [{"group_id": m.group_id, "user_id": m.user_id, "requested_at": iso(m.requested_at),
             "group_name": m.group.name, "group_type": m.group.type,
             "username": m.user.username, "full_name": m.user.full_name, "email": m.user.email} for m in rows]


@router.post("/groups/{group_id}/members/{user_id}/{action}")
def decide(group_id: int, user_id: int, action: str, me: User = Depends(admin_user), db: Session = Depends(get_db)):
    if action not in ("approve", "reject"):
        raise HTTPException(404, "Không hợp lệ")
    m = db.get(GroupMember, (group_id, user_id))
    if not m:
        raise HTTPException(404, "Không tìm thấy yêu cầu")
    m.status = "approved" if action == "approve" else "rejected"
    m.decided_at, m.decided_by = utcnow(), me.id
    db.commit()
    return {"ok": True, "status": m.status}


@router.post("/requests/bulk")
def bulk_decide(body: BulkIn, me: User = Depends(admin_user), db: Session = Depends(get_db)):
    status = "approved" if body.action == "approve" else "rejected"
    n = 0
    for it in body.items:
        m = db.get(GroupMember, (it.group_id, it.user_id))
        if m and m.status == "pending":
            m.status, m.decided_at, m.decided_by = status, utcnow(), me.id
            n += 1
    db.commit()
    return {"ok": True, "updated": n}


@router.post("/groups/{group_id}/members")
def add_member(group_id: int, body: AddMemberIn, me: User = Depends(admin_user), db: Session = Depends(get_db)):
    if not db.get(Group, group_id):
        raise HTTPException(404, "Không tìm thấy nhóm/lớp")
    u = db.scalar(select(User).where(func.lower(User.username) == body.username.strip().lower()))
    if not u:
        raise HTTPException(404, "Không tìm thấy user")
    m = db.get(GroupMember, (group_id, u.id)) or GroupMember(group_id=group_id, user_id=u.id)
    m.status, m.decided_at, m.decided_by = "approved", utcnow(), me.id
    db.add(m)
    db.commit()
    return {"ok": True}


@router.delete("/groups/{group_id}/members/{user_id}")
def remove_member(group_id: int, user_id: int, _: User = Depends(admin_user), db: Session = Depends(get_db)):
    m = db.get(GroupMember, (group_id, user_id))
    if m:
        db.delete(m)
        db.commit()
    return {"ok": True}


# ---------------- 2. ĐĂNG BÀI THI ----------------
@router.get("/exams")
def list_exams(_: User = Depends(admin_user), db: Session = Depends(get_db)):
    qc = dict(db.execute(select(Question.exam_id, func.count()).group_by(Question.exam_id)).all())
    ac = dict(db.execute(select(Attempt.exam_id, func.count()).where(Attempt.submitted_at.is_not(None))
                         .group_by(Attempt.exam_id)).all())
    uc = dict(db.execute(select(ExamUser.exam_id, func.count()).group_by(ExamUser.exam_id)).all())
    gn: dict[int, list[str]] = {}
    for eid, name in db.execute(select(ExamGroup.exam_id, Group.name).join(Group, Group.id == ExamGroup.group_id)):
        gn.setdefault(eid, []).append(name)
    return [{
        "id": e.id, "title": e.title, "visibility": e.visibility, "duration_minutes": e.duration_minutes,
        "max_attempts": e.max_attempts, "start_at": iso(e.start_at), "end_at": iso(e.end_at),
        "created_at": iso(e.created_at), "updated_at": iso(e.updated_at),
        "question_count": qc.get(e.id, 0), "attempt_count": ac.get(e.id, 0),
        "group_names": ", ".join(gn.get(e.id, [])) or None, "user_count": uc.get(e.id, 0),
    } for e in db.scalars(select(Exam).order_by(Exam.created_at.desc()))]


def question_dict(q: Question) -> dict:
    return {"id": q.id, "position": q.position, "content": q.content, "image_url": q.image_url, "options": q.options,
            "correct_index": q.correct_index, "points": q.points, "explanation": q.explanation,
            "explanation_image": q.explanation_image}


@router.get("/exams/{exam_id}")
def get_exam(exam_id: int, _: User = Depends(admin_user), db: Session = Depends(get_db)):
    e = db.get(Exam, exam_id)
    if not e:
        raise HTTPException(404, "Không tìm thấy bài thi")
    users = db.execute(select(User.id, User.username, User.full_name).join(ExamUser, ExamUser.user_id == User.id)
                       .where(ExamUser.exam_id == exam_id)).all()
    return {
        "id": e.id, "title": e.title, "description": e.description, "duration_minutes": e.duration_minutes,
        "visibility": e.visibility, "max_attempts": e.max_attempts, "shuffle": e.shuffle, "show_answers": e.show_answers,
        "start_at": iso(e.start_at), "end_at": iso(e.end_at), "created_at": iso(e.created_at),
        "questions": [question_dict(q) for q in e.questions],
        "group_ids": list(db.scalars(select(ExamGroup.group_id).where(ExamGroup.exam_id == exam_id))),
        "users": [{"id": i, "username": u, "full_name": f} for i, u, f in users],
    }


def _validate_questions(body: ExamIn) -> list[dict]:
    errors, out = [], []
    if not body.title.strip():
        errors.append("Thiếu tiêu đề")
    for i, q in enumerate(body.questions, start=1):
        image = valid_image_url(q.image_url)
        opts = []
        for o in q.options:
            text, img = o.text.strip(), valid_image_url(o.image)
            if text or img:
                opts.append({"text": text, "image": img})
        if not q.content.strip() and not image:
            errors.append(f"Câu {i}: cần nội dung hoặc ảnh đề bài")
        if len(opts) < 2:
            errors.append(f"Câu {i}: cần ít nhất 2 phương án")
        if not 0 <= q.correct_index < len(opts):
            errors.append(f"Câu {i}: chưa chọn đáp án đúng")
        out.append({"id": q.id, "content": q.content.strip(), "image_url": image, "options": opts,
                    "correct_index": q.correct_index, "points": q.points, "explanation": q.explanation.strip(),
                    "explanation_image": valid_image_url(q.explanation_image)})
    if body.visibility != "draft" and not out:
        errors.append("Bài thi đã đăng phải có ít nhất 1 câu hỏi")
    if errors:
        raise HTTPException(400, "; ".join(errors))
    return out


def _save_exam(db: Session, e: Exam, body: ExamIn) -> Exam:
    qs = _validate_questions(body)
    e.title, e.description = body.title.strip()[:200], body.description[:5000]
    e.duration_minutes, e.visibility, e.max_attempts = body.duration_minutes, body.visibility, body.max_attempts
    e.shuffle, e.show_answers = body.shuffle, body.show_answers
    e.start_at, e.end_at = parse_dt(body.start_at), parse_dt(body.end_at)
    e.updated_at = utcnow()
    if e.id is None:
        db.add(e)
        db.flush()

    # Đồng bộ câu hỏi: giữ id cũ để lịch sử bài làm vẫn xem lại được; xoá câu bị bỏ
    existing = {q.id: q for q in e.questions}
    keep: set[int] = set()
    new_list = []
    for pos, data in enumerate(qs):
        qid = data.pop("id")
        q = existing.get(qid) if qid else None
        if q is None:
            q = Question(exam_id=e.id)
        for k, v in data.items():
            setattr(q, k, v)
        q.position = pos
        new_list.append(q)
        if q.id:
            keep.add(q.id)
    e.questions = new_list  # delete-orphan xoá các câu không còn

    db.execute(delete(ExamGroup).where(ExamGroup.exam_id == e.id))
    for gid in set(body.group_ids):
        if db.get(Group, gid):
            db.add(ExamGroup(exam_id=e.id, group_id=gid))
    db.execute(delete(ExamUser).where(ExamUser.exam_id == e.id))
    for uid in set(body.user_ids):
        if db.get(User, uid):
            db.add(ExamUser(exam_id=e.id, user_id=uid))
    db.commit()
    return e


@router.post("/exams", status_code=201)
def create_exam(body: ExamIn, me: User = Depends(admin_user), db: Session = Depends(get_db)):
    e = _save_exam(db, Exam(created_by=me.id), body)
    return {"id": e.id}


@router.put("/exams/{exam_id}")
def update_exam(exam_id: int, body: ExamIn, _: User = Depends(admin_user), db: Session = Depends(get_db)):
    e = db.get(Exam, exam_id)
    if not e:
        raise HTTPException(404, "Không tìm thấy bài thi")
    _save_exam(db, e, body)
    return {"id": e.id}


@router.patch("/exams/{exam_id}/visibility")
def set_visibility(exam_id: int, body: VisibilityIn, _: User = Depends(admin_user), db: Session = Depends(get_db)):
    e = db.get(Exam, exam_id)
    if not e:
        raise HTTPException(404, "Không tìm thấy bài thi")
    if body.visibility != "draft" and not e.questions:
        raise HTTPException(400, "Bài thi chưa có câu hỏi")
    e.visibility = body.visibility
    db.commit()
    return {"ok": True}


@router.delete("/exams/{exam_id}")
def delete_exam(exam_id: int, _: User = Depends(admin_user), db: Session = Depends(get_db)):
    e = db.get(Exam, exam_id)
    if e:
        db.delete(e)
        db.commit()
    return {"ok": True}


@router.get("/exams/{exam_id}/results")
def exam_results(exam_id: int, _: User = Depends(admin_user), db: Session = Depends(get_db)):
    finalize_expired(db, exam_id=exam_id)
    e = db.get(Exam, exam_id)
    if not e:
        raise HTTPException(404, "Không tìm thấy bài thi")
    rows = []
    for a in db.scalars(select(Attempt).where(Attempt.exam_id == exam_id).order_by(Attempt.started_at.desc())):
        rows.append({**attempt_row(a), "user_id": a.user_id, "username": a.user.username, "full_name": a.user.full_name})
    s = summarize(rows)
    s["users"] = len({r["user_id"] for r in rows if r["submitted_at"]})
    return {"exam": {"id": e.id, "title": e.title}, "summary": s, "attempts": rows}
