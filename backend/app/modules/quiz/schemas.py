from uuid import UUID

from pydantic import BaseModel, Field


class QuizSummary(BaseModel):
    id: UUID
    title: str
    difficulty: str
    reward_points: int
    reward_xp: int


class QuizListResponse(BaseModel):
    items: list[QuizSummary] = []


class QuizQuestionOption(BaseModel):
    key: str
    text: str


class QuizQuestionItem(BaseModel):
    id: UUID
    text: str
    options: list[QuizQuestionOption]


class StartQuizResponse(BaseModel):
    attempt_id: UUID
    quiz: QuizSummary
    questions: list[QuizQuestionItem]


class QuizAnswerSubmission(BaseModel):
    question_id: UUID
    option_key: str = Field(min_length=1, max_length=20)


class SubmitQuizRequest(BaseModel):
    attempt_id: UUID
    answers: list[QuizAnswerSubmission]


class SubmitQuizResponse(BaseModel):
    score: int
    total_questions: int
    correct_answers: int
    earned_points: int
    earned_xp: int
    wallet_balance: int


class HintRequest(BaseModel):
    question_id: UUID


class HintResponse(BaseModel):
    hint: str
    points_cost: int
    wallet_balance: int
