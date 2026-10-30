import { LucideIcon } from "lucide-react";
import clsx from "clsx";

/**
 * A polished decorative tile used wherever we don't have a real photo
 * (imported listings and demo data have no images). Replaces the earlier
 * "product name typed inside a gradient box" placeholder, which read as
 * unfinished. Uses a soft dot-grid texture + a centered icon in a raised
 * disc so cards still feel considered without needing external images.
 */
export default function MediaTile({
  icon: Icon,
  className,
  iconClassName,
  size = 26,
}: {
  icon: LucideIcon;
  className?: string;
  iconClassName?: string;
  size?: number;
}) {
  return (
    <div
      className={clsx(
        "relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-secondary/35 via-background to-secondary/15",
        className
      )}
      style={{
        backgroundImage:
          "radial-gradient(rgba(107,122,110,0.12) 1px, transparent 1px), linear-gradient(135deg, rgba(167,184,164,0.35), rgba(250,247,242,0.2))",
        backgroundSize: "16px 16px, 100% 100%",
      }}
    >
      <div className={clsx("flex items-center justify-center rounded-full bg-surface/90 p-4 shadow-sm ring-1 ring-black/[0.03]", iconClassName)}>
        <Icon size={size} strokeWidth={1.6} className="text-primary/80" />
      </div>
    </div>
  );
}
