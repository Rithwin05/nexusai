from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

Mode = Literal["semantic", "keyword", "hybrid"]


class ChatIn(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    conversation_id: Optional[str] = None
    document_ids: Optional[list[str]] = Field(default=None, max_length=50)
    regenerate: bool = False

    @field_validator("question")
    @classmethod
    def strip(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Question cannot be empty")
        return v.strip()


class SearchIn(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    mode: Mode = "hybrid"
    top_k: int = Field(default=10, ge=1, le=50)
    threshold: float = Field(default=0.2, ge=-1, le=1)
    document_ids: Optional[list[str]] = Field(default=None, max_length=50)


class DocIn(BaseModel):
    document_id: str


class SentimentIn(BaseModel):
    document_id: Optional[str] = None
    text: Optional[str] = Field(default=None, max_length=20000)


class CompareIn(BaseModel):
    document_a: str
    document_b: str


class ExplainIn(BaseModel):
    concept: str = Field(min_length=2, max_length=300)
    level: Literal["beginner", "intermediate", "expert"] = "beginner"
    document_ids: Optional[list[str]] = None


class FeedbackIn(BaseModel):
    rating: Literal["up", "down"]
    comment: Optional[str] = Field(default=None, max_length=1000)


class ConversationIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class SettingsIn(BaseModel):
    top_k: int = Field(ge=1, le=20)
    threshold: float = Field(ge=0, le=0.9)
    mode: Mode
    chunk_size: int = Field(ge=300, le=4000)
    chunk_overlap: int = Field(ge=0, le=1000)
    llm_model: str
    workspace_name: Optional[str] = Field(default=None, min_length=1, max_length=80)


class EvalItemIn(BaseModel):
    question: str = Field(min_length=5, max_length=500)
    document_id: str
    expected_keywords: list[str] = Field(default_factory=list, max_length=10)


class EvalGenerateIn(BaseModel):
    count: int = Field(default=8, ge=1, le=15)
    document_ids: Optional[list[str]] = None


class EvalRunIn(BaseModel):
    mode: Mode = "hybrid"
    top_k: int = Field(default=5, ge=1, le=20)
    threshold: float = Field(default=0.0, ge=0, le=0.9)
    label: Optional[str] = Field(default=None, max_length=80)
