from pydantic import BaseModel, Field


class ExplainRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    bookTitle: str | None = None
    question: str | None = None


class ExplainResponse(BaseModel):
    explanation: str
    policy_applied: bool
    locale: str


class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    language: str = Field(default="ar", pattern="^(ar|en)$")


class TranslateResponse(BaseModel):
    translation: str
    policy_applied: bool
    locale: str
