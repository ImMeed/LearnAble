from sqlalchemy import select

from app.db.models.quiz import Quiz, QuizQuestion
from app.db.session import SessionLocal


def main() -> None:
    session = SessionLocal()
    try:
        existing = session.scalar(select(Quiz.id).limit(1))
        if existing is not None:
            print("Quiz seed skipped: at least one quiz already exists.")
            return

        quiz = Quiz(
            title_ar="اختبار تمهيدي للقراءة",
            title_en="Reading Starter Quiz",
            difficulty="EASY",
            reward_points=10,
            reward_xp=20,
            is_active=True,
        )
        session.add(quiz)
        session.flush()

        q1 = QuizQuestion(
            quiz_id=quiz.id,
            prompt_ar="ما هو الحرف الذي يبدأ به لفظ 'تفاحة'؟",
            prompt_en="Which letter starts the word 'apple'?",
            options_json=[
                {"key": "A", "text_ar": "أ", "text_en": "A"},
                {"key": "B", "text_ar": "ب", "text_en": "B"},
                {"key": "C", "text_ar": "ت", "text_en": "T"},
                {"key": "D", "text_ar": "س", "text_en": "S"},
            ],
            correct_option="A",
            explanation_ar="تبدأ كلمة تفاحة بحرف الألف.",
            explanation_en="The word apple starts with the letter A.",
        )

        q2 = QuizQuestion(
            quiz_id=quiz.id,
            prompt_ar="أي كلمة تعبّر عن صوت؟",
            prompt_en="Which option represents a sound?",
            options_json=[
                {"key": "A", "text_ar": "ضوء", "text_en": "Light"},
                {"key": "B", "text_ar": "صوت", "text_en": "Sound"},
                {"key": "C", "text_ar": "لون", "text_en": "Color"},
                {"key": "D", "text_ar": "شكل", "text_en": "Shape"},
            ],
            correct_option="B",
            explanation_ar="الصوت هو ما نسمعه بالأذن.",
            explanation_en="Sound is what we hear.",
        )

        session.add_all([q1, q2])
        session.commit()
        print(f"Seeded quiz {quiz.id} with 2 questions.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
