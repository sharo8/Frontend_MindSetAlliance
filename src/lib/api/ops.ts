import { api } from './client'

export type OpsRecord = {
  id: number
  module: string
  titre: string
  description?: string | null
  statut: string
  priorite?: string | null
  zone?: string | null
  canal?: string | null
  montant?: number | null
  motif?: string | null
  projectCode?: string | null
  createdAt?: string
}

export function listOps(module: string, projectCode?: string) {
  const search = new URLSearchParams()
  if (projectCode && projectCode !== 'ENTREPRISE') search.set('projectCode', projectCode)
  const query = search.toString()
  return api.get<OpsRecord[]>(`/api/ops/${module}${query ? `?${query}` : ''}`)
}

export function createOps(module: string, body: Partial<OpsRecord> & { titre: string; projectCode?: string }) {
  return api.post<OpsRecord>(`/api/ops/${module}`, body)
}

export function updateOps(module: string, id: number, body: Partial<OpsRecord> & { titre: string }) {
  return api.put<OpsRecord>(`/api/ops/${module}/${id}`, body)
}

export function archiveOps(module: string, id: number, motif: string) {
  return api.post<OpsRecord>(`/api/ops/${module}/${id}/archive`, { motif })
}

export type CnnDashboard = {
  coursesDuJour: number
  coursiersActifs: number
  tauxLivraison: number
  incidentsOuverts: number
  volume30j: { jour: string; volume: number }[]
  parZone: { zone: string; volume: number }[]
  parStatut: { statut: string; volume: number }[]
  incidents: OpsRecord[]
  live?: boolean
  source?: string
}

export function fetchCnnDashboard(projectCode?: string) {
  const search = new URLSearchParams()
  if (projectCode) search.set('projectCode', projectCode)
  const query = search.toString()
  return api.get<CnnDashboard>(`/api/ops/dashboards/cnn${query ? `?${query}` : ''}`)
}

export type FinanceDashboard = {
  recettesMois: number
  depensesMois: number
  facturesRetard: number
  tresorerie: number
  comparaison6m: { mois: string; recettes: number; depenses: number }[]
  parCanal: { canal: string; montant: number }[]
}

export function fetchFinanceDashboard(projectCode?: string) {
  const search = new URLSearchParams()
  if (projectCode && projectCode !== 'ENTREPRISE') search.set('projectCode', projectCode)
  const query = search.toString()
  return api.get<FinanceDashboard>(`/api/ops/dashboards/finance${query ? `?${query}` : ''}`)
}

export type RhDashboard = {
  effectif: number
  presence: number
  congesAttente: number
  contratsEcheance: number
  parDepartement: { departement: string; effectif: number }[]
}

export function fetchRhDashboard(projectCode?: string) {
  const search = new URLSearchParams()
  if (projectCode && projectCode !== 'ENTREPRISE') search.set('projectCode', projectCode)
  const query = search.toString()
  return api.get<RhDashboard>(`/api/ops/dashboards/rh${query ? `?${query}` : ''}`)
}

export type AuditRow = {
  id: number
  action: string
  actionLibelle?: string
  objetType: string
  objetId?: number
  createdAt: string
  highlighted?: boolean
  valeurApres?: Record<string, unknown>
  agent?: { emailPro?: string; nom?: string }
}

export function fetchAudit(page = 0, opts?: { logId?: string; objetId?: string }) {
  const query = new URLSearchParams()
  query.set('page', String(page))
  query.set('size', '20')
  if (opts?.logId) query.set('logId', opts.logId)
  if (opts?.objetId) query.set('objetId', opts.objetId)
  return api.get<{ content: AuditRow[]; totalPages: number; number: number }>(`/api/audit?${query}`)
}
