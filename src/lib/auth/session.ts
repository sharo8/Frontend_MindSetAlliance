/**
 * Stockage des jetons : sessionStorage (onglet).
 *
 * Le backend Core renvoie accessToken / refreshToken dans le corps JSON
 * et n’émet pas de cookie httpOnly. sessionStorage limite la durée de vie
 * à l’onglet et évite de persister le JWT après fermeture du navigateur.
 * Ce n’est pas équivalent à un cookie httpOnly : le JS peut encore le lire.
 */

const ACCESS_KEY = 'ma.accessToken'
const REFRESH_KEY = 'ma.refreshToken'
const EXPIRES_KEY = 'ma.expiresAt'

export type StoredSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export function readSession(): StoredSession | null {
  const accessToken = sessionStorage.getItem(ACCESS_KEY)
  const refreshToken = sessionStorage.getItem(REFRESH_KEY)
  const expiresAt = Number(sessionStorage.getItem(EXPIRES_KEY) ?? 0)
  if (!accessToken || !refreshToken) return null
  return { accessToken, refreshToken, expiresAt }
}

export function writeSession(session: StoredSession) {
  sessionStorage.setItem(ACCESS_KEY, session.accessToken)
  sessionStorage.setItem(REFRESH_KEY, session.refreshToken)
  sessionStorage.setItem(EXPIRES_KEY, String(session.expiresAt))
}

export function clearSession() {
  sessionStorage.removeItem(ACCESS_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
  sessionStorage.removeItem(EXPIRES_KEY)
}

export function expiresAtFromTtl(expiresInSeconds: number) {
  return Date.now() + expiresInSeconds * 1000
}
