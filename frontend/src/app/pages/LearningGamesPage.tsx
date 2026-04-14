import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

type Game = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  subject: string;
  xp: number;
  highScore?: number;
  completed?: boolean;
};

const GAMES: Game[] = [
  {
    id: "word-match",
    emoji: "📝",
    title: "Word Match Challenge",
    description: "Match words with their definitions in this fun memory game",
    difficulty: "easy",
    subject: "Reading",
    xp: 50,
    highScore: 850,
    completed: true,
  },
  {
    id: "math-quest",
    emoji: "🔢",
    title: "Math Quest",
    description: "Solve math problems on an exciting adventure",
    difficulty: "medium",
    subject: "Math",
    xp: 75,
  },
  {
    id: "letter-detective",
    emoji: "🔍",
    title: "Letter Detective",
    description: "Find and identify letters in a colorful scene",
    difficulty: "easy",
    subject: "Reading",
    xp: 40,
    highScore: 720,
    completed: true,
  },
  {
    id: "sequence-master",
    emoji: "🎯",
    title: "Sequence Master",
    description: "Remember and repeat patterns to level up",
    difficulty: "medium",
    subject: "Memory",
    xp: 60,
  },
  {
    id: "story-builder",
    emoji: "📖",
    title: "Story Builder",
    description: "Create sentences by arranging words in the correct order",
    difficulty: "easy",
    subject: "Reading",
    xp: 45,
  },
  {
    id: "focus-flow",
    emoji: "🧘",
    title: "Focus Flow",
    description: "Practice concentration with calming visual tasks",
    difficulty: "easy",
    subject: "Focus",
    xp: 35,
    highScore: 650,
    completed: true,
  },
  {
    id: "number-ninja",
    emoji: "⚡",
    title: "Number Ninja",
    description: "Quick mental math challenges to sharpen your skills",
    difficulty: "hard",
    subject: "Math",
    xp: 100,
  },
  {
    id: "spelling-bee",
    emoji: "🐝",
    title: "Spelling Bee",
    description: "Spell words correctly to earn points and unlock levels",
    difficulty: "medium",
    subject: "English",
    xp: 55,
  },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "tag-easy",
  medium: "tag-medium",
  hard: "tag-hard",
};

export function LearningGamesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  const completed = GAMES.filter((g) => g.completed).length;
  const totalXP = GAMES.filter((g) => g.completed).reduce((sum, g) => sum + g.xp, 0);

  const filtered = GAMES.filter((g) => {
    const diffOk = difficultyFilter === "all" || g.difficulty === difficultyFilter;
    const subOk = subjectFilter === "all" || g.subject === subjectFilter;
    return diffOk && subOk;
  });

  const subjects = Array.from(new Set(GAMES.map((g) => g.subject)));

  return (
    <main className="page dashboard-page">
      <header className="portal-topbar">
        <button type="button" className="topbar-back" onClick={() => navigate(-1)} aria-label="Back">
          ‹
        </button>
        <div className="topbar-title-group">
          <span className="topbar-icon">🎮</span>
          <div>
            <h1 className="topbar-title">{t("games.title", { defaultValue: "Learning Games" })}</h1>
            <p className="topbar-subtitle">{t("games.subtitle", { defaultValue: "Fun ways to practice!" })}</p>
          </div>
        </div>
      </header>

      <div className="games-stats-row">
        <article className="games-stat-card stat-green">
          <span className="games-stat-icon">🏆</span>
          <div>
            <p className="games-stat-label">{t("games.statCompleted", { defaultValue: "Games Completed" })}</p>
            <p className="games-stat-value">
              {completed} / {GAMES.length}
            </p>
          </div>
        </article>
        <article className="games-stat-card stat-purple">
          <span className="games-stat-icon">⭐</span>
          <div>
            <p className="games-stat-label">{t("games.statXP", { defaultValue: "Total XP Earned" })}</p>
            <p className="games-stat-value games-xp">{totalXP} XP</p>
          </div>
        </article>
        <article className="games-stat-card stat-blue">
          <span className="games-stat-icon">🕹️</span>
          <div>
            <p className="games-stat-label">{t("games.statAvailable", { defaultValue: "Available Games" })}</p>
            <p className="games-stat-value games-available">{GAMES.length}</p>
          </div>
        </article>
      </div>

      <div className="games-filters">
        <div className="filter-group">
          <label className="filter-label">{t("games.difficulty", { defaultValue: "Difficulty" })}</label>
          <select
            className="filter-select"
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
          >
            <option value="all">{t("games.allLevels", { defaultValue: "All Levels" })}</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label">{t("games.subject", { defaultValue: "Subject" })}</label>
          <select
            className="filter-select"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
          >
            <option value="all">{t("games.allSubjects", { defaultValue: "All Subjects" })}</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="games-grid">
        {filtered.map((game) => (
          <article key={game.id} className={`game-card${game.completed ? " game-card-completed" : ""}`}>
            {game.completed && (
              <div className="game-completed-badge">
                <span>🏆</span> {t("games.completed", { defaultValue: "Completed" })}
              </div>
            )}
            <div className="game-card-emoji">{game.emoji}</div>
            <h3 className="game-card-title">{game.title}</h3>
            <p className="game-card-desc">{game.description}</p>
            <div className="game-card-tags">
              <span className={`game-tag ${DIFFICULTY_COLORS[game.difficulty]}`}>{game.difficulty}</span>
              <span className="game-tag tag-subject">{game.subject}</span>
              <span className="game-tag tag-xp">⭐ {game.xp} XP</span>
            </div>
            {game.highScore !== undefined && (
              <p className="game-high-score">
                {t("games.highScore", { defaultValue: "High Score:" })} <strong>{game.highScore}</strong>
              </p>
            )}
            <button type="button" className="btn-primary game-btn">
              ▷ {game.completed ? t("games.playAgain", { defaultValue: "Play Again" }) : t("games.startGame", { defaultValue: "Start Game" })}
            </button>
          </article>
        ))}
      </div>
    </main>
  );
}
