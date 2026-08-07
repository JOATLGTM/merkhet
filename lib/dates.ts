import { differenceInCalendarDays, format, parseISO } from "date-fns";

export function formatCardDate(value: string | null | undefined): string {
  if (!value) return "—";
  return format(parseISO(value), "dd MMM");
}

export function formatFullDate(value: string | null | undefined): string {
  if (!value) return "—";
  return format(parseISO(value), "d MMM yyyy");
}

export function formatRelative(value: string): string {
  const days = differenceInCalendarDays(new Date(), parseISO(value));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export type DateUrgency = "neutral" | "warn" | "alert";

export function dateUrgency(
  value: string | null | undefined,
): DateUrgency {
  if (!value) return "neutral";
  const days = differenceInCalendarDays(parseISO(value), new Date());
  if (days < 0) return "alert";
  if (days <= 14) return "warn";
  return "neutral";
}

export function heldDaysLabel(since: string | null | undefined): string {
  if (!since) return "Paused";
  const days = Math.max(
    0,
    differenceInCalendarDays(new Date(), parseISO(since)),
  );
  return days === 0 ? "Paused today" : `Paused ${days}d`;
}
