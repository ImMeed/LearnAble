import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Brain, Gamepad2, Keyboard, Sigma, Star, Target, Trophy, Volume2, type LucideIcon } from "lucide-react";

import { apiClient } from "../../api/client";
import { READING_LAB_ENABLED } from "../features";
import { actionClass, cx, inputClass, surfaceClass } from "../components/uiStyles";
import { DashboardShell, errorMessage, localePrefix, localeRequestConfig } from "./roleDashboardShared";

type ApiGameItem = {
  key: string;
  title: string;
  description: string;
};

type Progression = {
  total_xp: number;
};

type GameDifficulty = "EASY" | "MEDIUM" | "HARD";
type DifficultyFilter = "ALL" | GameDifficulty;
type GameSkill = "math" | "memory" | "reading";

type GameMeta = {
  difficulty: GameDifficulty;
  xp: number;
  skill: GameSkill;
  titleAr?: string;
  titleEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  routePath?: string;
  icon?: LucideIcon;
};

type GameCard = {
  key: string;
  title: string;
  description: string;
  difficulty: GameDifficulty;
  xp: number;
  skill: GameSkill;
  route: string | null;
  Icon: LucideIcon;
};

const FALLBACK_DIFFICULTY_ORDER: GameDifficulty[] = ["EASY", "MEDIUM", "HARD"];

const GAME_META_BY_KEY: Record<string, GameMeta> = {
  word_match: {
    difficulty: "MEDIUM",
    xp: 75,
    skill: "math",
    titleAr: "مهمة الحساب",
    titleEn: "Math Quest",
    descriptionAr: "حل مسائل رياضيات قصيرة في تحد سريع.",
    descriptionEn: "Solve short math challenges in a fast-paced quest.",
    icon: Sigma,
  },
  focus_sprint: {
    difficulty: "MEDIUM",
    xp: 60,
    skill: "memory",
    titleAr: "سيد التسلسل",
    titleEn: "Sequence Master",
    descriptionAr: "تذكر الانماط وكررها لرفع التركيز.",
    descriptionEn: "Remember and repeat patterns to improve focus.",
    routePath: "/student/reading-lab",
    icon: Brain,
  },
  dyslexia_spelling: {
    difficulty: "MEDIUM",
    xp: 80,
    skill: "reading",
    titleAr: "تهجئة سمعية",
    titleEn: "Dyslexia Spelling",
    descriptionAr: "اسمع الكلمة ثم اكتبها بلوحة مفاتيح مناسبة لعسر القراءة.",
    descriptionEn: "Hear the word, then spell it with a dyslexia-friendly keyboard.",
    routePath: "/student/spelling-game",
    icon: Keyboard,
  },
};

const FALLBACK_ICONS: LucideIcon[] = [Gamepad2, Target, Volume2];

function fallbackDifficulty(index: number): GameDifficulty {
  return FALLBACK_DIFFICULTY_ORDER[index % FALLBACK_DIFFICULTY_ORDER.length];
}

function fallbackSkill(index: number): GameSkill {
  const skills: GameSkill[] = ["math", "memory", "reading"];
  return skills[index % skills.length];
}

function resolveGame(item: ApiGameItem, index: number, locale: "ar" | "en", prefix: string): GameCard {
  const meta = GAME_META_BY_KEY[item.key];
  const isEnglish = locale === "en";
  const fallbackIcon = FALLBACK_ICONS[index % FALLBACK_ICONS.length] ?? Gamepad2;

  const title = isEnglish ? (meta?.titleEn ?? item.title) : (meta?.titleAr ?? item.title);
  const description = isEnglish
    ? (meta?.descriptionEn ?? item.description)
    : (meta?.descriptionAr ?? item.description);

  const route = meta?.routePath
    ? `${prefix}${meta.routePath}`
    : null;

  return {
    key: item.key,
    title,
    description,
    difficulty: meta?.difficulty ?? fallbackDifficulty(index),
    xp: meta?.xp ?? (meta?.difficulty === "HARD" ? 90 : meta?.difficulty === "EASY" ? 45 : 60),
    skill: meta?.skill ?? fallbackSkill(index),
    route,
    Icon: meta?.icon ?? fallbackIcon,
  };
}

