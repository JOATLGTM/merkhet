# TODOS

## Performance

### Shared caching of board data

**What:** Cache the board, calendar and customer project lists with `'use cache'` and `cacheTag('projects')`, and call `updateTag('projects')` from Server Actions.

**Why:** After the performance pass, every page view still re-queries Supabase (about 4 round trips for the board). One shared cached copy removes most of them.

**Context:** Deferred by premise 4 of `docs/designs/performance-pass.md`. Every signed-in user sees the same data because RLS is `using (true)`, so one cache can serve all staff. It must read through a server-only Supabase client, which bypasses RLS on purpose, so it needs a security sign-off. `'use cache: private'` only caches in the browser and would not remove database trips. Check the Next 16.3 caching docs in `node_modules/next/dist/docs/` first.

**Pros:** The biggest remaining page-load win. **Cons:** Bypasses RLS by design; cache bugs show stale data.

**Effort:** L
**Priority:** P3
**Depends on:** The performance pass shipping; a decision on whether RLS will ever become per-user.
