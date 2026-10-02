import { hasFullAccess } from './permissions'
import i18n from '../i18n/i18n'

export type RoleAssignment = {
  projectCode: string | null
  role: string
}

export type PermissionOverride = {
  permission: string
  projectCode: string | null
  type: 'GRANT' | 'DENY'
}

export type AccessTokenClaims = {
  sub: string
  email?: string
  roles?: RoleAssignment[]
  permissionOverrides?: PermissionOverride[]
  mustChangePassword?: boolean
  exp?: number
  iss?: string
}

export const PROJECT_LABELS: Record<string, string> = {
  CNN: 'Colis na Nga',
  MDR: 'Mindset du Royaume',
  SSS: 'Smart Sys Solution',
}

export const ROLE_LABELS: Record<string, string> = {
  SUPPORT: 'Support',
  FINANCE: 'Finance',
  RH: 'Ressources humaines',
  JURIDIQUE: 'Juridique',
  MARKETING: 'Marketing',
  DEV: 'Développement',
  DIRECTION: 'Direction',
  COMMERCIAL: 'Commercial',
  ADMIN_SYSTEME: 'Administration système',
  CONSEIL_ADMINISTRATION: 'Conseil d’administration',
}

export { hasFullAccess, permissionLabel, PERMISSION_LABELS, FULL_ACCESS_ROLES } from './permissions'

/** Copie de navigation seulement — la matrice et Accès agent lisent /api/roles/{id}/permissions. */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN_SYSTEME: [
    'VIEW_PAYROLL',
    'EDIT_INVOICE',
    'VALIDATE_COURIER',
    'MANAGE_AGENTS',
    'VIEW_VITRINE',
    'MANAGE_TICKETS',
    'VIEW_FINANCE',
    'MANAGE_HR',
    'SYSTEM_ADMIN',
    'MANAGE_USERS',
    'MANAGE_PERMISSIONS',
    'MANAGE_ACCESS',
    'VIEW_MAP',
    'VALIDATE_DRIVER',
    'VIEW_BI_DASHBOARD',
    'VIEW_MEDIA',
    'MANAGE_PARTNERS',
    'VIEW_MONITORING',
    'VIEW_AUDIT',
    'VIEW_TICKETS',
    'MANAGE_OWN_PROFILE',
  ],
  DIRECTION: [
    'VIEW_PAYROLL',
    'VIEW_FINANCE',
    'VIEW_VITRINE',
    'MANAGE_TICKETS',
    'MANAGE_HR',
    'VIEW_BI_DASHBOARD',
    'VIEW_MAP',
    'VIEW_EXECUTIVE_DASHBOARD',
    'EXPORT_FINANCIAL_REPORTS',
    'VIEW_AUDIT',
    'VIEW_B2C_VOLUME',
    'VIEW_TICKETS',
    'MANAGE_OWN_PROFILE',
  ],
  CONSEIL_ADMINISTRATION: ['VIEW_VITRINE', 'VIEW_FINANCE', 'VIEW_PAYROLL', 'VIEW_EXECUTIVE_DASHBOARD', 'MANAGE_OWN_PROFILE', 'VIEW_BI_DASHBOARD'],
  FINANCE: [
    'VIEW_PAYROLL',
    'EDIT_INVOICE',
    'VIEW_FINANCE',
    'VIEW_VITRINE',
    'MANAGE_SUBSCRIPTIONS',
    'MANAGE_INVOICING',
    'VIEW_B2C_VOLUME',
    'VIEW_TICKETS',
    'MANAGE_TICKETS',
    'MANAGE_OWN_PROFILE',
  ],
  RH: [
    'VIEW_PAYROLL',
    'MANAGE_HR',
    'VIEW_VITRINE',
    'MANAGE_USERS',
    'MANAGE_ACCESS',
    'MANAGE_INTERNAL_AGENTS',
    'MANAGE_STAFF',
    'VIEW_TICKETS',
    'MANAGE_TICKETS',
    'MANAGE_OWN_PROFILE',
  ],
  SUPPORT: [
    'MANAGE_TICKETS',
    'VIEW_VITRINE',
    'VALIDATE_COURIER',
    'VIEW_MAP',
    'VALIDATE_DRIVER',
    'VIEW_FLEET_MAP',
    'MANAGE_COURSES',
    'RESOLVE_INCIDENTS',
    'VIEW_TICKETS',
    'MANAGE_OWN_PROFILE',
  ],
  DEV: ['VIEW_VITRINE', 'MANAGE_TICKETS', 'VIEW_MONITORING', 'MANAGE_BUG_TICKETS', 'VIEW_TICKETS', 'MANAGE_OWN_PROFILE'],
  MARKETING: ['VIEW_VITRINE', 'VIEW_MEDIA', 'VIEW_MARKETING_PERFORMANCE', 'MANAGE_MEDIA_LIBRARY', 'VIEW_TICKETS', 'MANAGE_OWN_PROFILE'],
  COMMERCIAL: [
    'VIEW_VITRINE',
    'MANAGE_TICKETS',
    'VALIDATE_DRIVER',
    'VALIDATE_COURIER',
    'MANAGE_ENTERPRISE_ACCOUNTS',
    'VIEW_TICKETS',
    'MANAGE_OWN_PROFILE',
  ],
  JURIDIQUE: [
    'VIEW_VITRINE',
    'MANAGE_TICKETS',
    'MANAGE_PARTNERS',
    'MANAGE_PARTNER_REGISTRY',
    'MANAGE_COMPLIANCE',
    'VIEW_TICKETS',
    'MANAGE_OWN_PROFILE',
  ],
}

