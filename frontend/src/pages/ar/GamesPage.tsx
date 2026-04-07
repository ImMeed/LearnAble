import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Gamepad2, Star, Trophy } from 'lucide-react';

import { Button } from '../../app/components/ui/button';
import { Card, CardContent } from '../../app/components/ui/card';
import { Badge } from '../../app/components/ui/badge';

const GAMES = [
  { emoji: '📝', titleEn: 'Word Match Challenge', titleAr: 'تحدي مطابقة الكلمات', descEn: 'Match words with their definitions in this fun memory game', descAr: 'طابق الكلمات مع تعريفاتها في لعبة ذاكرة ممتعة', difficulty: 'easy', subject: 'Reading', xp: 50, highScore: 850, completed: true },
  { emoji: '🔢', titleEn: 'Math Quest', titleAr: 'مهمة الرياضيات', descEn: 'Solve math problems on an exciting adventure', descAr: 'حل مسائل رياضية في مغامرة مثيرة', difficulty: 'medium', subject: 'Math', xp: 75, highScore: null, completed: false },
  { emoji: '🔍', titleEn: 'Letter Detective', titleAr: 'المحقق الحرفي', descEn: 'Find and identify letters in a colorful scene', descAr: 'ابحث عن الحروف وتعرّف عليها في مشهد ملوّن', difficulty: 'easy', subject: 'Reading', xp: 40, highScore: 720, completed: true },
  { emoji: '🎯', titleEn: 'Sequence Master', titleAr: 'سيد التسلسل', descEn: 'Remember and repeat patterns to level up', descAr: 'تذكّر الأنماط وكرّرها للارتقاء', difficulty: 'medium', subject: 'Memory', xp: 60, highScore: null, completed: false },
  { emoji: '📖', titleEn: 'Story Builder', titleAr: 'بناء القصة', descEn: 'Create sentences by arranging words in the correct order', descAr: 'أنشئ جملاً بترتيب الكلمات في الترتيب الصحيح', difficulty: 'easy', subject: 'Reading', xp: 45, highScore: null, completed: false },
  { emoji: '🧘', titleEn: 'Focus Flow', titleAr: 'تدفق التركيز', descEn: 'Practice concentration with calming visual tasks', descAr: 'تدرّب على التركيز بمهام بصرية مهدّئة', difficulty: 'easy', subject: 'Focus', xp: 35, highScore: 650, completed: true },
];

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-secondary/20 text-secondary',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-destructive/10 text-destructive',
};

export function GamesPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.resolvedLanguage === 'ar';
  const localePrefix = useMemo(() => (isAr ? '/ar' : '/en'), [isAr]);

  const completed = GAMES.filter((g) => g.completed).length;
  const totalXP = GAMES.filter((g) => g.completed).reduce((s, g) => s + g.xp, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to={localePrefix + '/dashboard'}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-primary" />
            {isAr ? 'ألعاب التعلّم' : 'Learning Games'}
          </h1>
          <p className="text-sm text-muted-foreground">{isAr ? 'طرق ممتعة للتمرّن!' : 'Fun ways to practice!'}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Trophy className="w-3.5 h-3.5" />
              {isAr ? 'الألعاب المكتملة' : 'Games Completed'}
            </div>
            <p className="text-2xl font-bold text-foreground">{completed} / {GAMES.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Star className="w-3.5 h-3.5" />
              {isAr ? 'مجموع XP' : 'Total XP Earned'}
            </div>
            <p className="text-2xl font-bold text-secondary">{totalXP} XP</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Gamepad2 className="w-3.5 h-3.5" />
              {isAr ? 'ألعاب متاحة' : 'Available Games'}
            </div>
            <p className="text-2xl font-bold text-primary">{GAMES.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select className="rounded-lg border border-border bg-card text-foreground text-sm px-3 py-2">
          <option>{isAr ? 'كل المستويات' : 'All Levels'}</option>
          <option>{isAr ? 'سهل' : 'Easy'}</option>
          <option>{isAr ? 'متوسط' : 'Medium'}</option>
          <option>{isAr ? 'صعب' : 'Hard'}</option>
        </select>
        <select className="rounded-lg border border-border bg-card text-foreground text-sm px-3 py-2">
          <option>{isAr ? 'كل المواد' : 'All Subjects'}</option>
          <option>Reading</option>
          <option>Math</option>
          <option>Memory</option>
          <option>Focus</option>
        </select>
      </div>

      {/* Games grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {GAMES.map((g, i) => (
          <Card key={i} className={`relative ${g.completed ? 'border-secondary/40' : ''}`}>
            {g.completed && (
              <div className={`absolute top-3 ${isAr ? 'left-3' : 'right-3'}`}>
                <span className="flex items-center gap-1 text-xs text-secondary font-medium">
                  <Trophy className="w-3 h-3" /> {isAr ? 'مكتمل' : 'Completed'}
                </span>
              </div>
            )}
            <CardContent className="pt-5 pb-5">
              <div className="text-3xl mb-3">{g.emoji}</div>
              <h3 className="font-bold text-foreground mb-1">{isAr ? g.titleAr : g.titleEn}</h3>
              <p className="text-sm text-muted-foreground mb-3">{isAr ? g.descAr : g.descEn}</p>
              <div className="flex items-center gap-2 mb-3">
                <Badge className={`text-xs ${DIFFICULTY_COLORS[g.difficulty]}`}>{g.difficulty}</Badge>
                <Badge variant="outline" className="text-xs">{g.subject}</Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <Star className="w-3 h-3" /> {g.xp} XP
                </span>
              </div>
              {g.highScore && (
                <p className="text-xs text-muted-foreground mb-3">
                  {isAr ? 'أعلى نتيجة:' : 'High Score:'} <strong>{g.highScore}</strong>
                </p>
              )}
              <Button className="w-full rounded-lg" size="sm">
                {g.completed ? (isAr ? '▶ العب مجدداً' : '▶ Play Again') : (isAr ? '▶ ابدأ اللعبة' : '▶ Start Game')}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
