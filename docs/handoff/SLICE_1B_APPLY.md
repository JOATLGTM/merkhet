# Slice 1B — apply workflow migrations

Run these **separately** in the Supabase SQL Editor (enum ADD VALUE must commit first).

## 1. Enum

Paste and run: `supabase/migrations/20260812130000_workflow_1b_enum.sql`

## 2. Schema + data migrate

Paste and run: `supabase/migrations/20260812130100_workflow_1b.sql`

## 3. Re-seed (recommended)

Existing demo rows need six phase rows and new column shape:

```bash
npm run seed
```

Then:

```sql
select setval('public.project_number_seq', 419);
```

## 4. Verify in the app

Board columns should be:

**Pending · Active · Schematic design · Design development · Review · Construction documents · Final review · Permitting**

- New projects land in **Pending**
- **Active** is empty until Slice 2 (contract upload) — dragging into Active still works for now
- Completed / archived projects are off the board
- Settings → Phase subscribers lists six phases including Final review

## What 1B does *not* include

- PDF upload gate (Slice 2)
- Delegation form (Slice 4)
- Approval UI (Slice 5)
