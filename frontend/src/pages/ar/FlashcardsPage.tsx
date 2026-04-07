import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CreditCard, RotateCcw, Shuffle } from 'lucide-react';

import { Button } from '../../app/components/ui/button';
import { Card, CardContent } from '../../app/components/ui/card';
import { Progress } from '../../app/components/ui/progress';

const CARDS_BY_SUBJECT: Record<string, { q: string; a: string }[]> = {
  Math: [
    { q: 'What is the Pythagorean theorem?', a: 'a² + b² = c² — relates the sides of a right triangle.' },
    { q: 'What is the formula for the area of a circle?', a: 'A = π r² where r is the radius.' },
    { q: 'What is a prime number?', a: 'A number greater than 1 that has no divisors other than 1 and itself.' },
  ],
  Science: [
    { q: 'What is photosynthesis?', a: 'The process by which plants convert light, water and CO₂ into glucose and oxygen.' },
    { q: "What is Newton's first law?", a: 'An object at rest stays at rest; an object in motion stays in motion unless acted upon by a net force.' },
    { q: 'What is the speed of light?', a: 'Approximately 299,792,458 metres per second (≈ 3×10⁸ m/s).' },
  ],
  History: [
    { q: 'When did World War II end?', a: '1945 — Germany surrendered on May 8 (V-E Day) and Japan on September 2 (V-J Day).' },
    { q: 'Who was the first US president?', a: 'George Washington, inaugurated on April 30, 1789.' },
    { q: 'What was the French Revolution?', a: 'A period of major social and political upheaval in France from 1789 to 1799.' },
  ],
  English: [
    { q: 'What is a metaphor?', a: "A figure of speech that directly refers to one thing by mentioning another, e.g. 'Time is money'." },
    { q: 'What is the difference between affect and effect?', a: '"Affect" is usually a verb (to influence); "effect" is usually a noun (the result).' },
    { q: 'What is an Oxford comma?', a: 'A comma placed before the final "and" or "or" in a list of three or more items.' },
  ],
};

const SUBJECTS = ['All', 'Math', 'Science', 'History', 'English'];

export function FlashcardsPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.resolvedLanguage === 'ar';
  const localePrefix = useMemo(() => (isAr ? '/ar' : '/en'), [isAr]);

  const [subject, setSubject] = useState('Math');
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mastered, setMastered] = useState<Set<number>>(new Set());

  const cards = subject === 'All'
    ? Object.values(CARDS_BY_SUBJECT).flat()
    : (CARDS_BY_SUBJECT[subject] ?? []);

  const current = cards[cardIdx];
  const progress = cards.length ? Math.round((mastered.size / cards.length) * 100) : 0;

  function next() { setFlipped(false); setCardIdx((i) => Math.min(i + 1, cards.length - 1)); }
  function prev() { setFlipped(false); setCardIdx((i) => Math.max(i - 1, 0)); }
  function shuffle() {
    setCardIdx(Math.floor(Math.random() * cards.length));
    setFlipped(false);
  }
  function reset() { setCardIdx(0); setFlipped(false); setMastered(new Set()); }
  function markMastered() {
    setMastered((prev) => { const n = new Set(prev); n.add(cardIdx); return n; });
    next();
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to={localePrefix + '/dashboard'}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            {isAr ? 'البطاقات التعليمية' : 'Flashcards'}
          </h1>
          <p className="text-sm text-muted-foreground">{isAr ? 'أتقن مواضيعك' : 'Master your subjects'}</p>
        </div>
      </div>

      {/* Subject filter */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-2 flex-wrap">
          {SUBJECTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => { setSubject(s); setCardIdx(0); setFlipped(false); }}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                subject === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-foreground hover:border-primary/50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={shuffle} className="gap-1.5">
            <Shuffle className="w-3.5 h-3.5" />
            {isAr ? 'عشوائي' : 'Shuffle'}
          </Button>
          <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            {isAr ? 'إعادة' : 'Reset'}
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>{isAr ? 'التقدم' : 'Progress'}</span>
          <span>{mastered.size} / {cards.length} {isAr ? 'مُتقنة' : 'mastered'}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Card */}
      {current ? (
        <>
          <p className="text-center text-sm text-muted-foreground mb-3">
            {isAr ? `بطاقة ${cardIdx + 1} من ${cards.length}` : `Card ${cardIdx + 1} of ${cards.length}`}
            {' • '}
            <span className="text-primary font-medium">{subject === 'All' ? '' : subject}</span>
          </p>

          <div
            className="cursor-pointer mb-6"
            onClick={() => setFlipped(!flipped)}
            role="button"
            aria-label="Flip card"
          >
            <Card className={`min-h-56 flex items-center justify-center border-2 transition-all ${flipped ? 'border-secondary' : 'border-primary'}`}>
              <CardContent className="pt-6 pb-6 text-center max-w-lg">
                {!flipped ? (
                  <>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">
                      {isAr ? 'السؤال' : 'QUESTION'}
                    </p>
                    <p className="text-xl font-semibold text-foreground leading-relaxed">{current.q}</p>
                    <p className="text-sm text-muted-foreground mt-4">{isAr ? 'انقر للكشف عن الإجابة' : 'Click to reveal answer'}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-secondary uppercase tracking-wider mb-4">
                      {isAr ? 'الإجابة' : 'ANSWER'}
                    </p>
                    <p className="text-lg text-foreground leading-relaxed">{current.a}</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={prev} disabled={cardIdx === 0} className="flex-1 rounded-xl">
              ← {isAr ? 'السابق' : 'Previous'}
            </Button>
            {flipped && (
              <Button onClick={markMastered} className="flex-1 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90">
                {isAr ? '✓ أتقنت' : '✓ Got it'}
              </Button>
            )}
            <Button variant="outline" onClick={next} disabled={cardIdx === cards.length - 1} className="flex-1 rounded-xl">
              {isAr ? 'التالي' : 'Next'} →
            </Button>
          </div>
        </>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          {isAr ? 'لا توجد بطاقات لهذا الموضوع.' : 'No flashcards for this subject.'}
        </div>
      )}
    </div>
  );
}
