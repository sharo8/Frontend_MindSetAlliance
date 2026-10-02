import { api } from './client'

export type VitrineKpi = {
  id: number
  project?: { id: number; code: string; nom: string }
  categorie: string
  cle: string
  valeur: number | string | null
  derniereMaj?: string
}

export function fetchVitrine() {
  return api.get<VitrineKpi[]>('/api/vitrine')
}

export type NotificationItem = {
  id: number
  canal: string
  titre: string
  message: string
  lu: boolean
  createdAt: string
}

export function fetchNotifications() {
  return api.get<NotificationItem[]>('/api/notifications')
}

export function markNotificationRead(id: number) {
  return api.post<NotificationItem>(`/api/notifications/${id}/lu`, {})
}

export type Project = {
  id: number
  code: string
  nom: string
  statut: string
  description?: string
  villeReference?: string | null
  createdAt?: string
  agentsCount?: number
}

export function fetchProjects() {
  return api.get<Project[]>('/api/iam/projects')
}

export type AgentDto = {
  id: number
  emailPro: string
  nom: string
  prenom: string
  statut: string
  twoFactorEnabled: boolean
  roles: { id: number; role: string; projectCode: string | null }[]
}

export function fetchAgents() {
  return api.get<AgentDto[]>('/api/iam/agents')
}

export type Ecriture = {
  id: number
  type: string
  libelle: string
  montant: number
  devise: string
  statut: string
  project?: { code: string; nom: string }
}

export function fetchEcritures() {
  return api.get<Ecriture[]>('/api/finance/ecritures')
}

export function fetchBudgets() {
  return api.get<{ id: number; annee: number; libelle: string; montantPrevu: number; devise: string }[]>(
    '/api/finance/budgets',
  )
}

export type DocumentItem = {
  id: number
  titre: string
  categorie?: string
  nomFichier: string
  createdAt?: string
  projectCode?: string | null
  statut?: string
}

export function fetchDocuments() {
  return api.get<DocumentItem[]>('/api/documents')
}

export function uploadDocument(form: FormData) {
  return api.post<{ id: number; titre: string; message: string }>('/api/documents', form)
}

export function archiveDocument(id: number, motif: string) {
  return api.post<{ message: string }>(`/api/documents/${id}/archive`, { motif })
}
