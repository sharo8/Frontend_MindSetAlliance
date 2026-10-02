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
    applyThemeClass(theme)
    set({ theme })
  },
  toggleTheme: () => {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark')
  },
}))
