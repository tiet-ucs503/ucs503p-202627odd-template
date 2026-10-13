"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Defect } from "@/lib/schema";
import { cn } from "@/lib/utils";

const SEV_STROKE: Record<Defect["severity"], string> = {
  low: "var(--sev-low)",
  medium: "var(--sev-medium)",
  high: "var(--sev-high)",
  critical: "var(--sev-critical)",
};

/**
 * Renders SVG bounding boxes for each defect over a parent image.
 * Position absolutely inside a `position: relative` image wrapper.
 *
 *   <div className="relative">
 *     <img ... />
 *     <BBoxOverlay defects={panel.defects} ... />
 *   </div>
 */
export function BBoxOverlay({
  defects,
  hoveredIndex,
  onHover,
  className,
  showLabels = true,
}: {
  defects: Defect[];
  hoveredIndex?: number | null;
  onHover?: (idx: number | null) => void;
  className?: string;
  showLabels?: boolean;
}) {
  const boxes = defects
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => Array.isArray(d.bbox));

  return (
    <svg
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className={cn("absolute inset-0 w-full h-full pointer-events-none", className)}
      aria-hidden
    >
      <AnimatePresence>
        {boxes.map(({ d, i }) => {
          const [ymin, xmin, ymax, xmax] = d.bbox!;
          const isHovered = hoveredIndex === i;
          const dim = hoveredIndex != null && !isHovered;
          const stroke = SEV_STROKE[d.severity];
          return (
            <motion.g
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: dim ? 0.18 : 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              style={{ pointerEvents: "auto", cursor: "pointer" }}
              onMouseEnter={() => onHover?.(i)}
              onMouseLeave={() => onHover?.(null)}
            >
              {/* Glow halo */}
              <motion.rect
                x={xmin}
                y={ymin}
                width={xmax - xmin}
                height={ymax - ymin}
                fill="none"
                stroke={stroke}
                strokeWidth={isHovered ? 0.012 : 0.006}
                strokeOpacity={isHovered ? 0.55 : 0}
                vectorEffect="non-scaling-stroke"
                rx={0.01}
                ry={0.01}
                style={{ filter: `drop-shadow(0 0 ${isHovered ? 12 : 6}px ${stroke})` }}
              />
              {/* Solid box */}
              <rect
                x={xmin}
                y={ymin}
                width={xmax - xmin}
                height={ymax - ymin}
                fill={stroke}
                fillOpacity={isHovered ? 0.16 : 0.06}
                stroke={stroke}
                strokeWidth={isHovered ? 0.005 : 0.0028}
                vectorEffect="non-scaling-stroke"
                strokeDasharray={isHovered ? "0" : "0.012 0.008"}
                rx={0.008}
                ry={0.008}
              />
              {/* Corner ticks */}
              {[
                [xmin, ymin, xmin + 0.025, ymin, xmin, ymin + 0.025],
                [xmax, ymin, xmax - 0.025, ymin, xmax, ymin + 0.025],
                [xmin, ymax, xmin + 0.025, ymax, xmin, ymax - 0.025],
                [xmax, ymax, xmax - 0.025, ymax, xmax, ymax - 0.025],
              ].map(([cx, cy, ax, ay, bx, by], k) => (
                <g key={k}>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={ax}
                    y2={ay}
                    stroke={stroke}
                    strokeWidth={0.004}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                  />
                  <line
                    x1={cx}
                    y1={cy}
                    x2={bx}
                    y2={by}
                    stroke={stroke}
                    strokeWidth={0.004}
                    vectorEffect="non-scaling-stroke"
                    strokeLinecap="round"
                  />
                </g>
              ))}

              {showLabels && (
                <foreignObject
                  x={xmin}
                  y={Math.max(0, ymin - 0.045)}
                  width={Math.max(0.18, xmax - xmin)}
                  height={0.045}
                  style={{ overflow: "visible" }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "2px 6px",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#0a0a0a",
                      background: stroke,
                      borderRadius: 4,
                      whiteSpace: "nowrap",
                      boxShadow: isHovered ? `0 0 18px ${stroke}` : undefined,
                      transform: "translateZ(0)",
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{i + 1}</span>
                    <span>·</span>
                    <span>{d.type}</span>
                  </div>
                </foreignObject>
              )}
            </motion.g>
          );
        })}
      </AnimatePresence>
    </svg>
  );
}

/**
 * Original-image overlay: shows the panel-detection boxes (one per detected
 * solar panel module) and routes click → opens that panel's report.
 */
export function PanelDetectOverlay({
  panels,
  hoveredIndex,
  activeIndex,
  onHover,
  onClick,
  labels,
}: {
  panels: { bbox: [number, number, number, number]; condition?: number }[];
  hoveredIndex?: number | null;
  activeIndex?: number | null;
  onHover?: (idx: number | null) => void;
  onClick?: (idx: number) => void;
  labels?: string[];
}) {
  return (
    <svg
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      {panels.map((p, i) => {
        const [ymin, xmin, ymax, xmax] = p.bbox;
        const isHover = hoveredIndex === i || activeIndex === i;
        const condition = p.condition ?? null;
        const stroke =
          condition == null
            ? "var(--accent)"
            : condition >= 80
              ? "var(--sev-low)"
              : condition >= 60
                ? "var(--sev-medium)"
                : condition >= 35
                  ? "var(--sev-high)"
                  : "var(--sev-critical)";
        return (
          <g
            key={i}
            style={{ pointerEvents: "auto", cursor: "pointer" }}
            onMouseEnter={() => onHover?.(i)}
            onMouseLeave={() => onHover?.(null)}
            onClick={() => onClick?.(i)}
          >
            <rect
              x={xmin}
              y={ymin}
              width={xmax - xmin}
              height={ymax - ymin}
              fill={stroke}
              fillOpacity={isHover ? 0.18 : 0.05}
              stroke={stroke}
              strokeWidth={isHover ? 0.006 : 0.003}
              vectorEffect="non-scaling-stroke"
              rx={0.008}
              ry={0.008}
              style={isHover ? { filter: `drop-shadow(0 0 14px ${stroke})` } : undefined}
            />
            <foreignObject
              x={xmin + 0.006}
              y={ymin + 0.006}
              width={Math.max(0.18, xmax - xmin)}
              height={0.05}
              style={{ overflow: "visible" }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 7px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#0a0a0a",
                  background: stroke,
                  borderRadius: 4,
                  whiteSpace: "nowrap",
                  fontWeight: 600,
                }}
              >
                {labels?.[i] ?? `PNL ${String(i + 1).padStart(2, "0")}`}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}
