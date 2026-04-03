"""
Phase 10: Bilingual Demo Data Seed (Arabic Primary)

Populates LearnAble with comprehensive demo data covering all roles and modules:
- Users: student, tutor, parent, psychologist, admin (AR)
- Links: student-parent, student-psychologist, student-tutor relationships
- Economy: wallet, XP/point ledgers
- Study: lessons, flashcards, reading games, screening
- Quiz: quiz questions with rewards
- Library: books with point costs
- Teacher: assistance requests, feedback prompts
- Forum: spaces, posts, comments, votes
- Psychologist: questionnaires, support confirmations
- Notifications: parent notifications
- Gamification: milestones
"""

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select

from app.core.roles import UserRole
from app.db.models.economy import PointTransactionType, PointsWallet, XpLedger
from app.db.models.forum import ForumComment, ForumPost, ForumSpace
from app.db.models.library import Book
from app.db.models.links import StudentParentLink, StudentPsychologistLink
from app.db.models.notifications import Notification
from app.db.models.psychologist import PsychologistSupportConfirmation, TeacherQuestionnaire
from app.db.models.quiz import Quiz, QuizQuestion
from app.db.models.study import Lesson, LessonFlashcard, LessonReadingGame, StudentScreening
from app.db.models.teacher import StudentFeedbackPrompt, TeacherAssistanceRequest
from app.db.models.users import User
from app.db.session import SessionLocal


