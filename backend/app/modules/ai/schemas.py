from pydantic import BaseModel, Field


class ExplainRequest(BaseModel):
    text: str = Field(max_length=500)
    bookTitle: str | None = None
    question: str | None = None


class ExplainResponse(BaseModel):
    explanation: str


class TranslateRequest(BaseModel):
    text: str = Field(max_length=500)
    language: str = "ar"


class TranslateResponse(BaseModel):
    translation: str
