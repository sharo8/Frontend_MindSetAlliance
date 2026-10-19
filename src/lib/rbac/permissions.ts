/**
 * Accès total ADMIN_SYSTEME / DIRECTION — répliqué à l’identique côté backend
 * (JwtRoles.hasFullAccess + RoleGuardAspect). Le frontend n’autorise rien
 * que le Core n’autorise pas déjà.
 */
export const FULL_ACCESS_ROLES = ['ADMIN_SYSTEME', 'DIRECTION'] as const

export const PERMISSION_LABELS: Record<string, string> = {
  VIEW_FLEET_MAP: 'Voir la cartographie de la flotte',
  MANAGE_COURSES: 'Gérer les courses',
  RESOLVE_INCIDENTS: 'Traiter les incidents',
  VALIDATE_COURIER: 'Valider un coursier',
  MANAGE_ENTERPRISE_ACCOUNTS: 'Gérer les comptes entreprises',
  MANAGE_SUBSCRIPTIONS: 'Gérer les abonnements',
  MANAGE_INVOICING: 'Gérer la facturation',
  VIEW_B2C_VOLUME: 'Voir le volume B2C',
  MANAGE_INTERNAL_AGENTS: 'Gérer les agents internes',
  MANAGE_STAFF: 'Gérer le personnel et les congés',
  MANAGE_ACCESS: 'Administrer les accès',
  VIEW_PAYROLL: 'Consulter la paie',
  MANAGE_PARTNER_REGISTRY: 'Tenir le registre des partenaires',
  MANAGE_COMPLIANCE: 'Gérer la conformité',
  VIEW_MARKETING_PERFORMANCE: 'Voir la performance marketing',
  MANAGE_MEDIA_LIBRARY: 'Gérer la médiathèque',
  VIEW_MONITORING: 'Voir le monitoring technique',
  MANAGE_BUG_TICKETS: 'Gérer les tickets techniques',
  VIEW_EXECUTIVE_DASHBOARD: 'Voir le tableau de bord exécutif',
  EXPORT_FINANCIAL_REPORTS: 'Exporter les rapports financiers',
  VIEW_AUDIT: 'Consulter le journal d’audit',
  VIEW_TICKETS: 'Voir les tickets',
  MANAGE_TICKETS: 'Traiter les tickets',
  MANAGE_OWN_PROFILE: 'Gérer son profil',
  MANAGE_USERS: 'Gérer les comptes utilisateurs',
  MANAGE_PERMISSIONS: 'Gérer les rôles et permissions',
  MANAGE_AGENTS: 'Administrer les agents',
  MANAGE_HR: 'Gérer les ressources humaines',
  VIEW_FINANCE: 'Voir la finance',
  EDIT_INVOICE: 'Éditer une facture',
  VIEW_VITRINE: 'Voir la vitrine consolidée',
  VIEW_MAP: 'Voir la carte',
  VALIDATE_DRIVER: 'Valider un chauffeur',
  VIEW_BI_DASHBOARD: 'Voir le tableau de bord BI',
  VIEW_MEDIA: 'Voir les médias',
  MANAGE_PARTNERS: 'Gérer les partenaires',
  SYSTEM_ADMIN: 'Administration technique',
  VIEW_CNN_DASHBOARD: 'Colis na Nga : tableau de bord',
  MANAGE_CNN_ORDERS: 'Colis na Nga : commandes et livraisons',
  MANAGE_CNN_AGENTS: 'Colis na Nga : livreurs',
  MANAGE_CNN_MOTARDS: 'Colis na Nga : motards et signalements',
  MANAGE_CNN_ASSOCIATIONS: 'Colis na Nga : associations et reversements',
  MANAGE_CNN_CLIENTS: 'Colis na Nga : clients',
  MANAGE_CNN_SUBSCRIPTIONS: 'Colis na Nga : abonnements et factures',
  MANAGE_CNN_PAYMENTS: 'Colis na Nga : paiements Mobile Money',
  MANAGE_CNN_SETTINGS: 'Colis na Nga : tarifs et taux',
  MANAGE_CNN_ADMINS: 'Colis na Nga : administrateurs et audit',
}

export function hasFullAccess(roles: { role: string }[]) {
  return roles.some((assignment) => (FULL_ACCESS_ROLES as readonly string[]).includes(assignment.role))
}

export function permissionLabel(code: string) {
  return PERMISSION_LABELS[code] ?? code.replaceAll('_', ' ').toLowerCase()
}
