import { api } from './client'

export type AccueilActivite = { date: string; jour: string; valeur: number }
export type AccueilSlice = { label: string; valeur: number; couleur: string }
export type AccueilBin = { tranche: string; occurrences: number }

export type AccueilDashboard = {
  vue: 'TICKETS' | 'FINANCE' | 'RH'
  vuesDisponibles: Array<'TICKETS' | 'FINANCE' | 'RH'>
  titreActivite: string
  titreRepartition: string
  titreHistogramme: string
  uniteActivite?: string
  activiteParJour: AccueilActivite[]
  repartitionParStatut: AccueilSlice[]
  histogrammeDelais: AccueilBin[]
  syntheseTendance?: string | null
}

export function fetchAccueilDashboard(vue?: string, projectCode?: string) {
  const query = new URLSearchParams({ periode: '7j' })
  if (vue) query.set('vue', vue)
  if (projectCode && projectCode !== 'ENTREPRISE') query.set('projectCode', projectCode)
  return api.get<AccueilDashboard>(`/api/dashboard/accueil?${query}`)
}
