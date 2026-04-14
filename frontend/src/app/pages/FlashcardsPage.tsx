import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

type Flashcard = {
  id: string;
  subject: string;
  question: string;
  answer: string;
};

const ALL_CARDS: Flashcard[] = [
  { id: "m1", subject: "Math", question: "What is the Pythagorean theorem?", answer: "a² + b² = c², where c is the hypotenuse of a right triangle." },
  { id: "m2", subject: "Math", question: "What is the formula for the area of a circle?", answer: "A = πr², where r is the radius." },
  { id: "m3", subject: "Math", question: "What is a prime number?", answer: "A number greater than 1 that has no divisors other than 1 and itself." },
  { id: "s1", subject: "Science", question: "What is photosynthesis?", answer: "The process by which plants convert sunlight, water, and CO₂ into glucose and oxygen." },
  { id: "s2", subject: "Science", question: "What is Newton's first law of motion?", answer: "An object at rest stays at rest, and an object in motion stays in motion unless acted upon by an external force." },
  { id: "s3", subject: "Science", question: "What is the speed of light?", answer: "Approximately 299,792,458 metres per second (3×10⁸ m/s) in a vacuum." },
  { id: "h1", subject: "History", question: "When did World War II end?", answer: "September 2, 1945, with the formal surrender of Japan." },
  { id: "h2", subject: "History", question: "Who was the first President of the United States?", answer: "George Washington, who served from 1789 to 1797." },
  { id: "h3", subject: "History", question: "What was the Renaissance?", answer: "A cultural and intellectual movement in Europe from the 14th to 17th centuries, marked by a revival of classical learning." },
  { id: "e1", subject: "English", question: "What is a metaphor?", answer: "A figure of speech that describes something by saying it is something else, e.g. 'Life is a journey.'" },
  { id: "e2", subject: "English", question: "What is the difference between 'there', 'their', and 'they're'?", answer: "'There' = place; 'Their' = possessive; 'They're' = they are." },
  { id: "e3", subject: "English", question: "What is an adverb?", answer: "A word that modifies a verb, adjective, or another adverb, e.g. 'quickly', 'very', 'quite'." },
];

const SUBJECTS = ["All", "Math", "Science", "History", "English"];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function FlashcardsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [subject, setSubject] = useState("All");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<Set<string>>(new Set(["m1", "s1"]));
  const [cards, setCards] = useState(ALL_CARDS);

  const filtered = useMemo(
    () => (subject === "All" ? cards : cards.filter((c) => c.subject === subject)),
    [cards, subject],
  );

  const current = filtered[currentIndex];
  const mastered = masteredIds.size;
  const total = filtered.length;

  const goNext = () => {
    setFlipped(false);
    setCurrentIndex((i) => Math.min(i + 1, filtered.length - 1));
  };

  const goPrev = () => {
    setFlipped(false);
    setCurrentIndex((i) => Math.max(i - 1, 0));
  };

  const handleShuffle = () => {
    setCards(shuffle(ALL_CARDS));
    setCurrentIndex(0);
    setFlipped(false);
  };

  const handleReset = () => {
    setCards(ALL_CARDS);
    setCurrentIndex(0);
    setFlipped(false);
    setMasteredIds(new Set());
  };

  const handleSubject = (s: string) => {
    setSubject(s);
    setCurrentIndex(0);
    setFlipped(false);
  };

  const toggleMastered = () => {
    if (!current) return;
    setMasteredIds((prev) => {
      const next = new Set(prev);
      if (next.has(current.id)) next.delete(current.id);
      else next.add(current.id);
      return next;
    });
  };

  return (
    <main className="page dashboard-page">
      <header className="portal-topbar">
        <button type="button" className="topbar-back" onClick={() => navigate(-1)} aria-label="Back">
          ‹
        </button>
        <div className="topbar-title-group">
          <span className="topbar-icon">🗂️</span>
          <div>
            <h1 className="topbar-title">{t("flashcards.title", { defaultValue: "Flashcards" })}</h1>
            <p className="topbar-subtitle">{t("flashcards.subtitle", { defaultValue: "Master your subjects" })}</p>
          </div>
        </div>
      </header>

      <div className="flashcards-controls">
        <div className="flashcards-subject-tabs">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              className={`fc-tab${subject === s ? " fc-tab-active" : ""}`}
              onClick={() => handleSubject(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flashcards-actions">
          <button type="button" className="fc-action-btn fc-shuffle" onClick={handleShuffle}>
            ✨ {t("flashcards.shuffle", { defaultValue: "Shuffle" })}
          </button>
          <button type="button" className="fc-action-btn fc-reset" onClick={handleReset}>
            ↺ {t("flashcards.reset", { defaultValue: "Reset" })}
          </button>
        </div>
      </div>

      <div className="fc-progress-bar-wrap">
        <div className="fc-progress-header">
          <span className="fc-progress-label">{t("flashcards.progress", { defaultValue: "Progress" })}</span>
          <span className="fc-progress-count">{mastered} / {total} {t("flashcards.mastered", { defaultValue: "mastered" })}</span>
        </div>
        <div className="fc-progress-track">
          <div className="fc-progress-fill" style={{ width: `${total ? (mastered / total) * 100 : 0}%` }} />
        </div>
      </div>

      {current && (
        <>
          <p className="fc-card-counter">
            {t("flashcards.card", { defaultValue: "Card" })} {currentIndex + 1} {t("flashcards.of", { defaultValue: "of" })} {total}{" "}
            <span className="fc-card-subject">• {current.subject}</span>
          </p>

          <div
            className={`fc-card-container${flipped ? " flipped" : ""}`}
            onClick={() => setFlipped((f) => !f)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" || e.key === " " ? setFlipped((f) => !f) : undefined}
            aria-label={flipped ? "Click to see question" : "Click to reveal answer"}
          >
            <div className="fc-card-inner">
              <div className="fc-card-face fc-card-front">
                <p className="fc-card-side-label">{t("flashcards.question", { defaultValue: "QUESTION" })}</p>
                <p className="fc-card-text">{current.question}</p>
                <p className="fc-card-hint">{t("flashcards.clickReveal", { defaultValue: "Click to reveal answer" })}</p>
              </div>
              <div className="fc-card-face fc-card-back">
                <p className="fc-card-side-label">{t("flashcards.answer", { defaultValue: "ANSWER" })}</p>
                <p className="fc-card-text">{current.answer}</p>
                <button
                  type="button"
                  className={`fc-mastered-btn${masteredIds.has(current.id) ? " mastered" : ""}`}
                  onClick={(e) => { e.stopPropagation(); toggleMastered(); }}
                >
                  {masteredIds.has(current.id)
                    ? t("flashcards.unmarkMastered", { defaultValue: "✓ Mastered" })
                    : t("flashcards.markMastered", { defaultValue: "Mark as Mastered" })}
                </button>
              </div>
            </div>
          </div>

          <div className="fc-nav-row">
            <button
              type="button"
              className="fc-nav-btn"
              onClick={goPrev}
              disabled={currentIndex === 0}
            >
              ‹ {t("flashcards.previous", { defaultValue: "Previous" })}
            </button>
            <button
              type="button"
              className="fc-nav-btn"
              onClick={goNext}
              disabled={currentIndex === filtered.length - 1}
            >
              {t("flashcards.next", { defaultValue: "Next" })} ›
            </button>
          </div>
        </>
      )}
    </main>
  );
}
