"use client";

/**
 * Adapted from KokonutUI "Loader"
 * @license: MIT
 * @website: https://kokonutui.com/docs/inputs/loader
 *
 * Merkhet changes:
 * - `m.*` instead of `motion.*` (root LazyMotion runs in strict mode, which
 *   throws on `motion.*`)
 * - Rings are drawn from `var(--ink)` via color-mix, so the eight original
 *   divs (four light + four `dark:block` duplicates hardcoded to black and
 *   white) collapse to four that follow the theme token. No ad-hoc hex.
 * - Type uses the §12.1 scale and ink ramp instead of `text-black/90`
 * - Containers shrunk (80/128/160px → 64/96/128px). The ring masks are
 *   percentages, so the bands land at hairline weight at these sizes.
 * - The text entrance ran on 0.4/0.6/0.8s delays with 0.8–1s durations, so
 *   the label appeared ~1.4s in — longer than most of these fallbacks are
 *   mounted. Retimed to a 60ms cascade at 200ms (§12.2 rule 3).
 * - The looping opacity breathe on the title and subtitle is dropped. The
 *   rings already carry "still working", and §12.1 wants the type quiet.
 * - `role="status"` so a route-level fallback is announced, and the ring is
 *   `aria-hidden` (decorative).
 * - Under prefers-reduced-motion the rotation loops are dropped entirely
 *   rather than left scheduled-but-suppressed (§12.2 rule 4).
 */

import { m, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
}

const SIZE_CONFIG = {
  sm: {
    wrapper: "gap-4 p-6",
    container: "size-16",
    titleClass: "text-[13px] leading-tight",
    subtitleClass: "text-[11px] leading-relaxed",
    spacing: "space-y-1",
    maxWidth: "max-w-48",
  },
  md: {
    wrapper: "gap-5 p-8",
    container: "size-24",
    titleClass: "text-[15px] leading-snug",
    subtitleClass: "text-[13px] leading-relaxed",
    spacing: "space-y-1.5",
    maxWidth: "max-w-56",
  },
  lg: {
    wrapper: "gap-6 p-8",
    container: "size-32",
    titleClass: "text-[20px] leading-none",
    subtitleClass: "text-[13px] leading-relaxed",
    spacing: "space-y-2",
    maxWidth: "max-w-64",
  },
} as const;

/** `ink(60)` → 60% of the theme's ink token, faded to transparent. */
const ink = (pct: number) => `color-mix(in oklab, var(--ink) ${pct}%, transparent)`;

/** Each ring is a conic sweep clipped to a thin annulus by a radial mask. */
const RINGS = [
  {
    background: `conic-gradient(from 0deg, transparent 0deg, ${ink(100)} 90deg, transparent 180deg)`,
    band: "transparent 35%, black 37%, black 39%, transparent 41%",
    opacity: 0.8,
    direction: 360,
    duration: 3,
    ease: "linear",
  },
  {
    background: `conic-gradient(from 0deg, transparent 0deg, ${ink(100)} 120deg, ${ink(50)} 240deg, transparent 360deg)`,
    band: "transparent 42%, black 44%, black 48%, transparent 50%",
    opacity: 0.9,
    direction: 360,
    duration: 2.5,
    ease: [0.4, 0, 0.6, 1],
  },
  {
    background: `conic-gradient(from 180deg, transparent 0deg, ${ink(60)} 45deg, transparent 90deg)`,
    band: "transparent 52%, black 54%, black 56%, transparent 58%",
    opacity: 0.35,
    direction: -360,
    duration: 4,
    ease: [0.4, 0, 0.6, 1],
  },
  {
    background: `conic-gradient(from 270deg, transparent 0deg, ${ink(40)} 20deg, transparent 40deg)`,
    band: "transparent 61%, black 62%, black 63%, transparent 64%",
    opacity: 0.5,
    direction: 360,
    duration: 3.5,
    ease: "linear",
  },
] as const;

export default function Loader({
  title = "Loading…",
  subtitle,
  size = "md",
  className,
  ...props
}: LoaderProps) {
  const reduced = useReducedMotion();
  const config = SIZE_CONFIG[size];

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center",
        config.wrapper,
        className
      )}
      {...props}
    >
      <div aria-hidden className={cn("relative", config.container)}>
        {RINGS.map((ring) => (
          <m.div
            key={ring.band}
            className="absolute inset-0 rounded-full"
            style={{
              background: ring.background,
              mask: `radial-gradient(circle at 50% 50%, ${ring.band})`,
              WebkitMask: `radial-gradient(circle at 50% 50%, ${ring.band})`,
              opacity: ring.opacity,
            }}
            animate={reduced ? undefined : { rotate: [0, ring.direction] }}
            transition={
              reduced
                ? undefined
                : {
                    duration: ring.duration,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: ring.ease,
                  }
            }
          />
        ))}
      </div>

      <div className={cn("text-center", config.spacing, config.maxWidth)}>
        <m.p
          className={cn(config.titleClass, "font-medium text-ink antialiased")}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          {title}
        </m.p>

        {subtitle ? (
          <m.p
            className={cn(config.subtitleClass, "text-ink-soft antialiased")}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            {subtitle}
          </m.p>
        ) : null}
      </div>
    </div>
  );
}
