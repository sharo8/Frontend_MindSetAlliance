import { api, mapAuthError, ApiError } from './client'

export type LoginSuccess = {
  requires2fa: false
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
  mustChangePassword?: boolean
}

export type LoginChallenge = {
  requires2fa: true
  challengeId: string
  message?: string
}

export type LoginResponse = LoginSuccess | LoginChallenge

export async function login(email: string, password: string): Promise<LoginResponse> {
  try {
    return await api.post<LoginResponse>('/api/auth/login', { email, password }, { skipAuth: true })
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ApiError(mapAuthError(error.message, error.status), error.status)
    }
    throw error
  }
}

export async function verify2fa(challengeId: string, code: string): Promise<LoginSuccess> {
  try {
    return await api.post<LoginSuccess>(
      '/api/auth/2fa/verify',
      { challengeId, code },
      { skipAuth: true },
    )
  } catch (error) {
    if (error instanceof ApiError) {
      const msg =
        error.message.toLowerCase().includes('invalide') || error.message.toLowerCase().includes('expir')
          ? error.message
          : 'Code de vérification invalide.'
      throw new ApiError(msg, error.status)
    }
    throw error
  }
}

export function refreshSession(refreshToken: string) {
  return api.post<LoginSuccess>('/api/auth/refresh', { refreshToken }, { skipAuth: true, skipRefresh: true })
}

export function logout(refreshToken?: string) {
  return api.post<{ message: string }>('/api/auth/logout', refreshToken ? { refreshToken } : {})
}

export type AgentProfile = {
  id: number
  email: string
  nom: string
  prenom: string
  statut: string
  twoFactorEnabled: boolean
  mustChangePassword?: boolean
  departement?: string | null
  telephone?: string | null
  photo?: string | null
  roles?: { role: string; projectCode: string | null }[]
}

export function fetchMe() {
  return api.get<AgentProfile>('/api/agents/me')
}

export function updateMe(body: { nom: string; prenom: string; telephone: string; photo: string | null }) {
  return api.patch<AgentProfile>('/api/agents/me', body)
}

export function changePassword(currentPassword: string, newPassword: string) {
  return api.post<{ message: string } & Partial<LoginSuccess>>('/api/agents/me/password', {
    currentPassword,
    newPassword,
  })
}

export function completePasswordSetup(token: string, newPassword: string) {
  return api.post<{ message: string }>('/api/auth/password-setup', { token, newPassword }, { skipAuth: true })
}

export function requestPasswordReset(email: string) {
  return api.post<{ message: string }>('/api/auth/password-reset', { email }, { skipAuth: true })
}