export const TICKET_ROLES = [
  'SUPPORT',
  'DIRECTION',
  'ADMIN_SYSTEME',
  'DEV',
  'COMMERCIAL',
  'FINANCE',
  'RH',
  'JURIDIQUE',
]

export function projectLabel(code: string | null | undefined) {
  if (!code) return i18n.t('common.wholeCompany')
  return PROJECT_LABELS[code] ?? code
}

export function roleLabel(role: string) {
  return i18n.t(`roles.${role}`, { defaultValue: ROLE_LABELS[role] ?? role })
}

export function agentIdFromSubject(sub: string | undefined) {
  if (!sub) return null
  const match = sub.match(/agent-id-(\d+)/)
  return match ? Number(match[1]) : null
}

export function isCompanyWide(roles: RoleAssignment[]) {
  return roles.some((role) => role.projectCode == null)
}

export function visibleProjectCodes(roles: RoleAssignment[]): string[] {
  if (hasFullAccess(roles) || isCompanyWide(roles)) return ['*']
  return [...new Set(roles.map((role) => role.projectCode).filter((code): code is string => Boolean(code)))]
}

export function hasAnyRole(roles: RoleAssignment[], allowed: string[], projectCode?: string | null) {
  if (hasFullAccess(roles)) return true
  const allowedSet = new Set(allowed.map((r) => r.toUpperCase()))
  return roles.some((assignment) => {
    if (!allowedSet.has(assignment.role.toUpperCase())) return false
    if (!projectCode || projectCode === 'ENTREPRISE') return true
    return assignment.projectCode == null || assignment.projectCode === projectCode
  })
}

function overrideApplies(override: PermissionOverride, projectCode?: string | null) {
  if (!override.projectCode) return true
  if (!projectCode || projectCode === 'ENTREPRISE') return false
  return override.projectCode === projectCode
}

export function hasPermission(
  roles: RoleAssignment[],
  permission: string,
  projectCode?: string | null,
  overrides: PermissionOverride[] = [],
) {
  const denied = overrides.some((o) => o.type === 'DENY' && o.permission === permission && overrideApplies(o, projectCode))
  if (denied) return false
  const granted = overrides.some((o) => o.type === 'GRANT' && o.permission === permission && overrideApplies(o, projectCode))
  if (granted) return true
  if (hasFullAccess(roles)) return true
  return roles.some((assignment) => {
    const perms = ROLE_PERMISSIONS[assignment.role] ?? []
    if (!perms.includes(permission)) return false
    if (!projectCode || projectCode === 'ENTREPRISE') return true
    return assignment.projectCode == null || assignment.projectCode === projectCode
  })
}

