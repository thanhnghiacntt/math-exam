from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, exists, or_, select
from sqlalchemy.orm import Session

from .config import GRACE_SECONDS
from .models import Attempt, Exam, ExamGroup, ExamUser, GroupMember, Question, User, utcnow

GRACE = timedelta(seconds=GRACE_SECONDS)


def iso(dt: datetime | None) -> str | None:
    """Datetime UTC naive -> ISO 8601 có hậu tố Z."""
    return dt.replace(microsecond=(dt.microsecond // 1000) * 1000).isoformat(timespec="milliseconds") + "Z" if dt else None


def parse_dt(v) -> datetime | None:
    if not v:
        return None
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        return None
    if d.tzinfo:
        d = d.astimezone(timezone.utc).replace(tzinfo=None)
    return d


def r2(x: float) -> float:
    return round(x + 1e-9, 2)


def score10(score, max_score) -> float:
    return r2(score / max_score * 10) if max_score else 0.0


def visible_filter(user_id: int):
    """Điều kiện: bài thi mà user được thấy.
    - public: ai cũng thấy
    - restricted: được giao trực tiếp, hoặc giao cho nhóm/lớp mà user đã được duyệt
    """
    direct = exists().where(and_(ExamUser.exam_id == Exam.id, ExamUser.user_id == user_id))
    via_group = exists().where(and_(
        ExamGroup.exam_id == Exam.id,
        GroupMember.group_id == ExamGroup.group_id,
        GroupMember.user_id == user_id,
        GroupMember.status == "approved",
    ))
    return or_(Exam.visibility == "public", and_(Exam.visibility == "restricted", or_(direct, via_group)))


def can_see_exam(db: Session, user: User, exam_id: int) -> bool:
    if user.role == "admin":
        return db.get(Exam, exam_id) is not None
    return db.scalar(select(Exam.id).where(Exam.id == exam_id, visible_filter(user.id))) is not None


def finalize_attempt(db: Session, a: Attempt) -> Attempt:
    """Chấm điểm và đóng lượt làm bài (không commit)."""
    if a.submitted_at:
        return a
    qs = db.scalars(select(Question).where(Question.id.in_(a.question_order or []))).all()
    answers = a.answers or {}
    score = max_score = 0.0
    correct = 0
    for q in qs:
        max_score += q.points
        sel = answers.get(str(q.id))
        if sel is not None and int(sel) == q.correct_index:
            score += q.points
            correct += 1
    now = utcnow()
    a.submitted_at = a.deadline_at if now > a.deadline_at + GRACE else now
    a.score, a.max_score = r2(score), r2(max_score)
    a.correct_count, a.total_count = correct, len(qs)
    return a


def finalize_expired(db: Session, user_id: int | None = None, exam_id: int | None = None) -> None:
    """Tự động nộp các lượt đã quá giờ."""
    stmt = select(Attempt).where(Attempt.submitted_at.is_(None), Attempt.deadline_at < utcnow() - GRACE)
    if user_id:
        stmt = stmt.where(Attempt.user_id == user_id)
    if exam_id:
        stmt = stmt.where(Attempt.exam_id == exam_id)
    rows = db.scalars(stmt).all()
    for a in rows:
        finalize_attempt(db, a)
    if rows:
        db.commit()


def attempt_row(a: Attempt, with_exam: bool = False) -> dict:
    d = {
        "id": a.id, "exam_id": a.exam_id,
        "started_at": iso(a.started_at), "submitted_at": iso(a.submitted_at),
        "score": a.score, "max_score": a.max_score,
        "correct_count": a.correct_count, "total_count": a.total_count,
        "score10": score10(a.score, a.max_score) if a.submitted_at else None,
    }
    if with_exam:
        d["exam_title"] = a.exam.title
    return d


def summarize(rows: list[dict]) -> dict:
    done = [r for r in rows if r["submitted_at"]]
    s = [r["score10"] for r in done]
    return {
        "attempts": len(done),
        "average10": r2(sum(s) / len(s)) if s else None,
        "max10": max(s) if s else None,
        "min10": min(s) if s else None,
    }
