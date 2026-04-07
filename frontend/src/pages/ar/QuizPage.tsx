import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Trophy, ArrowLeft, Lightbulb, ChevronRight } from 'lucide-react';

import { Button } from '../../app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../app/components/ui/card';
import { Badge } from '../../app/components/ui/badge';
import { Progress } from '../../app/components/ui/progress';
import {
  listQuizzes, startQuiz, submitQuiz, getHint,
  type QuizSummary, type QuizQuestion, type SubmitQuizResponse,
} from '../../api/quiz';

type Screen = 'list' | 'playing' | 'results';

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: 'bg-secondary/20 text-secondary',
  medium: 'bg-yellow-100 text-yellow-700',
  hard: 'bg-destructive/10 text-destructive',
};

export function QuizPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.resolvedLanguage === 'ar';
  const localePrefix = useMemo(() => (isAr ? '/ar' : '/en'), [isAr]);

  const [screen, setScreen] = useState<Screen>('list');
  const [activeQuiz, setActiveQuiz] = useState<QuizSummary | null>(null);
  const [attemptId, setAttemptId] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [hint, setHint] = useState('');
  const [hintLoading, setHintLoading] = useState(false);
  const [results, setResults] = useState<SubmitQuizResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: quizzes = [], isLoading } = useQuery({ queryKey: ['quizzes'], queryFn: listQuizzes });

  async function handleStart(quiz: QuizSummary) {
    setError('');
    try {
      const res = await startQuiz(quiz.id);
      setActiveQuiz(quiz);
      setAttemptId(res.attempt_id);
      setQuestions(res.questions);
      setCurrentIdx(0);
      setSelected({});
      setHint('');
      setScreen('playing');
    } catch {
      setError(isAr ? 'فشل بدء الاختبار.' : 'Failed to start quiz.');
    }
  }

  async function handleGetHint() {
    if (!activeQuiz) return;
    setHintLoading(true);
    try {
      const res = await getHint(activeQuiz.id, questions[currentIdx].id);
      setHint(res.hint);
    } catch {
      setHint(isAr ? 'لا تلميح متاح.' : 'No hint available.');
    } finally {
      setHintLoading(false);
    }
  }

  async function handleNext() {
    const q = questions[currentIdx];
    if (!selected[q.id]) return;

    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setHint('');
    } else {
      // Submit
      setSubmitting(true);
      try {
        const answers = questions.map((q) => ({
          question_id: q.id,
          option_key: selected[q.id] || '',
        })).filter((a) => a.option_key);
        const res = await submitQuiz(activeQuiz!.id, attemptId, answers);
        setResults(res);
        setScreen('results');
      } catch {
        setError(isAr ? 'فشل إرسال الإجابات.' : 'Failed to submit answers.');
      } finally {
        setSubmitting(false);
      }
    }
  }

  // ── List ──────────────────────────────────────────────────────────────────
  if (screen === 'list') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{isAr ? 'الاختبارات' : 'Quizzes'}</h1>
            <p className="text-muted-foreground text-sm mt-1">{isAr ? 'اختبر معرفتك واكسب نقاطاً' : 'Test your knowledge and earn points'}</p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to={localePrefix + '/dashboard'}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              {isAr ? 'رجوع' : 'Back'}
            </Link>
          </Button>
        </div>

        {error && <p className="text-destructive text-sm mb-4">{error}</p>}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-6 pb-6 h-28" />
              </Card>
            ))}
          </div>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            {isAr ? 'لا توجد اختبارات متاحة حالياً.' : 'No quizzes available yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quizzes.map((quiz) => (
              <Card key={quiz.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{quiz.title}</CardTitle>
                    <Badge className={`text-xs shrink-0 ${DIFFICULTY_COLORS[quiz.difficulty.toLowerCase()] || 'bg-muted text-muted-foreground'}`}>
                      {quiz.difficulty}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span>🏆 {quiz.reward_points} {isAr ? 'نقطة' : 'pts'}</span>
                    <span>⚡ {quiz.reward_xp} XP</span>
                  </div>
                  <Button size="sm" onClick={() => handleStart(quiz)} className="w-full">
                    {isAr ? 'ابدأ الاختبار' : 'Start Quiz'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  if (screen === 'playing' && questions.length > 0) {
    const q = questions[currentIdx];
    const progress = ((currentIdx + 1) / questions.length) * 100;
    const isLast = currentIdx === questions.length - 1;

    return (
      <div className="max-w-2xl mx-auto px-4 py-8" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
            <span>{isAr ? `سؤال ${currentIdx + 1} من ${questions.length}` : `Question ${currentIdx + 1} of ${questions.length}`}</span>
            <span className="font-medium text-foreground">{activeQuiz?.title}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="mb-4">
          <CardContent className="pt-6 pb-6">
            <p className="text-lg font-medium text-foreground leading-relaxed mb-6">{q.text}</p>
            <div className="flex flex-col gap-3">
              {q.options.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSelected({ ...selected, [q.id]: opt.key })}
                  className={`w-full text-start rounded-xl border px-4 py-3 text-sm transition-all ${
                    selected[q.id] === opt.key
                      ? 'border-primary bg-primary/10 text-foreground font-medium'
                      : 'border-border bg-card hover:border-primary/50 text-foreground'
                  }`}
                >
                  <span className="font-bold text-muted-foreground mr-2">{opt.key}.</span>
                  {opt.text}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {hint && (
          <Card className="mb-4 bg-yellow-50 border-yellow-200">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-yellow-800">
                <Lightbulb className="inline w-4 h-4 mr-1" />
                {hint}
              </p>
            </CardContent>
          </Card>
        )}

        {error && <p className="text-destructive text-sm mb-3">{error}</p>}

        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={handleGetHint} disabled={hintLoading || !!hint} className="gap-1.5">
            <Lightbulb className="w-4 h-4" />
            {hintLoading ? '...' : (isAr ? 'تلميح' : 'Hint')}
          </Button>
          <Button
            onClick={handleNext}
            disabled={!selected[q.id] || submitting}
            className="flex-1 gap-1.5"
          >
            {submitting ? (isAr ? 'جارٍ الإرسال...' : 'Submitting...') : isLast ? (isAr ? 'إرسال الإجابات' : 'Submit') : (isAr ? 'التالي' : 'Next')}
            {!isLast && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────
  if (screen === 'results' && results) {
    const pct = Math.round((results.correct_answers / results.total_questions) * 100);
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="w-20 h-20 rounded-full bg-yellow-50 flex items-center justify-center mx-auto mb-6">
          <Trophy className="w-10 h-10 text-yellow-500" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          {isAr ? 'أحسنت!' : 'Well Done!'}
        </h2>
        <p className="text-muted-foreground mb-8">
          {isAr
            ? `أجبت على ${results.correct_answers} من ${results.total_questions} سؤالاً بشكل صحيح`
            : `You answered ${results.correct_answers} out of ${results.total_questions} correctly`}
        </p>
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card><CardContent className="pt-5 pb-5 text-center"><p className="text-2xl font-bold text-foreground">{pct}%</p><p className="text-xs text-muted-foreground mt-1">{isAr ? 'النتيجة' : 'Score'}</p></CardContent></Card>
          <Card><CardContent className="pt-5 pb-5 text-center"><p className="text-2xl font-bold text-primary">+{results.earned_points}</p><p className="text-xs text-muted-foreground mt-1">{isAr ? 'نقاط' : 'Points'}</p></CardContent></Card>
          <Card><CardContent className="pt-5 pb-5 text-center"><p className="text-2xl font-bold text-accent">+{results.earned_xp}</p><p className="text-xs text-muted-foreground mt-1">XP</p></CardContent></Card>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setScreen('list')} className="flex-1">
            {isAr ? 'اختبار آخر' : 'Try Another'}
          </Button>
          <Button asChild className="flex-1">
            <Link to={localePrefix + '/dashboard'}>{isAr ? 'لوحة التحكم' : 'Dashboard'}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
