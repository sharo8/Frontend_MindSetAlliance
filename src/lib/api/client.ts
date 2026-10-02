import { readSession } from '../auth/session'
import { useProjectStore } from '../projects/project-store'
import i18n from '../i18n/i18n'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function mapAuthError(message: string, status: number) {
  const lower = message.toLowerCase()
  if (lower.includes('désactiv') || lower.includes('desactiv')) {
    return i18n.t('authErrors.disabled')
  }
  if (status === 401 || lower.includes('identifiant')) {
    return i18n.t('authErrors.badCredentials')
  }
  if (status === 429) {
    return i18n.t('authErrors.tooMany')
  }
  if (status === 403) {
    return i18n.t('authErrors.forbidden')
  }
  if (status === 503 || lower.includes('smtp') || lower.includes('e-mail') || lower.includes('email')) {
    return message || i18n.t('authErrors.smtp')
  }
  if (status >= 500) {
    return i18n.t('authErrors.unavailable')
  }
  if (!message || /^erreur\s+\d+$/i.test(message)) {
    return i18n.t('authErrors.failed')
  }
  return message
}

async function parseError(response: Response) {
  try {
    const body = (await response.json()) as { message?: string }
    return body.message ?? `Erreur ${response.status}`
  } catch {
    return `Erreur ${response.status}`
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
  skipAuth?: boolean
  skipRefresh?: boolean
}

let refreshInFlight: Promise<boolean> | null = null
let scheduleRefresh: (() => void) | null = null

export function registerRefreshScheduler(fn: () => void) {
  scheduleRefresh = fn
}

export function setRefreshHandler(handler: () => Promise<boolean>) {
  refreshHandler = handler
}

let refreshHandler: () => Promise<boolean> = async () => false

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, skipRefresh, headers, ...rest } = options
  const session = skipAuth ? null : readSession()
  const project = useProjectStore.getState().currentProject

  const response = await fetch(path, {
    ...rest,
    headers: {
      ...(body !== undefined && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(session && !skipAuth ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(project && project !== 'ENTREPRISE' ? { 'X-MA-Project': project } : {}),
      'Accept-Language': (i18n.language || 'fr').split('-')[0],
      'X-MA-Lang': (i18n.language || 'fr').split('-')[0],
      ...headers,
    },
    body: body instanceof FormData || body === undefined ? (body as FormData | undefined) : JSON.stringify(body),
  })

  if (response.status === 401 && !skipAuth && !skipRefresh) {
    const ok = await refreshOnce()
    if (ok) {
      return apiRequest<T>(path, { ...options, skipRefresh: true })
    }
  }

  if (!response.ok) {
    throw new ApiError(await parseError(response), response.status)
  }

  if (response.status === 204) return undefined as T
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return (await response.json()) as T
  }
  return (await response.arrayBuffer()) as T
}

async function refreshOnce() {
  if (!refreshInFlight) {
    refreshInFlight = refreshHandler().finally(() => {
      refreshInFlight = null
    })
  }
  const ok = await refreshInFlight
  if (ok) scheduleRefresh?.()
  return ok
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'DELETE', body }),
}
