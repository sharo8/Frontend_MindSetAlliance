import type { ReactNode } from 'react'
import { Building2, Globe } from 'lucide-react'
import { projectLabel, roleLabel } from '../../lib/rbac/rbac'
import { Badge, roleTone } from './badge'

export type RoleAssignmentView = {
  id: number
  role: string
  projectCode?: string | null
  projectNom?: string | null
}

export function ScopeBadge({
  projectCode,
  projectNom,
}: {
  projectCode?: string | null
  projectNom?: string | null
}) {
  const companyWide = !projectCode
  return (
    <Badge tone={companyWide ? 'navy' : 'gold'} className="normal-case tracking-normal">
      {companyWide ? (
        <Globe className="h-3 w-3" aria-hidden />
      ) : (
        <Building2 className="h-3 w-3" aria-hidden />
      )}
      <span
        title={
          companyWide
            ? 'Accès toute l’entreprise : l’agent voit tous les projets.'
            : 'Accès limité à cette société : l’agent ne voit que ce projet.'
        }
      >
        {projectNom || projectLabel(projectCode)}
      </span>
    </Badge>
  )
}

export function RoleOnlyBadge({ role }: { role: string }) {
  return <Badge tone={roleTone(role)}>{roleLabel(role)}</Badge>
}

/** Combined badge pair (fiche agent, listes compactes). */
export function RoleScopeBadges({
  role,
  projectCode,
  projectNom,
}: {
  role: string
  projectCode?: string | null
  projectNom?: string | null
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <RoleOnlyBadge role={role} />
      <ScopeBadge projectCode={projectCode} projectNom={projectNom} />
    </span>
  )
}

function AssignmentStack({
  roles,
  render,
}: {
  roles: RoleAssignmentView[]
  render: (row: RoleAssignmentView) => ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      {roles.map((row) => (
        <div key={row.id} className="flex min-h-7 items-center">
          {render(row)}
        </div>
      ))}
    </div>
  )
}

/** Two aligned table cells: roles only, then matching périmètre. */
export function RolePerimeterCells({ roles }: { roles: RoleAssignmentView[] }) {
  if (roles.length === 0) {
    return (
      <>
        <td className="px-4 py-3 align-top text-ma-muted">Aucun</td>
        <td className="px-4 py-3 align-top text-ma-muted">—</td>
      </>
    )
  }
  return (
    <>
      <td className="px-4 py-3 align-top">
        <AssignmentStack roles={roles} render={(row) => <RoleOnlyBadge role={row.role} />} />
      </td>
      <td className="px-4 py-3 align-top">
        <AssignmentStack
          roles={roles}
          render={(row) => <ScopeBadge projectCode={row.projectCode} projectNom={row.projectNom} />}
        />
      </td>
    </>
  )
}

export function PerimeterFilter({
  value,
  onChange,
  projects,
}: {
  value: string
  onChange: (value: string) => void
  projects: { code: string; nom: string }[]
}) {
  return (
    <select
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ma-navy-800"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Filtrer par périmètre"
    >
      <option value="">Tous les périmètres</option>
      <option value="ENTREPRISE">Toute l’entreprise</option>
      {projects.map((p) => (
        <option key={p.code} value={p.code}>
          {p.nom}
        </option>
      ))}
    </select>
  )
}
