import { formatRelative } from "@/lib/dates";
import { COLUMN_LABELS, type ActivityLog, type BoardColumn, type User } from "@/lib/types";

function label(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "");
  return COLUMN_LABELS[value as BoardColumn] ?? value.replaceAll("_", " ");
}

export function formatActivity(
  event: ActivityLog,
  usersById: Map<string, User>,
): string {
  const actor = event.actor_id
    ? (usersById.get(event.actor_id)?.name ?? "Someone")
    : "Someone";
  const when = formatRelative(event.created_at);

  switch (event.event_type) {
    case "project.created":
      return `${actor} created this project · ${when}`;
    case "phase.changed": {
      const from = label(event.payload.from);
      const to = label(event.payload.to);
      return `${actor} moved this from ${from} to ${to} · ${when}`;
    }
    case "phase.assignee_changed": {
      const toId = event.payload.to_user_id as string | null;
      const toName = toId ? (usersById.get(toId)?.name ?? "someone") : "no one";
      return `${actor} assigned ${label(event.payload.phase)} to ${toName} · ${when}`;
    }
    case "approval.recorded": {
      const party = String(event.payload.party ?? "").replaceAll("_", " ");
      return `${actor} recorded the ${party} sign-off on ${label(event.payload.phase)} · ${when}`;
    }
    case "approval.cleared": {
      const party = String(event.payload.party ?? "").replaceAll("_", " ");
      return `${actor} cleared the ${party} sign-off on ${label(event.payload.phase)} · ${when}`;
    }
    case "gate.rejected":
      return `${actor} rejected ${label(event.payload.gate)} — back to ${label(event.payload.to)} · ${when}`;
    case "project.delegated": {
      const phases = event.payload.phases as unknown[] | undefined;
      const count = phases?.length ?? 0;
      return `${actor} planned the schedule across ${count} phases · ${when}`;
    }
    case "phase.hours_changed": {
      const to = event.payload.to_hours;
      const phase = label(event.payload.phase);
      return to == null
        ? `${actor} cleared planned hours on ${phase} · ${when}`
        : `${actor} planned ${to}h for ${phase} · ${when}`;
    }
    case "project.hold_toggled":
      return event.payload.on_hold
        ? `${actor} put this on hold · ${when}`
        : `${actor} took this off hold · ${when}`;
    case "project.updated": {
      const changed = event.payload.changed as
        | Record<string, [unknown, unknown]>
        | undefined;
      const fields = changed ? Object.keys(changed).join(", ") : "fields";
      return `${actor} updated ${fields} · ${when}`;
    }
    case "project.consultant_attached":
      return `${actor} attached a consultant · ${when}`;
    case "project.consultant_detached":
      return `${actor} removed a consultant · ${when}`;
    default:
      return `${actor} made a change · ${when}`;
  }
}
