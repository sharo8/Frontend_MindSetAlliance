import { flushSync } from 'react-dom'
import { create } from 'zustand'

export const THEME_KEY = 'ma-theme-preference'
export type ThemePreference = 'light' | 'dark'

function systemTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function readStoredTheme(): ThemePreference | null {
  const stored = window.localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return null
}

export function resolveTheme(): ThemePreference {
  return readStoredTheme() ?? systemTheme()
}

export function applyThemeClass(theme: ThemePreference) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

type ThemeState = {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
  toggleTheme: () => void
  hydrate: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  hydrate: () => {
    const theme = resolveTheme()
    applyThemeClass(theme)
    set({ theme })
  },
  setTheme: (theme) => {
    window.localStorage.setItem(THEME_KEY, theme)
    revealTheme(() => {
      applyThemeClass(theme)
      set({ theme })
    })
  },
  toggleTheme: () => {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark')
  },
}))

/* Dernier point touché : le nouveau thème s'ouvre en cercle depuis ce point (transition de vue). */
let lastPoint = { x: 0, y: 0 }
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (e) => (lastPoint = { x: e.clientX, y: e.clientY }), { capture: true, passive: true })
}

type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }

function revealTheme(apply: () => void) {
  const doc = document as ViewTransitionDoc
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!doc.startViewTransition || reduce) {
    apply()
    return
  }
  const { x, y } = lastPoint.x || lastPoint.y ? lastPoint : { x: window.innerWidth - 40, y: 40 }
  const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const vt = doc.startViewTransition(() => {
    flushSync(apply)
  })
  void vt.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', pseudoElement: '::view-transition-new(root)' },
    )
  })
}
