import { api } from './client'

export type StatsPeriod = '7' | '30' | '90' | 'ALL'

export type StatsPoint = {
  code: string
  label: string
  valeur: number
  date?: string
  pct?: number
  possedees?: number
  total?: number
}

export type StatsActifs = {
  actifs: number
  total: number
  taux: number
}

export type StatsRolesParProjet = {
  roles: string[]
  series: Array<Record<string, string | number>>
}

export type StatsCoverageRole = {
  code: string
  label: string
  modules: StatsPoint[]
}

export type StatsCoverage = {
  modules: string[]
  roles: StatsCoverageRole[]
}

export type StatsTreemapNode = {
  name: string
  size: number
  priorite?: string
  children?: StatsTreemapNode[]
}

export type StatsHeatCell = StatsPoint & {
  jour: string
  jourIndex: number
  heure: number
}

export type StatsHeatmap = {
  jours: string[]
  max: number
  cells: StatsHeatCell[]
}

export type StatsWeekPoint = {
  semaine: string
  label: string
  agents: number
  tickets: number
}

export type StatsScatterPoint = {
  id: number
  reference: string
  priorite: string
  prioriteLabel: string
  x: number
  heures: number
}

export type SystemStats = {
  period: StatsPeriod
  generatedAt: string
  agentsActifs: StatsActifs
  agentsParDepartement: StatsPoint[]
  agentsParPerimetre: StatsPoint[]
  ticketsParStatut: StatsPoint[]
  ancienneteComptes: StatsPoint[]
  ticketsParJour: StatsPoint[]
  permissionsTop: StatsPoint[]
  rolesParProjet: StatsRolesParProjet
  permissionCoverage: StatsCoverage
  ticketsTreemap: StatsTreemapNode[]
  loginHeatmap: StatsHeatmap
  ticketFunnel: StatsPoint[]
  agentsVsTickets: StatsWeekPoint[]
  resolutionScatter: StatsScatterPoint[]
}

export function fetchSystemStats(period: StatsPeriod) {
  return api.get<SystemStats>(`/api/admin/stats?period=${period}`)
}
