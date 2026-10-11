import { api } from './client'

export type AccueilActivite = { date: string; jour: string; valeur: number }
export type AccueilSlice = { label: string; valeur: number; couleur: string }
export type AccueilBin = { tranche: string; occurrences: number }

export type AccueilDashboard = {
  vue: 'TICKETS' | 'FINANCE' | 'RH' | 'CNN'
  vuesDisponibles: Array<'TICKETS' | 'FINANCE' | 'RH' | 'CNN'>
  titreActivite: string
  titreRepartition: string
  titreHistogramme: string
  uniteActivite?: string
  activiteParJour: AccueilActivite[]
  activiteMessage?: string | null
  repartitionParStatut: AccueilSlice[]
  histogrammeDelais: AccueilBin[]
  histogrammeDisponible?: boolean
  histogrammeMessage?: string | null
  syntheseTendance?: string | null
  source?: string
  readOnlyVerified?: boolean
  message?: string | null
  coursesLivreesJour?: number | null
  coursesLivreesTotal?: number | null
  coursiersActifs?: number | null
  abonnementsRegles?: number | null
  livraisonJourMessage?: string | null
  ageSecondes?: number | null
}

export function fetchAccueilDashboard(vue?: string, projectCode?: string) {
  const query = new URLSearchParams({ periode: '7j' })
  if (vue) query.set('vue', vue)
  if (projectCode && projectCode !== 'ENTREPRISE') query.set('projectCode', projectCode)
  return api.get<AccueilDashboard>(`/api/dashboard/accueil?${query}`)
}
