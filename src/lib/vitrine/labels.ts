export const CATEGORIE_LABELS: Record<string, string> = {
  OPERATIONNEL: 'Opérationnel',
  FINANCIER: 'Financier',
  AUDIENCE: 'Audience',
}

const CLE_LABELS: Record<string, string> = {
  courses_livrees_jour: 'Courses livrées (jour)',
  coursiers_actifs: 'Agents opérationnels actifs',
  revenu_b2c: 'Revenu B2C',
  revenu_b2b: 'Revenu B2B',
  vues_total: 'Vues cumulées',
}

export function kpiLabel(cle: string, _categorie?: string) {
  return CLE_LABELS[cle] ?? cle.replaceAll('_', ' ')
}

export function categorieLabel(categorie: string) {
  return CATEGORIE_LABELS[categorie] ?? categorie
}
