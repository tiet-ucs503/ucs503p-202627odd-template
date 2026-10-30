"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Clock, Wrench } from "lucide-react";
import { api, ApiRequestError } from "@/lib/api";
import { formatINR } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import RatingStars from "@/components/ui/RatingStars";
import { VerifiedBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import type { Offering, Review } from "@/types";

export default function ServiceDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const [service, setService] = useState<Offering | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [address, setAddress] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Offering>(`/catalog/services/${params.id}`)
      .then((s) => {
        setService(s);
        if (s.vendor?.id) {
          api
            .get<Review[]>(`/reviews/vendor/${s.vendor.id}`)
            .then((all) => setReviews(all.filter((r) => r.offeringId === s.id)))
            .catch(() => {});
        }
      })
      .catch(() => setService(null))
      .finally(() => setLoading(false));

    if (user?.address) setAddress(user.address);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    setDate(tomorrow.toISOString().slice(0, 16));
  }, [params.id, user]);

  async function handleBook() {
    if (!user) return router.push("/login");
    if (!address.trim()) {
      setError("Please enter an address for the service.");
      return;
    }
    if (!date || new Date(date) < new Date()) {
      setError("Please choose a valid, future date and time.");
      return;
    }
    setBooking(true);
    setError(null);
    try {
      const order = await api.post<any>("/orders", {
        offeringId: params.id,
        scheduledAt: new Date(date).toISOString(),
        address,
        customerNote: notes || undefined,
      });
      setSuccess("Service requested!");
      setTimeout(() => router.push(`/orders/${order.id}`), 900);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't request this service.");
    } finally {
      setBooking(false);
    }
  }

  if (loading) return <Spinner />;
  if (!service) return <EmptyState icon={Wrench} title="Service not found" />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-8">
      <div className="grid gap-10 md:grid-cols-2">
        <div className="flex h-80 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-secondary/30 to-background text-lg text-primary/60">
          {service.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={service.imageUrl} alt={service.name} className="h-full w-full object-cover" />
          ) : (
            service.name
          )}
        </div>

        <div>
          {service.vendor && (
            <Link
              href={`/vendor/${service.vendor.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              {service.vendor.isVerified && <ShieldCheck size={14} className="text-primary" />}
              <span>{service.vendor.businessName}</span>
            </Link>
          )}
          <h1 className="mt-1 text-2xl sm:text-3xl font-serif text-foreground font-bold">{service.name}</h1>
          {service.vendor?.isVerified && <VerifiedBadge className="mt-2" />}
          {service.durationMinutes != null && (
            <span className="mt-2.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={13} /> {service.durationMinutes} mins duration
            </span>
          )}

          <p className="mt-4 text-2xl font-bold text-foreground">
            {service.price != null ? formatINR(service.price) : "Contact for pricing"}
          </p>
          {service.description && (
            <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {service.description}
            </p>
          )}

          <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
            <p className="text-sm font-bold text-foreground">Request this service</p>
            <p className="text-xs text-muted-foreground mt-0.5">Choose your preferred time and address</p>

            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address where the service is needed"
              rows={2}
              className="mt-3 w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />

            <input
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-2.5 w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes for the service provider? (optional)"
              rows={2}
              className="mt-2.5 w-full rounded-xl border border-border bg-secondary/30 px-3.5 py-2 text-xs sm:text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />

            {error && <p className="mt-2 text-xs font-semibold text-destructive">{error}</p>}
            {success && <p className="mt-2 text-xs font-semibold text-primary">{success}</p>}

            <Button onClick={handleBook} disabled={booking} className="mt-4 w-full py-2.5 text-xs font-bold shadow-subtle">
              {booking ? "Submitting Request…" : "Request Service"}
            </Button>
          </div>
        </div>

      </div>

      <section className="mt-14">
        <h2 className="text-lg font-medium text-ink">Reviews ({reviews.length})</h2>
        {reviews.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No reviews yet for this service.</p>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink">{r.customer?.name ?? "Customer"}</p>
                  <RatingStars rating={r.rating} size={12} />
                </div>
                {r.comment && <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
