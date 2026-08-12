"use client";

/**
 * Adapted from KokonutUI "Background Paths"
 * @author: @dorianbaffier
 * @license: MIT
 * @website: https://kokonutui.com/docs/backgrounds/background-paths
 *
 * Merkhet changes:
 * - `m.*` instead of `motion.*` (root LazyMotion runs in strict mode)
 * - Palette swapped to the §12.1 phase ramp; no ad-hoc hex
 * - Hairline stroke weights instead of the original 4–7px rounded strokes
 * - Deterministic path ids (the original used Math.random per render)
 * - Per-path opacity is set inline and the *layer* fades in, so the layered
 *   depth survives the fade-in instead of being flattened to 1
 * - Decorative only: aria-hidden, no <title>, and the float loop is
 *   dropped entirely under prefers-reduced-motion (§12.2)
 *
 * ── Why the float lives on a <div>, not on the paths ────────────────────
 * The original animated `y` on all 32 `m.path` elements. Motion renders that
 * as a CSS `transform` on each path (see motion-dom buildSVGAttrs), and Blink
 * cannot promote SVG *children* to their own compositor layers — so every
 * frame invalidated the entire SVG raster on the main thread. At full-window
 * width that is ~2x the pixels of a half-window and blows the frame budget;
 * Chrome drops the tiles and the whole document layer flashes, login card
 * included (it is `relative z-10`, a stacking context but not a layer).
 *
 * Each depth is now its own absolutely-positioned div holding a static SVG.
 * The div is an HTML element, so `y`/`opacity` run on the compositor and the
 * SVG rasters exactly once. Do not move the float back onto the paths.
 *
 * Consequence: FLOAT_DISTANCE is now CSS pixels rather than SVG user units
 * (which the `slice` scale shrank by ~0.55x), so the values are pre-scaled to
 * land on the same on-screen travel.
 */

import { m, useReducedMotion } from "motion/react";
import { memo, useMemo } from "react";

import { cn } from "@/lib/utils";

interface Point {
  x: number;
  y: number;
}

interface PathData {
  id: string;
  d: string;
  opacity: number;
  width: number;
}

type PathKind = "primary" | "secondary" | "accent";

const AMPLITUDE: Record<PathKind, number> = {
  primary: 150,
  secondary: 100,
  accent: 60,
};

const SEGMENTS: Record<PathKind, number> = {
  primary: 10,
  secondary: 8,
  accent: 6,
};

/**
 * ECMAScript does not require `Math.sin`/`Math.cos` to be correctly rounded,
 * so Node and the browser can disagree in the last few ulp. Emitting raw
 * floats into the `d` attribute therefore produced a hydration mismatch.
 * Quantising to 2dp collapses that divergence and shrinks the SSR payload.
 */
function q(n: number): string {
  return n.toFixed(2);
}

function generateAestheticPath(
  index: number,
  position: number,
  kind: PathKind,
): string {
  const baseAmplitude = AMPLITUDE[kind];
  const segments = SEGMENTS[kind];
  const phase = index * 0.2;
  const points: Point[] = [];

  const startX = 2400;
  const startY = 800;
  const endX = -2400;
  const endY = -800 + index * 25;

  for (let i = 0; i <= segments; i++) {
    const progress = i / segments;
    const eased = 1 - (1 - progress) ** 2;

    const baseX = startX + (endX - startX) * eased;
    const baseY = startY + (endY - startY) * eased;

    const amplitudeFactor = 1 - eased * 0.3;
    const wave1 =
      Math.sin(progress * Math.PI * 3 + phase) *
      (baseAmplitude * 0.7 * amplitudeFactor);
    const wave2 =
      Math.cos(progress * Math.PI * 4 + phase) *
      (baseAmplitude * 0.3 * amplitudeFactor);
    const wave3 =
      Math.sin(progress * Math.PI * 2 + phase) *
      (baseAmplitude * 0.2 * amplitudeFactor);

    points.push({ x: baseX * position, y: baseY + wave1 + wave2 + wave3 });
  }

  return points
    .map((point, i) => {
      if (i === 0) return `M ${q(point.x)} ${q(point.y)}`;
      const prev = points[i - 1];
      const tension = 0.4;
      const cp1x = prev.x + (point.x - prev.x) * tension;
      const cp2x = prev.x + (point.x - prev.x) * (1 - tension);
      return `C ${q(cp1x)} ${q(prev.y)}, ${q(cp2x)} ${q(point.y)}, ${q(point.x)} ${q(point.y)}`;
    })
    .join(" ");
}

