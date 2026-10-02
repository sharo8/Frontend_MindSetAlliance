import { api } from './client'

export type AssistantKpiTone = 'total' | 'positive' | 'negative' | 'filter' | 'neutral'

export type AssistantFactColumn = { key: string; label: string; kind?: 'action' | null }

export type AssistantFact = {
  title: string
  kind: string
  rows?: Array<Record<string, unknown>>
  kpis?: Array<{ label: string; value: unknown; tone?: AssistantKpiTone | null }>
  /** Absent des conversations enregistrées avant la détection de langue. */
  columns?: AssistantFactColumn[] | null
}

export type AssistantChatResponse = {
  answer: string
  facts: AssistantFact[]
  unavailable: boolean
  unavailableReason?: string | null
  conversationId?: number | null
  /** Langue détectée de la question (fr, en, ln, sw). */
  language?: string | null
  /** count | list | detail | other — les cartes KPI ne s'affichent que pour list/detail. */
  intent?: 'count' | 'list' | 'detail' | 'other' | string | null
}

export type AssistantStatus = {
  configured?: boolean
  available?: boolean
  reason?: string | null
}

export type AssistantConversationSummary = {
  id: number
  title: string
  createdAt: string
  lastActivityAt: string
}

export type AssistantConversationPage = {
  items: AssistantConversationSummary[]
  total: number
  hasMore: boolean
}

export type AssistantStoredMessage = {
  id: string
  role: 'user' | 'assistant' | string
  content: string
  at: string
  facts?: AssistantFact[]
  unavailable?: boolean
}

export type AssistantConversationDetail = {
  id: number
  title: string
  createdAt: string
  lastActivityAt: string
  messages: AssistantStoredMessage[]
}

export function fetchAssistantStatus() {
  return api.get<AssistantStatus>('/api/admin/assistant/status')
}

export function askAssistant(
  message: string,
  history: Array<{ role: string; content: string }>,
  conversationId?: number | null,
) {
  return api.post<AssistantChatResponse>('/api/admin/assistant/chat', { message, history, conversationId })
}

export function fetchAssistantConversations(q: string, offset: number, limit = 20) {
  const params = new URLSearchParams({ offset: String(offset), limit: String(limit) })
  if (q.trim()) params.set('q', q.trim())
  return api.get<AssistantConversationPage>(`/api/admin/assistant/conversations?${params}`)
}

export function fetchAssistantConversation(id: number) {
  return api.get<AssistantConversationDetail>(`/api/admin/assistant/conversations/${id}`)
}

export function archiveAssistantConversation(id: number) {
  return api.del<void>(`/api/admin/assistant/conversations/${id}`)
}
