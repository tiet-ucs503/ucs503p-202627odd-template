'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Card, Field, Textarea } from '@/components/ui';
import { StarDisplay, StarRatingInput } from '@/components/star-rating';
import { useLocale } from '@/features/i18n/locale-context';
import { getErrorMessage } from '@/lib/api/errors';
import type { Review } from '@/lib/api/reviews';
import {
  createOrderReview,
  getMyOrderReview,
  listOrderReviews,
} from '@/lib/api/reviews';

export function OrderReviewSection({
  orderId,
  counterpartyName,
  counterpartyRating,
}: {
  orderId: string;
  counterpartyName: string;
  counterpartyRating?: string | number | null;
}) {
  const { t } = useLocale();
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([getMyOrderReview(orderId), listOrderReviews(orderId)])
      .then(([mine, all]) => {
        setMyReview(mine.data);
        setReviews(all.data);
      })
      .catch((cause) => setError(getErrorMessage(cause)))
      .finally(() => setLoading(false));
  }, [orderId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (myReview || pending) return;
    setPending(true);
    setError('');
    try {
      const { data } = await createOrderReview(orderId, {
        rating,
        comment: comment.trim() || undefined,
      });
      setMyReview(data);
      setReviews((current) => [data, ...current]);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <p className="text-sm text-ink/60">{t('order.review.loading')}</p>
      </Card>
    );
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-display text-2xl text-forest">{t('order.review.title')}</h2>
        <p className="text-sm text-ink/60">
          {counterpartyName} — <StarDisplay value={counterpartyRating} />
        </p>
      </div>
      {error ? <Alert>{error}</Alert> : null}
      {myReview ? (
        <div className="rounded-xl border border-forest/10 bg-field p-3">
          <p className="text-sm font-semibold text-forest">{t('order.review.yourReview')}</p>
          <StarDisplay value={myReview.rating} className="mt-1" />
          {myReview.comment ? <p className="mt-2 text-sm text-ink/80">{myReview.comment}</p> : null}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-forest/10 p-3">
          <p className="text-sm font-semibold text-forest">
            {t('order.review.rate', { name: counterpartyName })}
          </p>
          <StarRatingInput value={rating} onChange={setRating} disabled={pending} />
          <Field label={t('order.review.comment')}>
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
              rows={3}
            />
          </Field>
          <Button type="submit" disabled={pending}>{t('order.review.submit')}</Button>
        </form>
      )}
      {reviews.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-forest">{t('order.review.all')}</p>
          {reviews.map((review) => (
            <div key={review.id} className="rounded-lg border border-forest/10 p-3 text-sm">
              <p className="font-semibold text-forest">{review.fromUser.name}</p>
              <StarDisplay value={review.rating} />
              {review.comment ? <p className="mt-1 text-ink/80">{review.comment}</p> : null}
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
