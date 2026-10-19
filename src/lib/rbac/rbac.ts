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

/** Administration Colis na Nga (relais vers l'API admin de l'application). */
export const CNN_ADMIN_PERMISSIONS = [
  'VIEW_CNN_DASHBOARD',
  'MANAGE_CNN_ORDERS',
  'MANAGE_CNN_AGENTS',
  'MANAGE_CNN_MOTARDS',
  'MANAGE_CNN_ASSOCIATIONS',
  'MANAGE_CNN_CLIENTS',
  'MANAGE_CNN_SUBSCRIPTIONS',
  'MANAGE_CNN_PAYMENTS',
  'MANAGE_CNN_SETTINGS',
  'MANAGE_CNN_ADMINS',
]

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

/** Espaces de travail : l'entreprise (Mindset Alliance) ou un projet. */
export type Workspace = 'ENTREPRISE' | 'CNN' | 'MDR'

export type MenuItem = {
  id: string
  /** Espaces où l'entrée apparaît (absent = tous). Chaque projet n'affiche que ses propres menus. */
  workspaces?: Workspace[]
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
  workspaces?: Workspace[]
  label?: string
  projectTag?: string
  items: MenuItem[]
}

function itemVisible(
  item: MenuItem,
  roles: RoleAssignment[],
  currentProject: string,
  overrides: PermissionOverride[] = [],
  granted?: ReadonlySet<string>,
) {
  if (item.workspaces && !item.workspaces.includes(currentProject as Workspace)) return false
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
  // `granted` : permissions effectives calculées par le Core (rôles de la matrice compris).
  const can = (p: string) => Boolean(granted?.has(p)) || hasPermission(roles, p, scope, overrides)
  if (item.permissions?.length) return item.permissions.some(can)
  if (item.permission) return can(item.permission)
  if (item.roles) return hasAnyRole(roles, item.roles, scope)
  return true
}