export type MenuItem = {
  id: string
  label: string
  to: string
  roles?: string[]
  permission?: string
  permissions?: string[]
  projectCodes?: string[]
  group?: string
  projectTag?: string
}

export type NavSection = {
  id: string
  label?: string
  projectTag?: string
  items: MenuItem[]
}

function itemVisible(item: MenuItem, roles: RoleAssignment[], currentProject: string, overrides: PermissionOverride[] = []) {
  if (item.projectCodes) {
    const visible = visibleProjectCodes(roles)
    const allowedByJwt = visible.includes('*') || item.projectCodes.some((code) => visible.includes(code))
    if (!allowedByJwt) return false
    if (currentProject === 'ENTREPRISE') {
      // continue permission checks
    } else if (!item.projectCodes.includes(currentProject)) {
      return false
    }
  }
  const scope = currentProject === 'ENTREPRISE' ? null : currentProject
  if (item.permissions?.length) return item.permissions.some((p) => hasPermission(roles, p, scope, overrides))
  if (item.permission) return hasPermission(roles, item.permission, scope, overrides)
  if (item.roles) return hasAnyRole(roles, item.roles, scope)
  return true
}

export function buildNavSections(roles: RoleAssignment[], currentProject: string, overrides: PermissionOverride[] = []): NavSection[] {
  const catalog: NavSection[] = [
    { id: 'home', items: [{ id: 'accueil', label: 'Accueil', to: '/' }] },
    {
      id: 'operations',
      label: 'Opérations',
      projectTag: currentProject !== 'ENTREPRISE' ? currentProject : undefined,
      items: [
        { id: 'cnn', label: 'Supervision opérationnelle', to: '/supervision/operations', permissions: ['VIEW_FLEET_MAP', 'MANAGE_COURSES', 'RESOLVE_INCIDENTS'] },
        { id: 'fleet', label: 'Cartographie flotte', to: '/operations/flotte', permissions: ['VIEW_FLEET_MAP', 'MANAGE_COURSES'] },
        { id: 'incidents', label: 'Incidents', to: '/operations/incidents', permissions: ['RESOLVE_INCIDENTS'] },
      ],
    },
    {
      id: 'tickets-sec',
      label: 'Billetterie',
      items: [{ id: 'tickets', label: 'Tickets', to: '/tickets', permission: 'VIEW_TICKETS' }],
    },
    {
      id: 'commercial',
      label: 'Commercial',
      items: [
        { id: 'couriers', label: 'Coursiers & affiliations', to: '/commercial/coursiers', permission: 'VALIDATE_COURIER' },
        { id: 'enterprises', label: 'Comptes entreprises', to: '/commercial/entreprises', permission: 'MANAGE_ENTERPRISE_ACCOUNTS' },
      ],
    },
    {
      id: 'finance',
      label: 'Finance',
      items: [
        { id: 'finance-home', label: 'Pilotage financier', to: '/finance', permissions: ['VIEW_FINANCE', 'MANAGE_SUBSCRIPTIONS', 'MANAGE_INVOICING', 'VIEW_B2C_VOLUME'] },
        { id: 'subscriptions', label: 'Abonnements', to: '/finance/abonnements', permission: 'MANAGE_SUBSCRIPTIONS' },
        { id: 'invoicing', label: 'Facturation', to: '/finance/facturation', permission: 'MANAGE_INVOICING' },
        { id: 'b2c', label: 'Suivi B2C', to: '/finance/b2c', permission: 'VIEW_B2C_VOLUME' },
      ],
    },
    {
      id: 'hr',
      label: 'Ressources humaines',
      items: [
        { id: 'rh', label: 'Vue RH', to: '/rh', permissions: ['MANAGE_HR', 'MANAGE_INTERNAL_AGENTS', 'MANAGE_STAFF', 'VIEW_PAYROLL'] },
        { id: 'agents-hr', label: 'Agents internes', to: '/rh/agents', permissions: ['MANAGE_INTERNAL_AGENTS', 'MANAGE_HR', 'MANAGE_USERS'] },
        { id: 'leaves', label: 'Personnel & congés', to: '/rh/conges', permission: 'MANAGE_STAFF' },
        { id: 'payroll', label: 'Paie', to: '/rh/paie', permission: 'VIEW_PAYROLL' },
      ],
    },
    {
      id: 'legal',
      label: 'Juridique',
      items: [
        { id: 'partners', label: 'Registre partenaires', to: '/juridique/partenaires', permission: 'MANAGE_PARTNER_REGISTRY' },
        { id: 'compliance', label: 'Conformité', to: '/juridique/conformite', permission: 'MANAGE_COMPLIANCE' },
      ],
    },
    {
      id: 'marketing',
      label: 'Marketing & média',
      items: [
        { id: 'mkt', label: 'Performance', to: '/marketing/performance', permission: 'VIEW_MARKETING_PERFORMANCE' },
        { id: 'media', label: 'Médiathèque', to: '/marketing/mediatheque', permission: 'MANAGE_MEDIA_LIBRARY' },
        { id: 'mdr', label: 'Vue média', to: '/supervision/mdr', permission: 'VIEW_MARKETING_PERFORMANCE' },
      ],
    },
    {
      id: 'tech',
      label: 'Technique',
      items: [
        { id: 'monitoring', label: 'Monitoring', to: '/technique/monitoring', permission: 'VIEW_MONITORING' },
        { id: 'bugs', label: 'Bugs & Déploiements', to: '/tickets-techniques', permission: 'MANAGE_BUG_TICKETS' },
      ],
    },
    {
      id: 'direction',
      label: 'Direction',
      items: [
        { id: 'direction', label: 'Tableau de bord exécutif', to: '/direction', permissions: ['VIEW_EXECUTIVE_DASHBOARD'], roles: ['DIRECTION', 'CONSEIL_ADMINISTRATION', 'ADMIN_SYSTEME'] },
        { id: 'stats', label: 'Statistiques globales', to: '/admin/statistiques', roles: ['ADMIN_SYSTEME', 'DIRECTION'] },
      ],
    },
    {
      id: 'admin',
      label: 'Administration',
      items: [
        { id: 'access', label: 'Gestion des accès', to: '/admin/acces', permission: 'MANAGE_ACCESS' },
        { id: 'societes', label: 'Sociétés', to: '/admin/societes', roles: ['ADMIN_SYSTEME', 'DIRECTION'] },
        { id: 'users', label: 'Agents', to: '/admin/utilisateurs', permissions: ['MANAGE_USERS', 'MANAGE_ACCESS', 'MANAGE_AGENTS'] },
        { id: 'departements', label: 'Départements', to: '/admin/departements', roles: ['ADMIN_SYSTEME', 'DIRECTION'] },
        { id: 'permissions', label: 'Rôles & permissions', to: '/admin/permissions', permission: 'MANAGE_PERMISSIONS' },
        { id: 'rapports', label: 'Rapports', to: '/admin/rapports', roles: ['ADMIN_SYSTEME', 'DIRECTION'] },
        { id: 'assistant', label: 'Assistant IA', to: '/admin/assistant-ia', roles: ['ADMIN_SYSTEME', 'DIRECTION'] },
        { id: 'audit', label: 'Journal d’audit', to: '/admin/audit', permission: 'VIEW_AUDIT' },
      ],
    },
    {
      id: 'footer',
      items: [
        { id: 'documents', label: 'Documents', to: '/documents' },
        { id: 'compte', label: 'Mon compte', to: '/compte' },
      ],
    },
  ]

  return catalog
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => itemVisible(item, roles, currentProject, overrides)),
    }))
    .filter((section) => section.items.length > 0)
}

export function buildMenuFromPermissions(roles: RoleAssignment[], currentProject: string) {
  return buildNavSections(roles, currentProject).flatMap((section) => section.items)
}
