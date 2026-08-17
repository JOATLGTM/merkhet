/**
 * The board keeps the selected project in the URL (`/?project=<id>`) so the
 * sheet is deep-linkable, but the sheet itself renders entirely from data the
 * board already holds — it fetches nothing.
 *
 * `router.push` would therefore be pure waste: pages are not held in the
 * client cache by default, so pushing a search-param change re-runs the whole
 * route on the server (layout + page, every query) just to redraw a panel
 * whose data is already in memory. That round-trip is paid twice per project —
 * once opening, once closing.
 *
 * The History API avoids it. Next syncs `usePathname` / `useSearchParams` off
 * `pushState`, so reading the selection from `useSearchParams()` still works,
 * and so do deep links and the back button.
 *
 * Only safe from the board route, since it writes a `/` pathname without
 * asking the router to render one.
 */
export function pushBoardProject(currentSearch: string, id: string | null) {
  const params = new URLSearchParams(currentSearch);
  if (id) params.set("project", id);
  else params.delete("project");
  const qs = params.toString();
  window.history.pushState(null, "", qs ? `/?${qs}` : "/");
}
