import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, ArrowLeft } from 'lucide-react';

import { Button } from '../../app/components/ui/button';
import { Card, CardContent } from '../../app/components/ui/card';
import { Badge } from '../../app/components/ui/badge';
import { listSpaces } from '../../api/forum';

export function ForumPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.resolvedLanguage === 'ar';
  const localePrefix = useMemo(() => (isAr ? '/ar' : '/en'), [isAr]);

  const { data: spaces = [], isLoading } = useQuery({ queryKey: ['forum-spaces'], queryFn: listSpaces });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{isAr ? 'المنتدى' : 'Forum'}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAr ? 'تواصل مع أقرانك ومعلّميك' : 'Connect with your peers and teachers'}
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to={localePrefix + '/dashboard'}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            {isAr ? 'رجوع' : 'Back'}
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-5 pb-5 h-20" />
            </Card>
          ))}
        </div>
      ) : spaces.length === 0 ? (
        <div className="text-center py-20">
          <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground text-lg font-medium mb-2">
            {isAr ? 'المنتدى قيد الإنشاء' : 'Forum Coming Soon'}
          </p>
          <p className="text-muted-foreground text-sm">
            {isAr ? 'تابعونا قريباً للنقاشات والمساعدة.' : 'Stay tuned for discussions and support.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {spaces.map((space, i) => {
            const name = (space.name || space.title || `Space ${i + 1}`) as string;
            const desc = (space.description || '') as string;
            return (
              <Card key={space.id ?? i} className="hover:shadow-sm transition-shadow">
                <CardContent className="pt-4 pb-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{name}</h3>
                      {desc && <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0 text-muted-foreground">
                    {isAr ? 'قريباً' : 'Coming soon'}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
