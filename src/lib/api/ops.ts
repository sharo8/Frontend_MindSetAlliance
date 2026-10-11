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
  lectureSeule?: boolean
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
  coursesDuJour: number | null
  coursesLivreesJour?: number | null
  coursesLivreesPeriode?: number | null
  coursesLivreesTotal?: number | null
  coursesAnnulees?: number | null
  coursiersActifs: number | null
  coursiersExpires?: number | null
  coursiersExpiresMessage?: string | null
  tauxLivraison: number | null
  incidentsOuverts: number | null
  urgences?: number | null
  abonnementsRegles?: number | null
  abonnementsMontant?: number | null
  abonnementsExpires?: number | null
  volume30j: { jour: string; volume: number }[]
  volumeMessage?: string | null
  parZone: { zone: string; volume: number }[]
  zoneDisponible?: boolean
  zoneMessage?: string | null
  parStatut: { statut: string; volume: number; libelle?: string; couleur?: string }[]
  incidents: OpsRecord[]
  live?: boolean
  disponible?: boolean
  source?: string
  readOnlyVerified?: boolean
  message?: string | null
  retardsMessage?: string | null
  refusMessage?: string | null
  derniereCourse?: string | null
  derniereLivraison?: string | null
  livraisonJourMessage?: string | null
  calculeLe?: string | null
  ageSecondes?: number | null
}

export function fetchCnnDashboard(projectCode?: string) {
  const search = new URLSearchParams()
  if (projectCode) search.set('projectCode', projectCode)
  const query = search.toString()
  return api.get<CnnDashboard>(`/api/ops/dashboards/cnn${query ? `?${query}` : ''}`)
}

export type FinanceMoney = {
  devise: string | null
  deviseStockee: boolean
  mois: number
  total: number
  dernier: string | null
}

export type FinanceMonth = {
  mois: string
  montants?: { devise: string | null; deviseStockee: boolean; montant: number }[]
  recettes?: number
  depenses?: number
}

export type FinanceDashboard = {
  recettesMois?: number | null
  depensesMois?: number | null
  facturesRetard?: number | null
  tresorerie?: number | null
  comparaison6m?: { mois: string; recettes: number; depenses?: number }[]
  recettesParDevise?: FinanceMoney[] | null
  serie6m?: FinanceMonth[]
  parCanal: { canal: string; montant: number; devise?: string | null; deviseStockee?: boolean }[]
  remboursements?: { statut: string; nombre: number; montant: number | null }[] | null
  volumeAffaires?: {
    montant: number
    courses: number
    coursesAvecMontant: number
    devise: string | null
    deviseStockee: boolean
  } | null
  source?: string
  readOnlyVerified?: boolean
  message?: string | null
  messageCode?: string | null
  ageSecondes?: number | null
}

export type DirectionCnn = {
  source?: string
  readOnlyVerified?: boolean
  messageCode?: string | null
  ageSecondes?: number | null
  calculeLe?: string | null
  coursesParMois?: { mois: string; volume: number }[]
  parStatut?: { statut: string; volume: number; couleur?: string }[]
  remboursementsEnAttente?: number | null
  appelsUrgence?: number | null
}

export function fetchDirectionDashboard(projectCode?: string) {
  const search = new URLSearchParams()
  if (projectCode && projectCode !== 'ENTREPRISE') search.set('projectCode', projectCode)
  const query = search.toString()
  return api.get<DirectionCnn>(`/api/ops/dashboards/direction${query ? `?${query}` : ''}`)
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
