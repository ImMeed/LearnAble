"""
Phase 10: Bilingual Demo Data Seed (English Primary)

Populates LearnAble with comprehensive demo data covering all roles and modules:
- Users: student, tutor, parent, psychologist, admin (EN)
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
        existing = session.scalar(select(User).where(User.email.like("%demo-en%")).limit(1))
        if existing is not None:
            print("Seed data skipped: demo data already exists.")
            return

        print("🌱 Seeding Phase 10 demo data (English)...")

        # === Create users for all roles (English) ===
        demo_student = User(
            email="demo-student-en@learnable.test",
            password_hash="demo_hash_en",
            role=UserRole.ROLE_STUDENT,
        )
        demo_tutor = User(
            email="demo-tutor-en@learnable.test",
            password_hash="demo_hash_en",
            role=UserRole.ROLE_TUTOR,
        )
        demo_parent = User(
            email="demo-parent-en@learnable.test",
            password_hash="demo_hash_en",
            role=UserRole.ROLE_PARENT,
        )
        demo_psychologist = User(
            email="demo-psychologist-en@learnable.test",
            password_hash="demo_hash_en",
            role=UserRole.ROLE_PSYCHOLOGIST,
        )
        demo_admin = User(
            email="demo-admin-en@learnable.test",
            password_hash="demo_hash_en",
            role=UserRole.ROLE_ADMIN,
        )
        session.add_all([demo_student, demo_tutor, demo_parent, demo_psychologist, demo_admin])
        session.flush()

        # === Create relationships ===
        session.add(StudentParentLink(student_user_id=demo_student.id, parent_user_id=demo_parent.id))
        session.add(StudentPsychologistLink(student_user_id=demo_student.id, psychologist_user_id=demo_psychologist.id))
        session.flush()

        # === Create economy records ===
        session.add(PointsWallet(user_id=demo_student.id, balance_points=150))
        session.add(XpLedger(user_id=demo_student.id, earned_xp=75))
        session.add(XpLedger(user_id=demo_tutor.id, earned_xp=250))
        session.flush()

        # === Study Module ===
        lesson1 = Lesson(
            title_ar="فهم النصوص التحليلي",
            title_en="Reading Comprehension",
            body_ar="محتوى متقدم في فهم وتحليل النصوص المقروءة.",
            body_en="Advanced content in understanding and analyzing read texts.",
            difficulty="INTERMEDIATE",
            is_active=True,
        )
        lesson2 = Lesson(
            title_ar="مهارات الكتابة الأساسية",
            title_en="Writing Fundamentals",
            body_ar="دليل عملي لتطوير مهارات الكتابة من الصفر.",
            body_en="Practical guide for developing writing skills from basics.",
            difficulty="BEGINNER",
            is_active=True,
        )
        session.add_all([lesson1, lesson2])
        session.flush()

        # Add flashcards
        session.add(
            LessonFlashcard(
                lesson_id=lesson1.id,
                front_ar="مقالة",
                front_en="Article",
                back_ar="نص منشور في صحيفة أو مجلة",
                back_en="Text published in a newspaper or magazine",
            )
        )
        session.add(
            LessonFlashcard(
                lesson_id=lesson1.id,
                front_ar="موضوع رئيسي",
                front_en="Main Topic",
                back_ar="الفكرة المركزية في النص",
                back_en="The central idea in the text",
            )
        )

        # Add reading games
        session.add(
            LessonReadingGame(
                lesson_id=lesson1.id,
                name_ar="لعبة فهم المعنى",
                name_en="Meaning Comprehension Game",
                objective_ar="فهم الجمل المعقدة",
                objective_en="Understand complex sentences",
                words_json=["comprehension", "analyze", "understand"],
            )
        )

        # Add student screening
        session.add(
            StudentScreening(
                user_id=demo_student.id,
                focus_score=72,
                reading_score=78,
                memory_score=75,
                support_level="LOW",
                indicators_json={
                    "focus": 72,
                    "reading": 78,
                    "memory": 75,
                    "policy": "educational_signals_only_no_diagnosis",
                },
            )
        )
        session.flush()

        # === Quiz Module ===
        quiz1 = Quiz(
            title_ar="اختبار الفهم الإنجليزي",
            title_en="English Comprehension Test",
            difficulty="INTERMEDIATE",
            reward_points=20,
            reward_xp=40,
            is_active=True,
        )
        session.add(quiz1)
        session.flush()

        q1 = QuizQuestion(
            quiz_id=quiz1.id,
            prompt_ar="ما معنى كلمة 'بسيط'؟",
            prompt_en="What does 'simple' mean?",
            options_json=[
                {"key": "A", "text_ar": "سهل الفهم", "text_en": "Easy to understand"},
                {"key": "B", "text_ar": "معقد جداً", "text_en": "Very complex"},
                {"key": "C", "text_ar": "غير واضح", "text_en": "Unclear"},
            ],
            correct_option="A",
            explanation_ar="كلمة بسيط تعني سهل الفهم",
            explanation_en="Simple means easy to understand",
        )
        q2 = QuizQuestion(
            quiz_id=quiz1.id,
            prompt_ar="ما هو الفاعل في الجملة؟",
            prompt_en="Who is the subject of the sentence?",
            options_json=[
                {"key": "A", "text_ar": "الشمس", "text_en": "The sun"},
                {"key": "B", "text_ar": "التلميذ", "text_en": "The student"},
                {"key": "C", "text_ar": "الكتاب", "text_en": "The book"},
            ],
            correct_option="B",
            explanation_ar="التلميذ هو الفاعل الذي يقوم بالعمل",
            explanation_en="The student is the subject performing the action",
        )
        session.add_all([q1, q2])
        session.flush()

        # === Library Module ===
        book1 = Book(
            title_ar="الأمير الصغير",
            title_en="The Little Prince",
            author_ar="أنطوان دو سانت إكزوبيري",
            author_en="Antoine de Saint-Exupery",
            summary_ar="رواية خيالية للأطفال والكبار",
            summary_en="A fantasy novel for children and adults",
            reader_url="https://cdn.learnable.test/books/little-prince",
            points_cost=12,
            is_active=True,
        )
        book2 = Book(
            title_ar="جزيرة الكنز",
            title_en="Treasure Island",
            author_ar="روبير لويس ستيفنسون",
            author_en="Robert Louis Stevenson",
            summary_ar="مغامرة ذهب وبحار وقراصنة",
            summary_en="An adventure of gold, seas, and pirates",
            reader_url="https://cdn.learnable.test/books/treasure-island",
            points_cost=10,
            is_active=True,
        )
        session.add_all([book1, book2])
        session.flush()

        # === Teacher Module ===
        assistance = TeacherAssistanceRequest(
            student_user_id=demo_student.id,
            tutor_user_id=demo_tutor.id,
            topic="Comprehension Strategy",
            message="Can you help me with identifying the main idea in complex texts?",
            status="PENDING",
        )
        session.add(assistance)
        session.flush()

        feedback_prompt = StudentFeedbackPrompt(
            student_user_id=demo_student.id,
            prompt_ar="هل استمتعت بالدرس؟",
            prompt_en="Did you enjoy the lesson?",
            prompt_type="emotional",
            is_active=True,
        )
        session.add(feedback_prompt)
        session.flush()

        # === Forum Module ===
        forum_space = ForumSpace(
            slug="demo-en-space",
            name_ar="مساحة النقاش الإنجليزية",
            name_en="English Discussion Space",
            description_ar="مساحة لنقاش المواضيع الإنجليزية",
            description_en="Space for discussing English topics",
            is_active=True,
        )
        session.add(forum_space)
        session.flush()

        forum_post = ForumPost(
            space_id=forum_space.id,
            author_user_id=demo_student.id,
            title="Question about English Grammar",
            content="Can someone explain the difference between present and past tense?",
            status="ACTIVE",
            is_locked=False,
            upvotes=3,
            downvotes=0,
        )
        session.add(forum_post)
        session.flush()

        forum_comment = ForumComment(
            post_id=forum_post.id,
            author_user_id=demo_tutor.id,
            content="Great question! Present tense describes current actions, while past tense describes completed actions.",
            status="ACTIVE",
            upvotes=2,
            downvotes=0,
        )
        session.add(forum_comment)
        session.flush()

        # === Psychologist Module ===
        questionnaire = TeacherQuestionnaire(
            student_user_id=demo_student.id,
            tutor_user_id=demo_tutor.id,
            attention_score=75,
            engagement_score=80,
            notes="Student demonstrates good focus and active participation in class discussions.",
            cadence_days=14,
        )
        session.add(questionnaire)
        session.flush()

        support_confirmation = PsychologistSupportConfirmation(
            student_user_id=demo_student.id,
            psychologist_user_id=demo_psychologist.id,
            support_level="LOW",
            notes="Student demonstrates strong academic performance. Minimal support intervention recommended.",
        )
        session.add(support_confirmation)
        session.flush()

        # === Notifications Module ===
        notification = Notification(
            user_id=demo_parent.id,
            type="PSYCHOLOGIST_SUPPORT_CONFIRMED",
            title="Support Plan Confirmed",
            body="The psychologist has confirmed an educational support plan for your child.",
            metadata_json={
                "student_user_id": str(demo_student.id),
                "support_level": "LOW",
                "title_ar": "تأكيد خطة الدعم التعليمية",
                "body_ar": "تم تأكيد خطة دعم تعليمية للطالب من قبل المختص النفسي",
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

        print(f"✅ Seed data created successfully (English).")
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
