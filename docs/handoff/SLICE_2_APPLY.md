# Slice 2 — Pending → Active gate + contract upload

## 1. SQL Editor (required)

Supabase Dashboard → **SQL** → New query. Paste and run, **in order**:

1. Full contents of `supabase/migrations/20260812140000_contracts_storage.sql`  
   (creates private `contracts` bucket + storage RLS — prefer SQL Editor; CLI may skip storage)
2. Full contents of `supabase/migrations/20260812140100_pending_contract_gate.sql`  
   (updates `move_project` so Pending can only exit to Active when `contract_path` is set)

Confirm:

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'contracts';
```

## 2. App

Restart `npm run dev` if it is already running so new server actions load.

## 3. Verify

1. Open a **Pending** project → detail sheet shows **Upload PDF**.
2. Drag that card to Active / SD / etc. → toast: upload required; card stays in Pending.
3. ⌘K → Move to Active on the same project → same error toast.
4. Upload a small PDF → project moves to **Active**; filename appears on the sheet; server log `[notify:stub] → Active` (Ryan, Austin).
5. Drag an Active (or phase) card as usual — still works.

---

**Status (2026-08-12):** Applied and verified — upload → Active, gate on drag/⌘K, View PDF works.
