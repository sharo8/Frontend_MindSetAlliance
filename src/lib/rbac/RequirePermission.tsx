import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { hasAnyRole, hasPermission, visibleProjectCodes, type PermissionOverride, type RoleAssignment } from './rbac'
import { useAuthStore } from '../auth/auth-store'
import { useProjectStore } from '../projects/project-store'

/**
 * Garde d’affichage uniquement (confort UX).
 * La sécurité réelle est toujours appliquée par le backend Core à chaque appel API.
 * Ne jamais considérer ce composant comme une barrière de sécurité.
 */
type Props = {
  children: ReactNode
  permission?: string
  anyOf?: string[]
  anyOfPermissions?: string[]
  project?: string
  fallback?: ReactNode
}

export function useRbac() {
  const roles = useAuthStore((s) => s.roles)
  const permissionOverrides = useAuthStore((s) => s.permissionOverrides)
  const currentProject = useProjectStore((s) => s.currentProject)
  return { roles, permissionOverrides, currentProject }
}

export function canAccess(
  roles: RoleAssignment[],
  currentProject: string,
  { permission, anyOf, anyOfPermissions, project }: { permission?: string; anyOf?: string[]; anyOfPermissions?: string[]; project?: string },
  overrides: PermissionOverride[] = [],
) {
  if (project) {
    const visible = visibleProjectCodes(roles)
    if (!visible.includes('*') && !visible.includes(project)) return false
  }
  const scope = project ?? (currentProject === 'ENTREPRISE' ? null : currentProject)
  if (anyOfPermissions?.length) return anyOfPermissions.some((p) => hasPermission(roles, p, scope, overrides))
  if (anyOf?.length) return hasAnyRole(roles, anyOf, scope)
  if (permission) return hasPermission(roles, permission, scope, overrides)
  return true
}

export function RequirePermission({ children, permission, anyOf, anyOfPermissions, project, fallback }: Props) {
  const { t } = useTranslation()
  const { roles, permissionOverrides, currentProject } = useRbac()
  if (canAccess(roles, currentProject, { permission, anyOf, anyOfPermissions, project }, permissionOverrides)) {
    return <>{children}</>
  }
  return (
    fallback ?? (
      <div className="clay rounded-[var(--radius-ma)] border border-status-danger/30 p-6 text-ink">
        <p className="font-semibold">{t('rbac.deniedTitle')}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-ma-gray-300">
          {t('rbac.deniedBody')}
        </p>
      </div>
    )
  )
}
