import { create } from 'zustand'
import { logout as apiLogout, refreshSession } from '../api/auth'
import { clearSession, expiresAtFromTtl, readSession, writeSession } from './session'
import { decodeAccessToken, overridesFromToken, rolesFromToken } from './jwt'
import { agentIdFromSubject, type PermissionOverride, type RoleAssignment } from '../rbac/rbac'
import { registerRefreshScheduler, setRefreshHandler } from '../api/client'

type AuthState = {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number
  email: string | null
  agentId: number | null
  roles: RoleAssignment[]
  permissionOverrides: PermissionOverride[]
  mustChangePassword: boolean
  hydrated: boolean
  hydrate: () => void
  applyTokens: (accessToken: string, refreshToken: string, expiresIn: number) => void
  refreshNow: () => Promise<boolean>
  signOut: () => Promise<void>
}

const REFRESH_SKEW_MS = 2 * 60 * 1000
let refreshTimer: number | undefined
let hydrateInFlight: Promise<void> | null = null

function scheduleTokenRefresh(expiresAt: number, refreshNow: () => Promise<boolean>) {
  window.clearTimeout(refreshTimer)
  const delay = Math.max(5_000, expiresAt - Date.now() - REFRESH_SKEW_MS)
  refreshTimer = window.setTimeout(() => {
    void refreshNow()
  }, delay)
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  expiresAt: 0,
  email: null,
  agentId: null,
  roles: [],
  permissionOverrides: [],
  mustChangePassword: false,
  hydrated: false,
  hydrate() {
    if (hydrateInFlight) return
    if (get().hydrated && get().accessToken) return
    const stored = readSession()
    if (!stored) {
      set({ accessToken: null, refreshToken: null, roles: [], permissionOverrides: [], email: null, agentId: null, mustChangePassword: false, hydrated: true })
      return
    }
    set({ refreshToken: stored.refreshToken, hydrated: false, accessToken: null })
    hydrateInFlight = get()
      .refreshNow()
      .then((ok) => {
        if (!ok) {
          set({ hydrated: true })
          return
        }
        set({ hydrated: true })
      })
      .finally(() => {
        hydrateInFlight = null
      })
  },
  applyTokens(accessToken, refreshToken, expiresIn) {
    const expiresAt = expiresAtFromTtl(expiresIn)
    writeSession({ accessToken, refreshToken, expiresAt })
    applyDecoded(accessToken, refreshToken, expiresAt, set)
    scheduleTokenRefresh(expiresAt, get().refreshNow)
  },
  async refreshNow() {
    const { refreshToken } = get()
    const stored = refreshToken ?? readSession()?.refreshToken
    if (!stored) return false
    try {
      const tokens = await refreshSession(stored)
      get().applyTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresIn)
      return true
    } catch {
      try {
        sessionStorage.setItem('ma.auth.notice', 'expired')
      } catch {
        /* ignore */
      }
      clearSession()
      set({ accessToken: null, refreshToken: null, roles: [], permissionOverrides: [], email: null, agentId: null, expiresAt: 0, mustChangePassword: false, hydrated: true })
      return false
    }
  },
  async signOut() {
    window.clearTimeout(refreshTimer)
    const token = get().refreshToken ?? readSession()?.refreshToken
    try {
      if (get().accessToken) await apiLogout(token ?? undefined)
    } catch {
      /* déconnexion locale même si l’API échoue */
    }
    clearSession()
      set({ accessToken: null, refreshToken: null, roles: [], permissionOverrides: [], email: null, agentId: null, expiresAt: 0, mustChangePassword: false, hydrated: true })
  },
}))

function applyDecoded(
  accessToken: string,
  refreshToken: string,
  expiresAt: number,
  set: (partial: Partial<AuthState>) => void,
) {
  const claims = decodeAccessToken(accessToken)
  set({
    accessToken,
    refreshToken,
    expiresAt,
    email: claims.email ?? null,
    agentId: agentIdFromSubject(claims.sub),
    roles: rolesFromToken(accessToken),
    permissionOverrides: overridesFromToken(accessToken),
    mustChangePassword: Boolean(claims.mustChangePassword),
  })
}

setRefreshHandler(() => useAuthStore.getState().refreshNow())
registerRefreshScheduler(() => {
  const { expiresAt, refreshNow } = useAuthStore.getState()
  if (expiresAt) scheduleTokenRefresh(expiresAt, refreshNow)
})
