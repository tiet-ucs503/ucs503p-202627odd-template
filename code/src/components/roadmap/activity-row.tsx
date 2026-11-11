"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ExternalLink, GripVertical, MapPin, MessageCircle, Pencil, Star, Trash2 } from "lucide-react";
import { ACTIVITY_CATEGORY_ICON, type Activity } from "@/types/itinerary";
import { Badge } from "@/components/ui";
import { cn, formatMoney } from "@/lib/utils";

export function ActivityRow({
  activity,
  selected = false,
  onSelect,
  onEdit,
  onDelete,
  onAskTravis,
}: {
  activity: Activity;
  selected?: boolean;
  onSelect?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Open Travis already looking at this place. */
  onAskTravis?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: activity.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const mappable = Boolean(activity.location);

  return (
    <li
      ref={setNodeRef}
      style={style}
      id={`activity-${activity.id}`}
      // Pointer convenience only — the "Show on map" button below is the
      // keyboard/screen-reader path, so this doesn't need to be focusable.
      onClick={mappable ? onSelect : undefined}
      className={cn(
        "group flex scroll-mt-24 gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-800/40",
        mappable && "cursor-pointer",
        selected && "border-orange-300 bg-orange-50/70 dark:border-orange-800 dark:bg-orange-950/30",
        isDragging && "z-10 border-orange-300 bg-white shadow-lg dark:bg-zinc-900",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="mt-1 shrink-0 cursor-grab touch-none text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing dark:text-zinc-600"
        aria-label={`Reorder ${activity.name}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="w-14 shrink-0 pt-0.5 text-sm font-medium tabular-nums text-zinc-500">{activity.time}</div>

      {activity.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- provider-hosted photo, proxied through /api/places/photo
        <img
          src={activity.imageUrl}
          alt=""
          className="h-14 w-14 shrink-0 rounded-lg object-cover"
          loading="lazy"
        />
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span aria-hidden>{ACTIVITY_CATEGORY_ICON[activity.category]}</span>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{activity.name}</span>
          {activity.isDemoData ? <Badge tone="amber">Not verified</Badge> : null}
          {activity.rating ? (
            <span className="inline-flex items-center gap-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {activity.rating.value.toFixed(1)}
              {activity.rating.count ? (
                <span className="text-zinc-400">({activity.rating.count})</span>
              ) : null}
            </span>
          ) : null}
        </div>
        {activity.description ? (
          <p className="mt-0.5 text-sm text-zinc-500">{activity.description}</p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {activity.estimatedCost > 0 ? formatMoney(activity.estimatedCost, activity.currency) : "Free"}
            {activity.estimatedCost > 0 && activity.priceIsEstimate !== false ? " (est.)" : ""}
          </span>
          {activity.durationMinutes > 0 ? (
            <span>
              {activity.durationMinutes >= 60
                ? `${Math.round(activity.durationMinutes / 60)}h`
                : `${activity.durationMinutes}m`}
            </span>
          ) : null}
          {activity.location ? (
            <span>
              {activity.location.lat.toFixed(3)}, {activity.location.lng.toFixed(3)}
            </span>
          ) : null}
          {activity.referenceUrl ? (
            <a
              href={activity.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1 text-orange-700 hover:underline dark:text-orange-400"
            >
              View reference <ExternalLink className="h-3 w-3" />
              {activity.source?.sourceName ? (
                <span className="text-zinc-400">via {activity.source.sourceName}</span>
              ) : null}
            </a>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "flex shrink-0 items-start gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100",
          selected && "opacity-100",
        )}
      >
        {mappable ? (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onSelect?.();
            }}
            aria-label={`Show ${activity.name} on the map`}
            aria-pressed={selected}
            className={cn(
              "rounded-full p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700",
              selected && "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
            )}
          >
            <MapPin className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {onAskTravis ? (
          <button
            onClick={(event) => {
              event.stopPropagation();
              onAskTravis();
            }}
            aria-label={`Ask Travis about ${activity.name}`}
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          aria-label={`Edit ${activity.name}`}
          className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          aria-label={`Delete ${activity.name}`}
          className="rounded-full p-1.5 text-zinc-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
