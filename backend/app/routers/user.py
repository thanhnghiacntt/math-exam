import random
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Attempt, Exam, ExamGroup, Group, GroupMember, Question, User, utcnow
from ..schemas import AnswersIn
from ..security import current_user
from ..services import (GRACE, attempt_row, can_see_exam, finalize_attempt, finalize_expired, iso, r2,
                        score10, visible_filter)

router = APIRouter(prefix="/api", tags=["user"])


# ---------------- BÀI THI ----------------
@router.get("/exams")
def list_exams(all: int = Query(0), user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Bài thi user được thấy: công khai + giao trực tiếp + giao qua nhóm/lớp đã duyệt."""
    finalize_expired(db, user_id=user.id)
    stmt = select(Exam)
    if user.role == "admin" and all == 1:
        stmt = stmt.where(Exam.visibility != "draft")
    else:
        stmt = stmt.where(visible_filter(user.id))
    exams = db.scalars(stmt.order_by(Exam.created_at.desc())).all()
    ids = [e.id for e in exams]
    if not ids:
        return []

    qcount = dict(db.execute(select(Question.exam_id, func.count()).where(Question.exam_id.in_(ids))
                             .group_by(Question.exam_id)).all())
    mine = db.scalars(select(Attempt).where(Attempt.user_id == user.id, Attempt.exam_id.in_(ids))).all()
    groups = db.execute(
        select(ExamGroup.exam_id, Group.name).join(Group, Group.id == ExamGroup.group_id)
        .join(GroupMember, (GroupMember.group_id == Group.id) & (GroupMember.user_id == user.id)
              & (GroupMember.status == "approved"))
        .where(ExamGroup.exam_id.in_(ids))
    ).all()
    via: dict[int, list[str]] = {}
    for eid, name in groups:
        via.setdefault(eid, []).append(name)

    out = []
    for e in exams:
        done = [a for a in mine if a.exam_id == e.id and a.submitted_at]
        open_ = next((a for a in mine if a.exam_id == e.id and not a.submitted_at), None)
        out.append({
            "id": e.id, "title": e.title, "description": e.description,
            "duration_minutes": e.duration_minutes, "visibility": e.visibility, "max_attempts": e.max_attempts,
            "start_at": iso(e.start_at), "end_at": iso(e.end_at), "created_at": iso(e.created_at),
            "question_count": qcount.get(e.id, 0),
            "my_attempts": len(done),
            "my_best": max((score10(a.score, a.max_score) for a in done), default=None),
            "in_progress_id": open_.id if open_ else None,
            "via_groups": ", ".join(via.get(e.id, [])) or None,
        })
    return out


@router.get("/exams/{exam_id}")
def exam_detail(exam_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not can_see_exam(db, user, exam_id):
        raise HTTPException(404, "Không tìm thấy bài thi")
    finalize_expired(db, user_id=user.id, exam_id=exam_id)
    e = db.get(Exam, exam_id)
    attempts = db.scalars(select(Attempt).where(Attempt.exam_id == exam_id, Attempt.user_id == user.id)
                          .order_by(Attempt.started_at.desc())).all()
    return {
        "id": e.id, "title": e.title, "description": e.description, "duration_minutes": e.duration_minutes,
        "visibility": e.visibility, "max_attempts": e.max_attempts, "show_answers": e.show_answers,
        "start_at": iso(e.start_at), "end_at": iso(e.end_at),
        "question_count": len(e.questions), "total_points": r2(sum(q.points for q in e.questions)),
        "attempts": [attempt_row(a) for a in attempts],
    }


@router.post("/exams/{exam_id}/start")
def start_exam(exam_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not can_see_exam(db, user, exam_id):
        raise HTTPException(404, "Không tìm thấy bài thi")
    finalize_expired(db, user_id=user.id, exam_id=exam_id)
    e = db.get(Exam, exam_id)
    now = utcnow()

    open_ = db.scalar(select(Attempt).where(Attempt.exam_id == exam_id, Attempt.user_id == user.id,
                                            Attempt.submitted_at.is_(None)))
    if open_:
        return {"attempt_id": open_.id, "resumed": True}
    if e.start_at and now < e.start_at:
        raise HTTPException(400, "Bài thi chưa mở")
    if e.end_at and now > e.end_at:
        raise HTTPException(400, "Bài thi đã đóng")
    if e.max_attempts > 0:
        used = db.scalar(select(func.count()).select_from(Attempt)
                         .where(Attempt.exam_id == exam_id, Attempt.user_id == user.id))
        if used >= e.max_attempts:
            raise HTTPException(400, f"Bạn đã dùng hết {e.max_attempts} lượt làm bài")
    qids = [q.id for q in e.questions]
    if not qids:
        raise HTTPException(400, "Bài thi chưa có câu hỏi")
    if e.shuffle:
        random.shuffle(qids)
    deadline = now + timedelta(minutes=e.duration_minutes)
    if e.end_at:
        deadline = min(deadline, e.end_at)
    a = Attempt(exam_id=exam_id, user_id=user.id, question_order=qids, answers={},
                started_at=now, deadline_at=deadline)
    db.add(a)
    db.commit()
    return {"attempt_id": a.id, "resumed": False}


def _own_attempt(db: Session, user: User, attempt_id: int) -> Attempt:
    a = db.get(Attempt, attempt_id)
    if not a or (a.user_id != user.id and user.role != "admin"):
        raise HTTPException(404, "Không tìm thấy lượt làm bài")
    return a


@router.get("/attempts/{attempt_id}")
def get_attempt(attempt_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Đang làm: trả đề (KHÔNG kèm đáp án). Đã nộp: trả kết quả (+ đáp án nếu đề cho phép)."""
    a = _own_attempt(db, user, attempt_id)
    if not a.submitted_at and utcnow() > a.deadline_at + GRACE:
        finalize_attempt(db, a)
        db.commit()
    e = a.exam
    by_id = {q.id: q for q in e.questions}
    reveal = bool(a.submitted_at) and (e.show_answers or user.role == "admin")
    answers = a.answers or {}
    questions = []
    for no, qid in enumerate([q for q in a.question_order if q in by_id], start=1):
        q = by_id[qid]
        item = {
            "id": q.id, "no": no, "content": q.content, "image_url": q.image_url,
            "options": q.options, "points": q.points,
        }
        if str(q.id) in answers:
            item["selected"] = int(answers[str(q.id)])
        if a.submitted_at:
            item["is_correct"] = item.get("selected") == q.correct_index
        if reveal:
            item.update(correct_index=q.correct_index, explanation=q.explanation,
                        explanation_image=q.explanation_image)
        questions.append(item)
    return {
        "id": a.id,
        "exam": {"id": e.id, "title": e.title, "show_answers": e.show_answers},
        "started_at": iso(a.started_at), "deadline_at": iso(a.deadline_at), "submitted_at": iso(a.submitted_at),
        "server_now": iso(utcnow()),
        "score": a.score, "max_score": a.max_score,
        "score10": score10(a.score, a.max_score) if a.submitted_at else None,
        "correct_count": a.correct_count, "total_count": a.total_count,
        "questions": questions,
    }


def _clean_answers(a: Attempt, raw: dict | None) -> dict:
    valid = set(a.question_order)
    out = {}
    for k, v in (raw or {}).items():
        try:
            qid, opt = int(k), int(v)
        except (TypeError, ValueError):
            continue
        if qid in valid and 0 <= opt < 26:
            out[str(qid)] = opt
    return out


@router.put("/attempts/{attempt_id}/answers")
def save_answers(attempt_id: int, body: AnswersIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = _own_attempt(db, user, attempt_id)
    if a.user_id != user.id:
        raise HTTPException(403, "Không thể sửa bài của người khác")
    if a.submitted_at:
        raise HTTPException(400, "Bài đã nộp")
    if utcnow() > a.deadline_at + GRACE:
        finalize_attempt(db, a)
        db.commit()
        raise HTTPException(400, "Đã hết giờ, bài đã được nộp tự động")
    a.answers = _clean_answers(a, body.answers)
    db.commit()
    return {"ok": True, "saved_at": iso(utcnow())}


@router.post("/attempts/{attempt_id}/submit")
def submit(attempt_id: int, body: AnswersIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    a = _own_attempt(db, user, attempt_id)
    if a.user_id != user.id:
        raise HTTPException(403, "Không thể nộp bài của người khác")
    if not a.submitted_at:
        # Chỉ nhận đáp án gửi kèm nếu còn trong thời gian
        if body.answers is not None and utcnow() <= a.deadline_at + GRACE:
            a.answers = _clean_answers(a, body.answers)
        finalize_attempt(db, a)
        db.commit()
    return attempt_row(a)


@router.get("/history")
def history(user: User = Depends(current_user), db: Session = Depends(get_db)):
    finalize_expired(db, user_id=user.id)
    rows = [attempt_row(a, with_exam=True) for a in db.scalars(
        select(Attempt).where(Attempt.user_id == user.id).order_by(Attempt.started_at.desc())).all()]
    done = [r for r in rows if r["submitted_at"]]
    s = [r["score10"] for r in done]
    return {
        "summary": {
            "total_attempts": len(done),
            "exams_taken": len({r["exam_id"] for r in done}),
            "average10": r2(sum(s) / len(s)) if s else None,
            "best10": max(s) if s else None,
        },
        "attempts": rows,
    }


# ---------------- NHÓM / LỚP ----------------
@router.get("/groups")
def list_groups(user: User = Depends(current_user), db: Session = Depends(get_db)):
    groups = db.scalars(select(Group).order_by(Group.type.desc(), Group.name)).all()
    my = {m.group_id: m.status for m in db.scalars(select(GroupMember).where(GroupMember.user_id == user.id))}
    members = dict(db.execute(select(GroupMember.group_id, func.count()).where(GroupMember.status == "approved")
                              .group_by(GroupMember.group_id)).all())
    exams = dict(db.execute(select(ExamGroup.group_id, func.count()).join(Exam, Exam.id == ExamGroup.exam_id)
                            .where(Exam.visibility == "restricted").group_by(ExamGroup.group_id)).all())
    return [{
        "id": g.id, "name": g.name, "description": g.description, "type": g.type, "open": g.open,
        "created_at": iso(g.created_at), "member_count": members.get(g.id, 0), "exam_count": exams.get(g.id, 0),
        "my_status": my.get(g.id),
    } for g in groups if g.open or g.id in my]


@router.post("/groups/{group_id}/join")
def join_group(group_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    g = db.get(Group, group_id)
    if not g:
        raise HTTPException(404, "Không tìm thấy nhóm/lớp")
    m = db.get(GroupMember, (group_id, user.id))
    if m and m.status == "approved":
        raise HTTPException(400, "Bạn đã là thành viên")
    if m and m.status == "pending":
        raise HTTPException(400, "Yêu cầu đang chờ duyệt")
    if not g.open:
        raise HTTPException(403, "Nhóm/lớp này không nhận đăng ký")
    if m:
        m.status, m.requested_at, m.decided_at, m.decided_by = "pending", utcnow(), None, None
    else:
        db.add(GroupMember(group_id=group_id, user_id=user.id, status="pending"))
    db.commit()
    return {"ok": True, "status": "pending"}


@router.delete("/groups/{group_id}/membership")
def leave_group(group_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = db.get(GroupMember, (group_id, user.id))
    if m:
        db.delete(m)
        db.commit()
    return {"ok": True}
