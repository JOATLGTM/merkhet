# Slice 8 — Permitting exit + archive

**No new SQL.** `move_project(..., 'completed')` already archives (`status=completed`, `archived_at`).

## Verify

1. Move a project to **Permitting** → open detail → **Mark Complete** (green) next to Put on hold.
2. Confirm dialog: **No** cancels; **Yes** archives and closes the sheet.
3. Card is gone from the board.
4. Nav → **Completed projects** → project appears; open detail from the list.

---

**Status:** Code ready — verify in the app.
