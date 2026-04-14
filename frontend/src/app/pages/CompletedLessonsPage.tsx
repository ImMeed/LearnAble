import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

type CompletedLesson = {
  id: string;
  subject: string;
  title: string;
  completedDate: string;
  score: number;
  timeSpent: number;
  xpEarned: number;
};

const COMPLETED_LESSONS: CompletedLesson[] = [
  {
    id: "l1",
    subject: "Science",
    title: "Ecosystem Basics",
    completedDate: "28/03/2026",
    score: 95,
    timeSpent: 45,
    xpEarned: 200,
  },
  {
    id: "l2",
    subject: "English",
    title: "Grammar Fundamentals",
    completedDate: "25/03/2026",
    score: 88,
    timeSpent: 38,
    xpEarned: 180,
  },
  {
    id: "l3",
    subject: "Math",
    title: "Basic Geometry",
    completedDate: "22/03/2026",
    score: 92,
    timeSpent: 52,
    xpEarned: 190,
  },
  {
    id: "l4",
    subject: "History",
    title: "Ancient Civilizations",
    completedDate: "18/03/2026",
    score: 78,
    timeSpent: 42,
    xpEarned: 155,
  },
  {
    id: "l5",
    subject: "Science",
    title: "The Water Cycle",
    completedDate: "14/03/2026",
    score: 90,
    timeSpent: 35,
    xpEarned: 200,
  },
];

const SUBJECT_COLORS: Record<string, string> = {
  Science: "#4A90E2",
  English: "#9B59B6",
  Math: "#27AE60",
  History: "#E67E22",
};

function scoreColor(score: number): string {
  if (score >= 90) return "var(--secondary)";
  if (score >= 75) return "var(--primary)";
  return "var(--destructive)";
}

export function CompletedLessonsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const totalXP = COMPLETED_LESSONS.reduce((sum, l) => sum + l.xpEarned, 0);
  const avgScore = Math.round(COMPLETED_LESSONS.reduce((sum, l) => sum + l.score, 0) / COMPLETED_LESSONS.length);
  const totalTime = COMPLETED_LESSONS.reduce((sum, l) => sum + l.timeSpent, 0);

  return (
    <main className="page dashboard-page">
      <header className="portal-topbar">
        <button type="button" className="topbar-back" onClick={() => navigate(-1)} aria-label="Back">
          ‹
        </button>
        <div className="topbar-title-group">
          <span className="topbar-icon lessons-icon">✅</span>
          <div>
            <h1 className="topbar-title">{t("lessons.title", { defaultValue: "Completed Lessons" })}</h1>
            <p className="topbar-subtitle">{t("lessons.subtitle", { defaultValue: "Your learning achievements" })}</p>
          </div>
        </div>
      </header>

      <div className="lessons-stats-row">
        <article className="lessons-stat-card">
          <span className="lessons-stat-icon">📖</span>
          <p className="lessons-stat-label">{t("lessons.statTotal", { defaultValue: "Total Completed" })}</p>
          <p className="lessons-stat-value">{COMPLETED_LESSONS.length}</p>
        </article>
        <article className="lessons-stat-card">
          <span className="lessons-stat-icon">🏅</span>
          <p className="lessons-stat-label">{t("lessons.statAvg", { defaultValue: "Average Score" })}</p>
          <p className="lessons-stat-value" style={{ color: "var(--accent)" }}>{avgScore}%</p>
        </article>
        <article className="lessons-stat-card">
          <span className="lessons-stat-icon">✅</span>
          <p className="lessons-stat-label">{t("lessons.statXP", { defaultValue: "Total XP" })}</p>
          <p className="lessons-stat-value" style={{ color: "var(--secondary)" }}>{totalXP}</p>
        </article>
        <article className="lessons-stat-card">
          <span className="lessons-stat-icon">🕐</span>
          <p className="lessons-stat-label">{t("lessons.statTime", { defaultValue: "Time Spent" })}</p>
          <p className="lessons-stat-value" style={{ color: "var(--primary)" }}>{totalTime}m</p>
        </article>
      </div>

      <h2 className="lessons-section-title">{t("lessons.allCompleted", { defaultValue: "All Completed Lessons" })}</h2>

      <div className="lessons-list">
        {COMPLETED_LESSONS.map((lesson) => (
          <article key={lesson.id} className="lesson-result-card">
            <div className="lesson-result-header">
              <div>
                <p
                  className="lesson-result-subject"
                  style={{ color: SUBJECT_COLORS[lesson.subject] ?? "var(--primary)" }}
                >
                  {lesson.subject}
                </p>
                <h3 className="lesson-result-title">{lesson.title}</h3>
              </div>
            </div>

            <div className="lesson-result-meta">
              <div>
                <p className="lesson-meta-label">{t("lessons.metaCompleted", { defaultValue: "Completed" })}</p>
                <p className="lesson-meta-value">{lesson.completedDate}</p>
              </div>
              <div>
                <p className="lesson-meta-label">{t("lessons.metaScore", { defaultValue: "Score" })}</p>
                <p className="lesson-meta-value" style={{ color: scoreColor(lesson.score) }}>
                  {lesson.score}%
                </p>
              </div>
              <div>
                <p className="lesson-meta-label">{t("lessons.metaTime", { defaultValue: "Time Spent" })}</p>
                <p className="lesson-meta-value">{lesson.timeSpent} minutes</p>
              </div>
              <div>
                <p className="lesson-meta-label">{t("lessons.metaXP", { defaultValue: "XP Earned" })}</p>
                <p className="lesson-meta-value" style={{ color: "var(--accent)" }}>+{lesson.xpEarned}</p>
              </div>
            </div>

            <div className="lesson-progress-bar-wrap">
              <div
                className="lesson-progress-bar-fill"
                style={{ width: `${lesson.score}%` }}
              />
            </div>

            <div className="lesson-result-actions">
              <button type="button" className="btn-primary">
                {t("lessons.review", { defaultValue: "Review Lesson" })}
              </button>
              <button type="button" className="btn-outline">
                {t("lessons.certificate", { defaultValue: "View Certificate" })}
              </button>
              <button type="button" className="btn-outline">
                {t("lessons.retake", { defaultValue: "Retake Quiz" })}
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
