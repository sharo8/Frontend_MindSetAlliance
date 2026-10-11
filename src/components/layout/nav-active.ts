export type NavTarget = { id: string; to: string }

/** Chemin sans requête, sans ancre, sans slash final (sauf la racine). */
export function normalizeNavPath(pathname: string): string {
  const bare = pathname.split('?')[0]?.split('#')[0] ?? '/'
  if (bare.length > 1 && bare.endsWith('/')) return bare.slice(0, -1)
  return bare || '/'
}

/** Correspondance aux frontières de segments : /rh matche /rh/conges, pas /rhume. */
export function navPathMatches(itemPath: string, pathname: string): boolean {
  const current = normalizeNavPath(pathname)
  const target = normalizeNavPath(itemPath)
  if (target === '/') return current === '/'
  return current === target || current.startsWith(`${target}/`)
}

/**
 * Une seule entrée : le plus long préfixe du menu qui correspond à l'URL.
 * Une page de détail reste rattachée à son entrée (/tickets/5 → /tickets).
 * Une page parente (/rh) ne s'allume pas sur une sous-page qui a sa propre entrée.
 */
export function resolveActiveNavId(pathname: string, items: readonly NavTarget[]): string | null {
  let bestId: string | null = null
  let bestLength = -1
  for (const item of items) {
    const target = normalizeNavPath(item.to)
    if (!navPathMatches(target, pathname)) continue
    if (target.length > bestLength) {
      bestId = item.id
      bestLength = target.length
    }
  }
  return bestId
}
