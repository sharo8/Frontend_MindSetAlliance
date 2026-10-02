import { api } from './client'

export type Ref = { id: number; code?: string; nom?: string; prenom?: string; emailPro?: string; hasPhoto?: boolean }

export type TicketSla = {
  engagementHeures?: number
  priseEnChargeMinutes?: number
  resolutionMinutes?: number
  respecte?: boolean
  depassement?: boolean
  echeanceDepassee?: boolean
  reouvertureJours?: number
}

export type Ticket = {
  id: number
  reference: string
  project?: Ref
  departementDestinataire?: Ref
  demandeur?: Ref
  attributaire?: Ref
  type: string
  systeme?: string
  categorie?: string
  categorieIncident?: string
  sourceExterne?: string
  sourceReference?: string
  priorite: string
  statut: string
  titre: string
  description?: string
  motifAnnulation?: string
  echeance?: string
  premierePriseEnChargeAt?: string
  resoluAt?: string
  objetLieType?: string
  objetLieId?: string
  objetLieLibelle?: string
  createdAt?: string
  updatedAt?: string
  sla?: TicketSla
  typeAutrePrecision?: string
  archive?: boolean
  historique?: TicketStatutEvent[]
  commentaires?: { id: number; contenu: string; createdAt: string; auteur?: Ref }[]
  piecesJointes?: { id: number; nomFichier?: string; typeMime?: string }[]
}

export type TicketStatutEvent = {
  id: number
  statutAvant?: string
  statutApres: string
  createdAt: string
  agent?: Ref
}

export type TicketCreatePayload = {
  projectCode: string
  departementDestinataireId: number
  type: string
  systeme?: 'SUPPORT' | 'TECHNIQUE'
  categorie?: string
  priorite: string
  titre: string
  description?: string
  echeance: string
  objetLieType?: string
  objetLieId?: string
  objetLieLibelle?: string
  typeAutrePrecision?: string
}

export type TicketAgent = {
  id: number
  nom: string
  prenom: string
  emailPro: string
  departementId?: number
  departementNom?: string
  hasPhoto?: boolean
}

export function listTickets(params: Record<string, string | undefined>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  const query = search.toString()
  return api.get<Ticket[]>(`/api/tickets${query ? `?${query}` : ''}`)
}

export function getTicket(id: number) {
  return api.get<Ticket>(`/api/tickets/${id}`)
}

export function createTicket(payload: TicketCreatePayload) {
  return api.post<Ticket>('/api/tickets', payload)
}

export function updateTicket(id: number, payload: TicketCreatePayload) {
  return api.put<Ticket>(`/api/tickets/${id}`, payload)
}

export function archiveTicket(id: number, motif?: string) {
  return api.post<Ticket>(`/api/tickets/${id}/archive`, { motif })
}

export function changeTicketStatus(id: number, statut: string, motif?: string) {
  return api.post<Ticket>(`/api/tickets/${id}/statut`, { statut, motif })
}

export function commentTicket(id: number, contenu: string) {
  return api.post(`/api/tickets/${id}/commentaires`, { contenu })
}

export function assignTicket(id: number, attributaireId: number) {
  return api.post<Ticket>(`/api/tickets/${id}/attribuer`, { attributaireId })
}

export function listTicketAgents() {
  return api.get<TicketAgent[]>('/api/tickets/agents')
}

export function listTicketDepartements() {
  return api.get<{ id: number; code: string; nom: string }[]>('/api/tickets/departements')
}

export function listTicketReattributions(id: number) {
  return api.get<
    {
      id: number
      createdAt: string
      ancienAgent?: Ref
      nouvelAgent?: Ref
      auteur?: Ref
    }[]
  >(`/api/tickets/${id}/reattributions`)
}

export function attachTicketFile(id: number, file: File) {
  const form = new FormData()
  form.append('fichier', file)
  return api.post(`/api/tickets/${id}/pieces-jointes`, form)
}

export async function exportTickets(projectCode?: string, systeme?: string) {
  const search = new URLSearchParams()
  if (projectCode && projectCode !== 'ENTREPRISE') search.set('projectCode', projectCode)
  if (systeme) search.set('systeme', systeme)
  const qs = search.toString()
  const buffer = await api.get<ArrayBuffer>(`/api/tickets/export${qs ? `?${qs}` : ''}`)
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'tickets.xlsx'
  link.click()
  URL.revokeObjectURL(url)
}