export function StudentGamesPageV2() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const locale = i18n.resolvedLanguage === "en" ? "en" : "ar";
  const prefix = useMemo(() => localePrefix(i18n.resolvedLanguage), [i18n.resolvedLanguage]);
  const requestConfig = useMemo(() => localeRequestConfig(i18n.resolvedLanguage), [i18n.resolvedLanguage]);

  const [status, setStatus] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [games, setGames] = useState<ApiGameItem[]>([]);
  const [totalXp, setTotalXp] = useState(0);
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("MEDIUM");

  useEffect(() => {
    const loadGames = async () => {
      setStatus(t("dashboards.studentGames.loading"));
      try {
        const gamesResponse = await apiClient.get<{ items: ApiGameItem[] }>("/games", requestConfig);
        setGames(gamesResponse.data.items || []);

        try {
          const progressionResponse = await apiClient.get<Progression>("/gamification/progression/me", requestConfig);
          setTotalXp(Math.max(0, progressionResponse.data.total_xp || 0));
        } catch {
          setTotalXp(0);
        }

        setStatus(t("dashboards.studentGames.loaded"));
      } catch (error) {
        setStatus(errorMessage(error));
      }
    };

    void loadGames();
  }, [requestConfig, t]);

  const mappedGames = useMemo(
    () => games.map((item, index) => resolveGame(item, index, locale, prefix)),
    [games, locale, prefix],
  );

  const filteredGames = useMemo(() => {
    if (difficultyFilter === "ALL") {
      return mappedGames;
    }
    return mappedGames.filter((game) => game.difficulty === difficultyFilter);
  }, [difficultyFilter, mappedGames]);

  const completedGames = useMemo(() => {
    if (mappedGames.length === 0) {
      return 0;
    }
    return Math.min(mappedGames.length, Math.floor(totalXp / 50));
  }, [mappedGames.length, totalXp]);

  const handleStartGame = (game: GameCard) => {
    setActionNote("");

    if (game.route && (READING_LAB_ENABLED || !game.route.endsWith("/student/reading-lab"))) {
      navigate(game.route);
      return;
    }

    setActionNote(t("dashboards.studentGames.comingSoon", { game: game.title }));
  };

  return (
    <DashboardShell title={t("dashboards.studentGames.title")}>
      <section className={cx(surfaceClass, "student-games-layout p-5 sm:p-6")}> 
        <header className="student-games-header">
          <div>
            <h2>{t("dashboards.studentGames.title")}</h2>
            <p className="muted">{t("dashboards.studentGames.subtitle")}</p>
          </div>
          <Link className={actionClass("soft")} to={`${prefix}/student/dashboard`}>
            {t("dashboards.studentGames.backToDashboard")}
          </Link>
        </header>

        <p className="status-line">{status || t("dashboards.common.idle")}</p>

        <section className="student-games-stats" aria-label={t("dashboards.studentGames.statsAria")}>
          <article className="student-games-stat-card is-completed">
            <span className="student-games-stat-icon" aria-hidden="true">
              <Trophy className="ui-prefix-icon" />
            </span>
            <p>{t("dashboards.studentGames.statsCompleted")}</p>
            <strong>{t("dashboards.studentGames.completedValue", { completed: completedGames, total: mappedGames.length })}</strong>
          </article>

          <article className="student-games-stat-card is-xp">
            <span className="student-games-stat-icon" aria-hidden="true">
              <Star className="ui-prefix-icon" />
            </span>
            <p>{t("dashboards.studentGames.statsXp")}</p>
            <strong>{t("dashboards.studentGames.xpValue", { xp: totalXp })}</strong>
          </article>

          <article className="student-games-stat-card is-available">
            <span className="student-games-stat-icon" aria-hidden="true">
              <Gamepad2 className="ui-prefix-icon" />
            </span>
            <p>{t("dashboards.studentGames.statsAvailable")}</p>
            <strong>{mappedGames.length}</strong>
          </article>
        </section>

        <section className="student-games-filter-row">
          <label className="student-games-filter-field" htmlFor="games-difficulty-filter">
            <span>{t("dashboards.studentGames.difficultyLabel")}</span>
            <select
              id="games-difficulty-filter"
              className={inputClass}
              value={difficultyFilter}
              onChange={(event) => setDifficultyFilter(event.target.value as DifficultyFilter)}
            >
              <option value="ALL">{t("dashboards.studentGames.difficultyAll")}</option>
              <option value="EASY">{t("dashboards.studentGames.difficultyEasy")}</option>
              <option value="MEDIUM">{t("dashboards.studentGames.difficultyMedium")}</option>
              <option value="HARD">{t("dashboards.studentGames.difficultyHard")}</option>
            </select>
          </label>
        </section>

        {filteredGames.length > 0 ? (
          <section className="student-games-grid kid-activity-stagger">
            {filteredGames.map((game) => (
              <article className="student-game-card" key={game.key}>
                <span className="student-game-icon" aria-hidden="true">
                  <game.Icon className="ui-prefix-icon" />
                </span>
                <h3>{game.title}</h3>
                <p>{game.description}</p>

                <div className="student-game-chips">
                  <span className="student-game-chip">{t(`dashboards.studentGames.difficulty.${game.difficulty.toLowerCase()}`)}</span>
                  <span className="student-game-chip">{t(`dashboards.studentGames.skill.${game.skill}`)}</span>
                  <span className="student-game-chip">{t("dashboards.studentGames.gameXp", { xp: game.xp })}</span>
                </div>

                <button
                  type="button"
                  className={cx(actionClass(), "student-game-start-btn")}
                  onClick={() => handleStartGame(game)}
                >
                  {t("dashboards.studentGames.startGame")}
                </button>
              </article>
            ))}
          </section>
        ) : (
          <p className="muted">{t("dashboards.studentGames.empty")}</p>
        )}

        {actionNote ? <p className="status-line">{actionNote}</p> : null}
      </section>
    </DashboardShell>
  );
}
