# Merkhet session handoff

**Read this folder first** when starting a new agent session on Merkhet.

| File | Purpose |
|---|---|
| [CURRENT_STATE.md](./CURRENT_STATE.md) | What works today, how to run, demo logins |
| [DECISIONS.md](./DECISIONS.md) | Authority order, design refs, non-negotiables |
| [FILE_MAP.md](./FILE_MAP.md) | Where code lives |
| [NEXT.md](./NEXT.md) | Likely next work / open gaps |

**Product requirements (authoritative):** [`../PRD.md`](../PRD.md)  
**System design reference:** [`../SYSTEM_DESIGN_REFERENCE.md`](../SYSTEM_DESIGN_REFERENCE.md) — general reference, **not** Merkhet architecture. Most of it (sharding, consistent hashing, microservices) targets a scale this product will never reach; see §11 of the PRD for the actual constraints (<50 users, <1,000 projects, single tenant).  
**Prior Cursor chat:** [Merkhet MVP build](4683eef9-6229-44ff-957a-96f80cda6207) (agent transcript id)

## Traps that have already cost time

Each is written up in [DECISIONS.md](./DECISIONS.md). Read them before touching the relevant area:

- `components/ui/*` are **Base UI, not Radix** — `<SelectValue />` renders raw values without `items` on the Root
- tailwind-merge keys on the **full variant prefix**, so `sm:max-w-*` does not override `data-[side=right]:sm:max-w-*`
- `<LazyMotion strict>` at the root — `motion.*` throws, use `m.*`
- Seed changes need a **process restart**, not a hot reload
- Hydration and Cache Components errors never appear in a `curl` — the route still returns 200

Last updated: 2026-08-11 (renamed Merkat → Merkhet)