function buildPaths(
  kind: PathKind,
  count: number,
  position: number,
  opacityBase: number,
  opacityStep: number,
  widthBase: number,
  widthStep: number,
): PathData[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${kind}-${i}`,
    d: generateAestheticPath(i, position, kind),
    opacity: opacityBase + i * opacityStep,
    width: widthBase + i * widthStep,
  }));
}

/** CSS pixels — see the unit note in the file header. */
const FLOAT_DISTANCE: Record<PathKind, number> = {
  primary: -9,
  secondary: -6,
  accent: -3,
};

const FLOAT_DURATION: Record<PathKind, number> = {
  primary: 8,
  secondary: 6,
  accent: 4,
};

const PathLayer = memo(function PathLayer({
  kind,
  paths,
  layerOpacity,
  reduced,
}: {
  kind: PathKind;
  paths: PathData[];
  layerOpacity: number;
  reduced: boolean;
}) {
  // Unique per layer: duplicate ids across the three SVGs would cross-wire the
  // `url(#…)` stroke references.
  const rampId = `merkhet-path-ramp-${kind}`;

  return (
    <m.div
      // Overscan, so the float never exposes a bare strip at the clipped edge.
      className="absolute -inset-6"
      initial={{ opacity: 0 }}
      animate={
        reduced
          ? { opacity: layerOpacity }
          : { opacity: layerOpacity, y: [0, FLOAT_DISTANCE[kind], 0] }
      }
      transition={{
        opacity: { duration: 1.2, ease: "easeOut" },
        y: {
          duration: FLOAT_DURATION[kind],
          repeat: Number.POSITIVE_INFINITY,
          repeatType: "reverse",
          ease: "easeInOut",
        },
      }}
    >
      <svg
        className="h-full w-full"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        viewBox="-2400 -800 4800 1600"
      >
        <defs>
          <linearGradient id={rampId} x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" style={{ stopColor: "var(--phase-5)" }} />
            <stop offset="45%" style={{ stopColor: "var(--phase-3)" }} />
            <stop offset="100%" style={{ stopColor: "var(--phase-1)" }} />
          </linearGradient>
        </defs>

        {paths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            stroke={`url(#${rampId})`}
            strokeLinecap="round"
            strokeWidth={path.width}
            opacity={path.opacity}
          />
        ))}
      </svg>
    </m.div>
  );
});

/**
 * Decorative hairline sweep. Absolutely positioned — the parent must be
 * `relative` and should clip its own overflow.
 */
export const BackgroundPaths = memo(function BackgroundPaths({
  className,
  position = 1,
}: {
  className?: string;
  position?: number;
}) {
  const reduced = useReducedMotion() ?? false;

  const primaryPaths = useMemo(
    () => buildPaths("primary", 12, position, 0.16, 0.018, 1.4, 0.12),
    [position],
  );
  const secondaryPaths = useMemo(
    () => buildPaths("secondary", 12, position, 0.12, 0.014, 1, 0.1),
    [position],
  );
  const accentPaths = useMemo(
    () => buildPaths("accent", 8, position, 0.1, 0.02, 0.8, 0.08),
    [position],
  );

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      <PathLayer
        kind="primary"
        paths={primaryPaths}
        layerOpacity={1}
        reduced={reduced}
      />
      <PathLayer
        kind="secondary"
        paths={secondaryPaths}
        layerOpacity={0.8}
        reduced={reduced}
      />
      <PathLayer
        kind="accent"
        paths={accentPaths}
        layerOpacity={0.6}
        reduced={reduced}
      />
    </div>
  );
});

export default BackgroundPaths;
