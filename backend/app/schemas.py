"""Pydantic models cho request body."""
from typing import Literal

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    username: str = ""
    password: str = ""


class RegisterIn(BaseModel):
    username: str = ""
    password: str = ""
    full_name: str = ""
    email: str = ""


class ProfileIn(BaseModel):
    full_name: str = ""
    email: str = ""


class ChangePasswordIn(BaseModel):
    old_password: str = ""
    new_password: str = ""


class AnswersIn(BaseModel):
    answers: dict[str, int] | None = None


class AdminUserCreate(RegisterIn):
    role: Literal["user", "admin"] = "user"


class AdminUserUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    role: Literal["user", "admin"] | None = None
    active: bool | None = None


class PasswordIn(BaseModel):
    password: str = ""


class GroupIn(BaseModel):
    name: str = ""
    description: str = ""
    type: Literal["group", "class"] = "group"
    open: bool = True


class AddMemberIn(BaseModel):
    username: str = ""


class BulkItem(BaseModel):
    group_id: int
    user_id: int


class BulkIn(BaseModel):
    action: Literal["approve", "reject"] = "approve"
    items: list[BulkItem] = []


class OptionIn(BaseModel):
    text: str = ""
    image: str | None = None


class QuestionIn(BaseModel):
    id: int | None = None
    content: str = ""
    image_url: str | None = None
    options: list[OptionIn] = []
    correct_index: int = -1
    points: float = Field(1, ge=0)
    explanation: str = ""
    explanation_image: str | None = None


class ExamIn(BaseModel):
    title: str = ""
    description: str = ""
    duration_minutes: int = Field(30, ge=1, le=600)
    visibility: Literal["draft", "public", "restricted"] = "draft"
    max_attempts: int = Field(0, ge=0)
    shuffle: bool = False
    show_answers: bool = True
    start_at: str | None = None
    end_at: str | None = None
    questions: list[QuestionIn] = []
    group_ids: list[int] = []
    user_ids: list[int] = []


class VisibilityIn(BaseModel):
    visibility: Literal["draft", "public", "restricted"]
