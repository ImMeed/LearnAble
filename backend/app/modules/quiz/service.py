from datetime import datetime, timezone
from uuid import UUID

from fastapi import status
from sqlalchemy.orm import Session

from app.core.i18n import localized_http_exception
from app.core.security import CurrentUser
from app.modules.economy.service import apply_hint_penalty, apply_quiz_reward
from app.modules.quiz import repository
from app.modules.quiz.schemas import (
    HintRequest,
    HintResponse,
    QuizAnswerSubmission,
    QuizListResponse,
    QuizQuestionItem,
    QuizQuestionOption,
    QuizSummary,
    StartQuizResponse,
    SubmitQuizRequest,
    SubmitQuizResponse,
)


def _quiz_title_for_locale(title_ar: str, title_en: str, locale: str) -> str:
    return title_en if locale == "en" else title_ar


def get_quizzes(session: Session, locale: str) -> QuizListResponse:
    quizzes = repository.list_quizzes(session)
    items = [
        QuizSummary(
            id=quiz.id,
            title=_quiz_title_for_locale(quiz.title_ar, quiz.title_en, locale),
            difficulty=quiz.difficulty,
            reward_points=quiz.reward_points,
            reward_xp=quiz.reward_xp,
        )
        for quiz in quizzes
    ]
    return QuizListResponse(items=items)


def start_quiz(session: Session, quiz_id: UUID, current_user: CurrentUser, locale: str) -> StartQuizResponse:
    quiz = repository.get_quiz(session, quiz_id)
    if quiz is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "QUIZ_NOT_FOUND", locale)

    questions = repository.get_quiz_questions(session, quiz_id)
    if not questions:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "QUIZ_EMPTY", locale)

    attempt = repository.create_attempt(session, current_user.user_id, quiz_id)
    session.commit()

    result_questions = []
    for question in questions:
        options = [
            QuizQuestionOption(
                key=item["key"],
                text=item["text_en"] if locale == "en" else item["text_ar"],
            )
            for item in question.options_json
        ]
        result_questions.append(
            QuizQuestionItem(
                id=question.id,
                text=question.prompt_en if locale == "en" else question.prompt_ar,
                options=options,
            )
        )

    return StartQuizResponse(
        attempt_id=attempt.id,
        quiz=QuizSummary(
            id=quiz.id,
            title=_quiz_title_for_locale(quiz.title_ar, quiz.title_en, locale),
            difficulty=quiz.difficulty,
            reward_points=quiz.reward_points,
            reward_xp=quiz.reward_xp,
        ),
        questions=result_questions,
    )


def _build_answer_map(answers: list[QuizAnswerSubmission]) -> dict[UUID, str]:
    return {answer.question_id: answer.option_key for answer in answers}


def submit_quiz(
    session: Session,
    quiz_id: UUID,
    payload: SubmitQuizRequest,
    current_user: CurrentUser,
    locale: str,
) -> SubmitQuizResponse:
    attempt = repository.get_attempt_for_user(session, payload.attempt_id, current_user.user_id)
    if attempt is None or attempt.quiz_id != quiz_id:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "ATTEMPT_NOT_FOUND", locale)

    if attempt.completed_at is not None:
        raise localized_http_exception(status.HTTP_409_CONFLICT, "ATTEMPT_ALREADY_COMPLETED", locale)

    quiz = repository.get_quiz(session, quiz_id)
    if quiz is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "QUIZ_NOT_FOUND", locale)

    questions = repository.get_quiz_questions(session, quiz_id)
    if not questions:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "QUIZ_EMPTY", locale)

    answers_by_question = _build_answer_map(payload.answers)
    correct_count = 0
    persisted_answers: dict[str, str] = {}

    for question in questions:
        selected = answers_by_question.get(question.id, "")
        persisted_answers[str(question.id)] = selected
        if selected == question.correct_option:
            correct_count += 1

    total = len(questions)
    score = int((correct_count / total) * 100)
    earned_points = round((quiz.reward_points * correct_count) / total)
    earned_xp = round((quiz.reward_xp * correct_count) / total)

    attempt.score = score
    attempt.total_questions = total
    attempt.earned_points = earned_points
    attempt.earned_xp = earned_xp
    attempt.answers_json = persisted_answers
    attempt.completed_at = datetime.now(timezone.utc)

    wallet_balance = apply_quiz_reward(
        session=session,
        user_id=current_user.user_id,
        points_delta=earned_points,
        xp_delta=earned_xp,
        reason="quiz_submit",
        metadata={"quiz_id": str(quiz_id), "attempt_id": str(attempt.id), "score": score},
    )

    session.add(attempt)
    session.commit()

    return SubmitQuizResponse(
        score=score,
        total_questions=total,
        correct_answers=correct_count,
        earned_points=earned_points,
        earned_xp=earned_xp,
        wallet_balance=wallet_balance,
    )


def get_quiz_hint(
    session: Session,
    quiz_id: UUID,
    payload: HintRequest,
    current_user: CurrentUser,
    locale: str,
) -> HintResponse:
    quiz = repository.get_quiz(session, quiz_id)
    if quiz is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "QUIZ_NOT_FOUND", locale)

    question = repository.get_quiz_question(session, quiz_id, payload.question_id)
    if question is None:
        raise localized_http_exception(status.HTTP_404_NOT_FOUND, "QUESTION_NOT_FOUND", locale)

    points_cost = 2
    wallet_balance = apply_hint_penalty(
        session=session,
        user_id=current_user.user_id,
        points_cost=points_cost,
        reason="quiz_hint",
        metadata={"quiz_id": str(quiz_id), "question_id": str(payload.question_id)},
        locale=locale,
    )
    session.commit()

    hint = (
        "ركز على الكلمات المفتاحية في السؤال واستبعد الخيارين الأقل منطقية أولاً."
        if locale == "ar"
        else "Focus on the key terms in the question and eliminate the two least plausible options first."
    )

    return HintResponse(hint=hint, points_cost=points_cost, wallet_balance=wallet_balance)
