import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, BookOpen, ExternalLink } from 'lucide-react';

import { Button } from '../../app/components/ui/button';
import { Card, CardContent } from '../../app/components/ui/card';
import { Badge } from '../../app/components/ui/badge';
import { listBooks, redeemBook, readBook } from '../../api/library';

export function LibraryPage() {
  const { i18n } = useTranslation();
  const isAr = i18n.resolvedLanguage === 'ar';
  const localePrefix = useMemo(() => (isAr ? '/ar' : '/en'), [isAr]);
  const queryClient = useQueryClient();

  const { data: books = [], isLoading } = useQuery({ queryKey: ['books'], queryFn: listBooks });

  async function handleRedeem(bookId: string, title: string) {
    try {
      const res = await redeemBook(bookId);
      if (res.already_owned) {
        toast.info(isAr ? 'الكتاب موجود بالفعل في مكتبتك.' : 'You already own this book.');
      } else {
        toast.success(isAr ? `تمّ استبدال "${title}" بنجاح!` : `"${title}" redeemed successfully!`);
        queryClient.invalidateQueries({ queryKey: ['books'] });
      }
    } catch {
      toast.error(isAr ? 'نقاط غير كافية أو حدث خطأ.' : 'Insufficient points or an error occurred.');
    }
  }

  async function handleRead(bookId: string) {
    try {
      const res = await readBook(bookId);
      window.open(res.reader_url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error(isAr ? 'تعذّر فتح الكتاب.' : 'Could not open book.');
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{isAr ? 'المكتبة الرقمية' : 'Digital Library'}</h1>
          <p className="text-muted-foreground text-sm mt-1">{isAr ? 'تصفّح الكتب واستبدلها بنقاطك' : 'Browse and redeem books with your points'}</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to={localePrefix + '/dashboard'}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            {isAr ? 'رجوع' : 'Back'}
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-40 bg-muted rounded-t-xl" />
              <CardContent className="pt-4 pb-4 h-24" />
            </Card>
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">{isAr ? 'لا توجد كتب متاحة حالياً.' : 'No books available yet.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {books.map((book) => (
            <Card key={book.id} className="flex flex-col overflow-hidden hover:shadow-md transition-shadow">
              {/* Cover */}
              <div className="h-40 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center relative">
                {book.cover_image_url ? (
                  <img src={book.cover_image_url} alt={book.title} className="h-full w-full object-cover" />
                ) : (
                  <BookOpen className="w-12 h-12 text-primary/40" />
                )}
                {book.owned && (
                  <Badge className="absolute top-2 right-2 bg-secondary text-secondary-foreground text-xs">
                    {isAr ? 'مملوك' : 'Owned'}
                  </Badge>
                )}
              </div>

              <CardContent className="pt-4 pb-4 flex flex-col flex-1 gap-2">
                <h3 className="font-semibold text-foreground text-sm leading-snug">{book.title}</h3>
                <p className="text-xs text-muted-foreground">{book.author}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{book.summary}</p>

                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    {book.owned ? '' : `💎 ${book.points_cost} ${isAr ? 'نقطة' : 'pts'}`}
                  </span>
                  {book.owned ? (
                    <Button size="sm" variant="outline" onClick={() => handleRead(book.id)} className="gap-1.5 text-xs h-8">
                      <ExternalLink className="w-3 h-3" />
                      {isAr ? 'قراءة' : 'Read'}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => handleRedeem(book.id, book.title)} className="text-xs h-8">
                      {isAr ? 'استبدال' : 'Redeem'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