export function buildNavSections(
  roles: RoleAssignment[],
  currentProject: string,
  overrides: PermissionOverride[] = [],
  granted?: ReadonlySet<string>,
): NavSection[] {
  const ENTREPRISE: Workspace[] = ['ENTREPRISE']
  const catalog: NavSection[] = [
    {
      id: 'home',
      items: [
        { id: 'accueil', label: 'Accueil', to: '/', workspaces: ['ENTREPRISE', 'MDR'] },
        { id: 'cnn-home', label: 'Tableau de bord', to: '/', workspaces: ['CNN'], permissions: ['VIEW_CNN_DASHBOARD'] },
        { id: 'cnn-map', label: 'Carte en direct', to: '/colis-na-nga/carte', workspaces: ['CNN'], permissions: ['VIEW_CNN_DASHBOARD'] },
        { id: 'cnn-stats', label: 'Statistiques', to: '/colis-na-nga/statistiques', workspaces: ['CNN'], permissions: ['VIEW_CNN_DASHBOARD'] },
      ],
    },
    // ── Colis na Nga : uniquement quand le projet Colis na Nga est choisi ──
    {
      id: 'cnn-admin',
      label: 'Colis na Nga',
      workspaces: ['CNN'],
      items: [
        { id: 'cnn-orders', label: 'Commandes', to: '/colis-na-nga/commandes', workspaces: ['CNN'], permission: 'MANAGE_CNN_ORDERS' },
        { id: 'cnn-clients', label: 'Clients', to: '/colis-na-nga/clients', workspaces: ['CNN'], permission: 'MANAGE_CNN_CLIENTS' },
        { id: 'cnn-agents', label: 'Livreurs', to: '/colis-na-nga/livreurs', workspaces: ['CNN'], permission: 'MANAGE_CNN_AGENTS' },
        { id: 'cnn-motards', label: 'Motards', to: '/colis-na-nga/motards', workspaces: ['CNN'], permission: 'MANAGE_CNN_MOTARDS' },
        { id: 'cnn-associations', label: 'Associations', to: '/colis-na-nga/associations', workspaces: ['CNN'], permission: 'MANAGE_CNN_ASSOCIATIONS' },
        {
          id: 'cnn-subscriptions',
          label: 'Abonnements et crédits',
          to: '/colis-na-nga/abonnements',
          workspaces: ['CNN'],
          permissions: ['MANAGE_CNN_SUBSCRIPTIONS', 'MANAGE_CNN_CLIENTS', 'MANAGE_CNN_MOTARDS'],
        },
        {
          id: 'cnn-incidents',
          label: 'Signalements et incidents',
          to: '/colis-na-nga/incidents',
          workspaces: ['CNN'],
          permissions: ['MANAGE_CNN_MOTARDS', 'MANAGE_CNN_ORDERS', 'MANAGE_CNN_PAYMENTS'],
        },
        { id: 'cnn-pricing', label: 'Tarification', to: '/colis-na-nga/tarification', workspaces: ['CNN'], permission: 'MANAGE_CNN_SETTINGS' },
      ],
    },
    // ── Mindset du Royaume ──
    {
      id: 'mdr',
      label: 'Mindset du Royaume',
      workspaces: ['MDR'],
      items: [{ id: 'mdr', label: 'Vue média', to: '/supervision/mdr', workspaces: ['MDR'], permission: 'VIEW_MARKETING_PERFORMANCE' }],
    },
    // ── Mindset Alliance (toute l'entreprise) ──
    {
      id: 'tickets-sec',
      label: 'Billetterie',
      workspaces: ENTREPRISE,
      items: [{ id: 'tickets', label: 'Tickets', to: '/tickets', permission: 'VIEW_TICKETS', workspaces: ENTREPRISE }],
    },
    {
      id: 'commercial',
      label: 'Commercial',
      workspaces: ENTREPRISE,
      items: [{ id: 'enterprises', label: 'Comptes entreprises', to: '/commercial/entreprises', permission: 'MANAGE_ENTERPRISE_ACCOUNTS', workspaces: ENTREPRISE }],
    },
    {
      id: 'finance',
      label: 'Finance',
      workspaces: ENTREPRISE,
      items: [
        { id: 'finance-home', label: 'Pilotage financier', to: '/finance', permissions: ['VIEW_FINANCE', 'MANAGE_SUBSCRIPTIONS', 'MANAGE_INVOICING', 'VIEW_B2C_VOLUME'], workspaces: ENTREPRISE },
        { id: 'subscriptions', label: 'Abonnements', to: '/finance/abonnements', permission: 'MANAGE_SUBSCRIPTIONS', workspaces: ENTREPRISE },
        { id: 'invoicing', label: 'Facturation', to: '/finance/facturation', permission: 'MANAGE_INVOICING', workspaces: ENTREPRISE },
        { id: 'b2c', label: 'Suivi B2C', to: '/finance/b2c', permission: 'VIEW_B2C_VOLUME', workspaces: ENTREPRISE },
      ],
    },
    {
      id: 'hr',
      label: 'Ressources humaines',
      workspaces: ENTREPRISE,
      items: [
        { id: 'rh', label: 'Vue RH', to: '/rh', permissions: ['MANAGE_HR', 'MANAGE_INTERNAL_AGENTS', 'MANAGE_STAFF', 'VIEW_PAYROLL'], workspaces: ENTREPRISE },
        { id: 'agents-hr', label: 'Agents internes', to: '/rh/agents', permissions: ['MANAGE_INTERNAL_AGENTS', 'MANAGE_HR', 'MANAGE_USERS'], workspaces: ENTREPRISE },
        { id: 'leaves', label: 'Personnel & congés', to: '/rh/conges', permission: 'MANAGE_STAFF', workspaces: ENTREPRISE },
        { id: 'payroll', label: 'Paie', to: '/rh/paie', permission: 'VIEW_PAYROLL', workspaces: ENTREPRISE },
      ],
    },
    {
      id: 'legal',
      label: 'Juridique',
      workspaces: ENTREPRISE,
      items: [
        { id: 'partners', label: 'Registre partenaires', to: '/juridique/partenaires', permission: 'MANAGE_PARTNER_REGISTRY', workspaces: ENTREPRISE },
        { id: 'compliance', label: 'Conformité', to: '/juridique/conformite', permission: 'MANAGE_COMPLIANCE', workspaces: ENTREPRISE },
      ],
    },
    {
      id: 'marketing',
      label: 'Marketing & média',
      workspaces: ENTREPRISE,
      items: [
        { id: 'mkt', label: 'Performance', to: '/marketing/performance', permission: 'VIEW_MARKETING_PERFORMANCE', workspaces: ENTREPRISE },
        { id: 'media', label: 'Médiathèque', to: '/marketing/mediatheque', permission: 'MANAGE_MEDIA_LIBRARY', workspaces: ENTREPRISE },
      ],
    },
    {
      id: 'tech',
      label: 'Technique',
      workspaces: ENTREPRISE,
      items: [
        { id: 'monitoring', label: 'Monitoring', to: '/technique/monitoring', permission: 'VIEW_MONITORING', workspaces: ENTREPRISE },
        { id: 'bugs', label: 'Bugs & Déploiements', to: '/tickets-techniques', permission: 'MANAGE_BUG_TICKETS', workspaces: ENTREPRISE },
      ],
    },
    {
      id: 'direction',
      label: 'Direction',
      workspaces: ENTREPRISE,
      items: [
        { id: 'direction', label: 'Tableau de bord exécutif', to: '/direction', permissions: ['VIEW_EXECUTIVE_DASHBOARD'], roles: ['DIRECTION', 'CONSEIL_ADMINISTRATION', 'ADMIN_SYSTEME'], workspaces: ENTREPRISE },
        { id: 'stats', label: 'Statistiques globales', to: '/admin/statistiques', roles: ['ADMIN_SYSTEME', 'DIRECTION'], workspaces: ENTREPRISE },
      ],
    },
    {
      id: 'admin',
      label: 'Administration',
      workspaces: ENTREPRISE,
      items: [
        { id: 'access', label: 'Gestion des accès', to: '/admin/acces', permission: 'MANAGE_ACCESS', workspaces: ENTREPRISE },
        { id: 'societes', label: 'Sociétés', to: '/admin/societes', roles: ['ADMIN_SYSTEME', 'DIRECTION'], workspaces: ENTREPRISE },
        { id: 'users', label: 'Agents', to: '/admin/utilisateurs', permissions: ['MANAGE_USERS', 'MANAGE_ACCESS', 'MANAGE_AGENTS'], workspaces: ENTREPRISE },
        { id: 'departements', label: 'Départements', to: '/admin/departements', roles: ['ADMIN_SYSTEME', 'DIRECTION'], workspaces: ENTREPRISE },
        { id: 'permissions', label: 'Rôles & permissions', to: '/admin/permissions', permission: 'MANAGE_PERMISSIONS', workspaces: ENTREPRISE },
        { id: 'rapports', label: 'Rapports', to: '/admin/rapports', roles: ['ADMIN_SYSTEME', 'DIRECTION'], workspaces: ENTREPRISE },
        { id: 'assistant', label: 'Assistant IA', to: '/admin/assistant-ia', roles: ['ADMIN_SYSTEME', 'DIRECTION'], workspaces: ENTREPRISE },
        { id: 'audit', label: 'Journal d’audit', to: '/admin/audit', permission: 'VIEW_AUDIT', workspaces: ENTREPRISE },
      ],
    },
    {
      id: 'footer',
      items: [
        { id: 'documents', label: 'Documents', to: '/documents', workspaces: ENTREPRISE },
        { id: 'compte', label: 'Mon compte', to: '/compte' },
      ],
    },
  ]

  return catalog
    .filter((section) => !section.workspaces || section.workspaces.includes(currentProject as Workspace))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => itemVisible(item, roles, currentProject, overrides, granted)),
    }))
    .filter((section) => section.items.length > 0)
}

export function buildMenuFromPermissions(roles: RoleAssignment[], currentProject: string) {
  return buildNavSections(roles, currentProject).flatMap((section) => section.items)
}
