/**
 * Redirect map for the retired /admin/next/* prototype mount point:
 *
 *   /admin/next                → /admin
 *   /admin/next/portal[/...]   → /admin/portal-preview[/...]
 *   /admin/next/<anything>     → /admin/<anything>
 *     (sales, quotes, clients, delivery, finance, agreements, automations, settings)
 *
 * The remaining path and the query string are preserved.
 */
export function legacyNextTarget(rest: string[] | undefined, query = ""): string {
  const segments = (rest ?? []).filter(Boolean);
  const target =
    segments[0] === "portal"
      ? ["/admin/portal-preview", ...segments.slice(1)].join("/")
      : ["/admin", ...segments].join("/");
  return query ? `${target}?${query}` : target;
}
