import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

type QuizSubject = {
  id: string;
  label: string;
  emoji: string;
  questionCount: number;
};

type Question = {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

const QUIZ_SUBJECTS: QuizSubject[] = [
  { id: "math", label: "Math", emoji: "🔢", questionCount: 3 },
  { id: "science", label: "Science", emoji: "🔬", questionCount: 3 },
  { id: "history", label: "History", emoji: "📚", questionCount: 3 },
];

const QUESTIONS: Record<string, Question[]> = {
  math: [
    {
      id: "mq1",
      question: "What is 12 × 8?",
      options: ["86", "96", "104", "116"],
      correct: 1,
      explanation: "12 × 8 = 96. You can think of it as 12 × 8 = (10 × 8) + (2 × 8) = 80 + 16 = 96.",
    },
    {
      id: "mq2",
      question: "What is the square root of 144?",
      options: ["10", "11", "12", "14"],
      correct: 2,
      explanation: "√144 = 12, because 12 × 12 = 144.",
    },
    {
      id: "mq3",
      question: "If a triangle has angles 45°, 45°, and x°, what is x?",
      options: ["45°", "60°", "90°", "120°"],
      correct: 2,
      explanation: "The angles of a triangle sum to 180°. So x = 180 - 45 - 45 = 90°.",
    },
  ],
  science: [
    {
      id: "sq1",
      question: "What is the chemical symbol for water?",
      options: ["HO", "H₂O", "H₂O₂", "OH"],
      correct: 1,
      explanation: "Water is H₂O — two hydrogen atoms bonded to one oxygen atom.",
    },
    {
      id: "sq2",
      question: "Which planet is closest to the Sun?",
      options: ["Venus", "Earth", "Mercury", "Mars"],
      correct: 2,
      explanation: "Mercury is the closest planet to the Sun, at an average distance of about 58 million km.",
    },
    {
      id: "sq3",
      question: "What force keeps planets in orbit around the Sun?",
      options: ["Magnetism", "Gravity", "Friction", "Electrostatic force"],
      correct: 1,
      explanation: "Gravity is the force of attraction between masses, keeping planets in their orbital paths.",
    },
  ],
  history: [
    {
      id: "hq1",
      question: "In which year did the French Revolution begin?",
      options: ["1776", "1789", "1804", "1815"],
      correct: 1,
      explanation: "The French Revolution began in 1789 with the storming of the Bastille on July 14.",
    },
    {
      id: "hq2",
      question: "Who was the first person to walk on the Moon?",
      options: ["Buzz Aldrin", "Yuri Gagarin", "Neil Armstrong", "Alan Shepard"],
      correct: 2,
      explanation: "Neil Armstrong became the first human to walk on the Moon on July 20, 1969, during Apollo 11.",
    },
    {
      id: "hq3",
      question: "Which ancient wonder was located in Alexandria?",
      options: ["The Colossus", "The Lighthouse", "The Mausoleum", "The Hanging Gardens"],
      correct: 1,
      explanation: "The Lighthouse of Alexandria (Pharos) was one of the Seven Wonders of the Ancient World.",
    },
  ],
};

type Phase = "select" | "quiz" | "result";

export function QuizCenterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("select");
  const [selectedSubject, setSelectedSubject] = useState<string>("math");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const questions = QUESTIONS[selectedSubject] ?? [];
  const question = questions[currentQ];
  const subject = QUIZ_SUBJECTS.find((s) => s.id === selectedSubject)!;

  const startQuiz = () => {
    setCurrentQ(0);
    setAnswers([]);
    setChosen(null);
    setShowExplanation(false);
    setPhase("quiz");
  };

  const selectOption = (idx: number) => {
    if (chosen !== null) return;
    setChosen(idx);
    setShowExplanation(true);
  };

  const next = () => {
    const newAnswers = [...answers, chosen];
    if (currentQ + 1 >= questions.length) {
      setAnswers(newAnswers);
      setPhase("result");
    } else {
      setAnswers(newAnswers);
      setCurrentQ((q) => q + 1);
      setChosen(null);
      setShowExplanation(false);
    }
  };

  const score = answers.filter((a, i) => a === questions[i]?.correct).length;

  if (phase === "result") {
    return (
      <main className="page dashboard-page quiz-page">
        <header className="portal-topbar">
          <button type="button" className="topbar-back" onClick={() => setPhase("select")} aria-label="Back">‹</button>
          <div className="topbar-title-group">
            <span className="topbar-icon">🏆</span>
            <div>
              <h1 className="topbar-title">{t("quiz.resultsTitle", { defaultValue: "Quiz Results" })}</h1>
            </div>
          </div>
        </header>
        <div className="quiz-result-card">
          <p className="quiz-result-emoji">{score === questions.length ? "🎉" : score >= questions.length / 2 ? "👍" : "💪"}</p>
          <h2 className="quiz-result-score">{score} / {questions.length}</h2>
          <p className="quiz-result-label">
            {score === questions.length ? "Perfect score!" : score >= questions.length / 2 ? "Good job!" : "Keep practising!"}
          </p>
          <div className="quiz-result-actions">
            <button type="button" className="btn-primary" onClick={startQuiz}>
              {t("quiz.tryAgain", { defaultValue: "Try Again" })}
            </button>
            <button type="button" className="btn-outline" onClick={() => setPhase("select")}>
              {t("quiz.changeSubject", { defaultValue: "Change Subject" })}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (phase === "quiz" && question) {
    return (
      <main className="page dashboard-page quiz-page">
        <header className="portal-topbar">
          <button type="button" className="topbar-back" onClick={() => setPhase("select")} aria-label="Back">‹</button>
          <div className="topbar-title-group">
            <span className="topbar-icon">🏆</span>
            <div>
              <h1 className="topbar-title">{subject.label} Quiz</h1>
              <p className="topbar-subtitle">{currentQ + 1} / {questions.length}</p>
            </div>
          </div>
        </header>
        <div className="quiz-progress-bar-wrap">
          <div className="quiz-progress-fill" style={{ width: `${((currentQ) / questions.length) * 100}%` }} />
        </div>
        <div className="quiz-question-card">
          <p className="quiz-q-number">Question {currentQ + 1}</p>
          <h2 className="quiz-q-text">{question.question}</h2>
          <div className="quiz-options">
            {question.options.map((opt, i) => {
              let cls = "quiz-option";
              if (chosen !== null) {
                if (i === question.correct) cls += " correct";
                else if (i === chosen && chosen !== question.correct) cls += " wrong";
              }
              return (
                <button key={i} type="button" className={cls} onClick={() => selectOption(i)} disabled={chosen !== null}>
                  <span className="quiz-option-letter">{String.fromCharCode(65 + i)}</span>
                  {opt}
                </button>
              );
            })}
          </div>
          {showExplanation && (
            <div className="quiz-explanation">
              <p className="quiz-explanation-label">💡 Explanation</p>
              <p>{question.explanation}</p>
            </div>
          )}
          {chosen !== null && (
            <button type="button" className="btn-primary quiz-next-btn" onClick={next}>
              {currentQ + 1 < questions.length
                ? t("quiz.next", { defaultValue: "Next Question →" })
                : t("quiz.finish", { defaultValue: "See Results →" })}
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="page dashboard-page quiz-page">
      <header className="portal-topbar">
        <button type="button" className="topbar-back" onClick={() => navigate(-1)} aria-label="Back">‹</button>
        <div className="topbar-title-group">
          <span className="topbar-icon">🏆</span>
          <div>
            <h1 className="topbar-title">{t("quiz.title", { defaultValue: "Quiz Center" })}</h1>
            <p className="topbar-subtitle">{t("quiz.subtitle", { defaultValue: "Test your knowledge" })}</p>
          </div>
        </div>
      </header>

      <h2 className="quiz-choose-title">{t("quiz.chooseSubject", { defaultValue: "Choose Your Subject" })}</h2>
      <p className="quiz-choose-sub">{t("quiz.selectToStart", { defaultValue: "Select a subject to start your quiz" })}</p>

      <div className="quiz-subject-grid">
        {QUIZ_SUBJECTS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`quiz-subject-card${selectedSubject === s.id ? " selected" : ""}`}
            onClick={() => setSelectedSubject(s.id)}
          >
            <span className="quiz-subject-emoji">{s.emoji}</span>
            <p className="quiz-subject-label">{s.label}</p>
            <p className="quiz-subject-count">{s.questionCount} questions</p>
          </button>
        ))}
      </div>

      <div className="quiz-info-card">
        <h3 className="quiz-info-title">{t("quiz.infoTitle", { defaultValue: "Quiz Information" })}</h3>
        <ul className="quiz-info-list">
          <li>• {questions.length} multiple choice questions</li>
          <li>• No time limit — learn at your pace</li>
          <li>• Detailed explanations for each answer</li>
          <li>• Track your progress and improve</li>
        </ul>
        <button type="button" className="btn-primary quiz-start-btn" onClick={startQuiz}>
          {t("quiz.start", { defaultValue: `Start ${subject?.label ?? ""} Quiz` })}
        </button>
      </div>
    </main>
  );
}