def main() -> None:
    session = SessionLocal()
    try:
        # Check if seed data already exists
        existing = session.scalar(select(User).where(User.email.like("%demo-ar%")).limit(1))
        if existing is not None:
            print("Seed data skipped: demo data already exists.")
            return

        print("🌱 Seeding Phase 10 demo data (Arabic)...")

        # === Create users for all roles (Arabic) ===
        demo_student = User(
            email="demo-student-ar@learnable.test",
            password_hash="demo_hash_ar",
            role=UserRole.ROLE_STUDENT,
        )
        demo_tutor = User(
            email="demo-tutor-ar@learnable.test",
            password_hash="demo_hash_ar",
            role=UserRole.ROLE_TUTOR,
        )
        demo_parent = User(
            email="demo-parent-ar@learnable.test",
            password_hash="demo_hash_ar",
            role=UserRole.ROLE_PARENT,
        )
        demo_psychologist = User(
            email="demo-psychologist-ar@learnable.test",
            password_hash="demo_hash_ar",
            role=UserRole.ROLE_PSYCHOLOGIST,
        )
        demo_admin = User(
            email="demo-admin-ar@learnable.test",
            password_hash="demo_hash_ar",
            role=UserRole.ROLE_ADMIN,
        )
        session.add_all([demo_student, demo_tutor, demo_parent, demo_psychologist, demo_admin])
        session.flush()

        # === Create relationships ===
        session.add(StudentParentLink(student_user_id=demo_student.id, parent_user_id=demo_parent.id))
        session.add(StudentPsychologistLink(student_user_id=demo_student.id, psychologist_user_id=demo_psychologist.id))
        session.flush()

        # === Create economy records ===
        session.add(PointsWallet(user_id=demo_student.id, balance_points=100))
        session.add(XpLedger(user_id=demo_student.id, earned_xp=50))
        session.add(XpLedger(user_id=demo_tutor.id, earned_xp=200))
        session.flush()

        # === Study Module ===
        lesson1 = Lesson(
            title_ar="القراءة المستهدفة",
            title_en="Targeted Reading",
            body_ar="محتوى درس القراءة. يركز على مهارات القراءة الأساسية للمتعلمين متعددي القدرات.",
            body_en="Content for reading lesson. Focuses on basic reading skills for diverse learners.",
            difficulty="BEGINNER",
            is_active=True,
        )
        lesson2 = Lesson(
            title_ar="الفهم والاستيعاب",
            title_en="Comprehension",
            body_ar="درس متقدم في فهم النصوص والاستيعاب التحليلي.",
            body_en="Advanced lesson in comprehension and analytical understanding.",
            difficulty="INTERMEDIATE",
            is_active=True,
        )
        session.add_all([lesson1, lesson2])
        session.flush()

        # Add flashcards
        session.add(
            LessonFlashcard(
                lesson_id=lesson1.id,
                front_ar="كلمة",
                front_en="Word",
                back_ar="وحدة لغوية بمعنى",
                back_en="A linguistic unit with meaning",
            )
        )
        session.add(
            LessonFlashcard(
                lesson_id=lesson1.id,
                front_ar="جملة",
                front_en="Sentence",
                back_ar="مجموعة كلمات لها معنى كامل",
                back_en="A group of words with complete meaning",
            )
        )

        # Add reading games
        session.add(
            LessonReadingGame(
                lesson_id=lesson1.id,
                name_ar="لعبة الكلمات",
                name_en="Word Game",
                objective_ar="تحديد الكلمات بسرعة",
                objective_en="Identify words quickly",
                words_json=["قراءة", "كتاب", "درس"],
            )
        )

        # Add student screening
        session.add(
            StudentScreening(
                user_id=demo_student.id,
                focus_score=60,
                reading_score=65,
                memory_score=70,
                support_level="MEDIUM",
                indicators_json={
                    "focus": 60,
                    "reading": 65,
                    "memory": 70,
                    "policy": "educational_signals_only_no_diagnosis",
                },
            )
        )
        session.flush()

        # === Quiz Module ===
        quiz1 = Quiz(
            title_ar="اختبار عربي تمهيدي",
            title_en="Arabic Starter Quiz",
            difficulty="EASY",
            reward_points=15,
            reward_xp=30,
            is_active=True,
        )
        session.add(quiz1)
        session.flush()

        q1 = QuizQuestion(
            quiz_id=quiz1.id,
            prompt_ar="ما هو الحرف الأول في الأبجدية العربية؟",
            prompt_en="What is the first letter of Arabic alphabet?",
            options_json=[
                {"key": "A", "text_ar": "أ", "text_en": "Alif"},
                {"key": "B", "text_ar": "ب", "text_en": "Ba"},
                {"key": "C", "text_ar": "ت", "text_en": "Ta"},
            ],
            correct_option="A",
            explanation_ar="الحرف الأول هو الألف",
            explanation_en="The first letter is Alif",
        )
        q2 = QuizQuestion(
            quiz_id=quiz1.id,
            prompt_ar="اختر الكلمة ذات المعنى الصحيح",
            prompt_en="Choose the word with correct meaning",
            options_json=[
                {"key": "A", "text_ar": "تفاحة", "text_en": "Apple"},
                {"key": "B", "text_ar": "قلم", "text_en": "Pen"},
                {"key": "C", "text_ar": "كتاب", "text_en": "Book"},
            ],
            correct_option="A",
            explanation_ar="التفاحة هي فاكهة حمراء لذيذة",
            explanation_en="Apple is a delicious red fruit",
        )
        session.add_all([q1, q2])
        session.flush()

        # === Library Module ===
        book1 = Book(
            title_ar="ألف ليلة وليلة",
            title_en="Arabian Nights",
            author_ar="مجهول",
            author_en="Unknown",
            summary_ar="قصص خيالية عربية تقليدية",
            summary_en="Traditional Arabic fantasy stories",
            reader_url="https://cdn.learnable.test/books/arabian-nights",
            points_cost=10,
            is_active=True,
        )
        book2 = Book(
            title_ar="قصة الصياد والسمكة الذهبية",
            title_en="The Fisherman and the Golden Fish",
            author_ar="أحمد العريان",
            author_en="Ahmad Al-Areyan",
            summary_ar="قصة حكائية للأطفال",
            summary_en="A narrative story for children",
            reader_url="https://cdn.learnable.test/books/fisherman-goldfish",
            points_cost=8,
            is_active=True,
        )
        session.add_all([book1, book2])
        session.flush()

        # === Teacher Module ===
        assistance = TeacherAssistanceRequest(
            student_user_id=demo_student.id,
            tutor_user_id=demo_tutor.id,
            topic="شرح درس القراءة",
            message="أحتاج مساعدة في فهم الجزء الثاني من الدرس",
            status="PENDING",
        )
        session.add(assistance)
        session.flush()

        feedback_prompt = StudentFeedbackPrompt(
            student_user_id=demo_student.id,
            prompt_ar="كيف تشعر تجاه الدرس اليوم؟",
            prompt_en="How do you feel about today's lesson?",
            prompt_type="emotional",
            is_active=True,
        )
        session.add(feedback_prompt)
        session.flush()

        # === Forum Module ===
        forum_space = ForumSpace(
            slug="demo-ar-space",
            name_ar="مساحة النقاش التجريبية",
            name_en="Demo Discussion Space",
            description_ar="مساحة لنقاش الدروس والمحتوى التعليمي",
            description_en="Space for discussing lessons and educational content",
            is_active=True,
        )
        session.add(forum_space)
        session.flush()

        forum_post = ForumPost(
            space_id=forum_space.id,
            author_user_id=demo_student.id,
            title="سؤال عن درس القراءة",
            content="هل يمكنني الحصول على توضيح حول المفردات الجديدة في الدرس؟",
            status="ACTIVE",
            is_locked=False,
            upvotes=2,
            downvotes=0,
        )
        session.add(forum_post)
        session.flush()

        forum_comment = ForumComment(
            post_id=forum_post.id,
            author_user_id=demo_tutor.id,
            content="بالتأكيد! المفردات الجديدة موضحة في قاموس الدرس.",
            status="ACTIVE",
            upvotes=1,
            downvotes=0,
        )
        session.add(forum_comment)
        session.flush()

        # === Psychologist Module ===
        questionnaire = TeacherQuestionnaire(
            student_user_id=demo_student.id,
            tutor_user_id=demo_tutor.id,
            attention_score=65,
            engagement_score=75,
            notes="الطالب يظهر تركيزاً جيداً ومشاركة نشطة في الفصل",
            cadence_days=14,
        )
        session.add(questionnaire)
        session.flush()

        support_confirmation = PsychologistSupportConfirmation(
            student_user_id=demo_student.id,
            psychologist_user_id=demo_psychologist.id,
            support_level="MEDIUM",
            notes="خطة دعم تعليمية موصى بها للمتعلم",
        )
        session.add(support_confirmation)
        session.flush()

        # === Notifications Module ===
        notification = Notification(
            user_id=demo_parent.id,
            type="PSYCHOLOGIST_SUPPORT_CONFIRMED",
            title="تأكيد خطة الدعم التعليمية",
            body="تم تأكيد خطة دعم تعليمية للطالب من قبل المختص النفسي",
            metadata_json={
                "student_user_id": str(demo_student.id),
                "support_level": "MEDIUM",
                "title_en": "Educational support plan confirmed",
                "body_en": "The psychologist has confirmed an educational support plan for the student",
            },
            is_read=False,
        )
        session.add(notification)
        session.flush()

        # === Gamification Module ===
        # Placeholder: GameMilestone model not yet implemented
        # session.add(milestone)
        session.flush()

        session.commit()

        print(f"✅ Seed data created successfully (Arabic).")
        print(f"   Student: {demo_student.id} ({demo_student.email})")
        print(f"   Tutor: {demo_tutor.id} ({demo_tutor.email})")
        print(f"   Parent: {demo_parent.id} ({demo_parent.email})")
        print(f"   Psychologist: {demo_psychologist.id} ({demo_psychologist.email})")
        print(f"   Admin: {demo_admin.id} ({demo_admin.email})")

    except Exception as e:
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
