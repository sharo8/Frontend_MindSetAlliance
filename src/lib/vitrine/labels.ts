export const CATEGORIE_LABELS: Record<string, string> = {
  OPERATIONNEL: 'Opérationnel',
  FINANCIER: 'Financier',
  AUDIENCE: 'Audience',
}

const CLE_LABELS: Record<string, string> = {
  courses_livrees_jour: 'Courses livrées (jour)',
  courses_livrees: 'Courses livrées (total)',
  coursiers_actifs: 'Agents opérationnels actifs',
  abonnements_regles: 'Abonnements réglés',
  revenu_b2c: 'Revenu B2C',
  revenu_b2b: 'Revenu B2B',
  vues_total: 'Vues cumulées',
  courses_jour: 'Courses du jour',
  revenu_mois_usd: 'Revenu du mois (USD)',
  revenu_mois_cdf: 'Revenu du mois (CDF)',
  abonnes: 'Abonnés',
  vues_mois: 'Vues du mois',
}

/** Mots courants des clés techniques, remis en français lisible. */
const WORDS: Record<string, string> = {
  jour: 'du jour',
  mois: 'du mois',
  semaine: 'de la semaine',
  annee: 'de l’année',
  abonnes: 'abonnés',
  reglés: 'réglés',
  regles: 'réglés',
  livrees: 'livrées',
  activite: 'activité',
  reussite: 'réussite',
  delai: 'délai',
  depenses: 'dépenses',
}
const UNITS = new Set(['usd', 'cdf', 'eur', 'b2b', 'b2c', 'kpi', 'sla'])

export function kpiLabel(cle: string, _categorie?: string) {
  if (CLE_LABELS[cle]) return CLE_LABELS[cle]
  const words = cle.toLocaleLowerCase('fr').split('_').filter(Boolean)
  const units = words.filter((w) => w === 'usd' || w === 'cdf' || w === 'eur').map((w) => w.toUpperCase())
  const text = words
    .filter((w) => !(w === 'usd' || w === 'cdf' || w === 'eur'))
    .map((w) => (UNITS.has(w) ? w.toUpperCase() : (WORDS[w] ?? w)))
    .join(' ')
  const label = text.charAt(0).toLocaleUpperCase('fr') + text.slice(1)
  return units.length ? `${label} (${units.join(', ')})` : label
}

export function categorieLabel(categorie: string) {
  return CATEGORIE_LABELS[categorie] ?? categorie
}
