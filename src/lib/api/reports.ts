import { api } from './client'
import i18n from '../i18n/i18n'

export type ReportKind = 'utilisateurs' | 'permissions' | 'acces' | 'organisation' | 'statistiques'

export type ReportHistoryItem = {
  id: number
  createdAt: string
  type: string
  titre: string
  kind: ReportKind | ''
  administrateur: string
  details?: Record<string, unknown>
}

export async function downloadAdminReport(kind: ReportKind, params: Record<string, string> = {}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value)
  }
  const lang = (i18n.language || 'fr').split('-')[0]
  if (lang) query.set('lang', lang)
  const qs = query.toString()
  const buffer = await api.get<ArrayBuffer>(`/api/admin/rapports/${kind}.pdf${qs ? `?${qs}` : ''}`)
  const blob = new Blob([buffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `MA-rapport-${kind}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}

export function fetchReportHistory() {
  return api.get<ReportHistoryItem[]>('/api/admin/rapports/historique')
}
