import type { ReactNode } from 'react'
import { Building2, Globe } from 'lucide-react'
import { projectLabel, roleLabel } from '../../lib/rbac/rbac'
import { Badge, roleTone } from './badge'
import { Td } from './table'
import { FilterSelect } from './toolbar'

export type RoleAssignmentView = {
  id: number
  role: string
  projectCode?: string | null
  projectNom?: string | null
}

/** Périmètre d'un rôle : globe bleu nuit pour toute l'entreprise, immeuble doré pour une société. */
export function ScopeBadge({
  projectCode,
  projectNom,
}: {
  projectCode?: string | null
  projectNom?: string | null
}) {
  const companyWide = !projectCode
  return (
    <span
      className="inline-flex"
      title={
        companyWide
          ? 'Accès toute l’entreprise : l’agent voit tous les projets.'
          : 'Accès limité à cette société : l’agent ne voit que ce projet.'
      }
    >
      <Badge tone={companyWide ? 'navy' : 'gold'} className="gap-1 pl-2">
        {companyWide ? <Globe className="h-3 w-3" aria-hidden /> : <Building2 className="h-3 w-3" aria-hidden />}
        {projectNom || projectLabel(projectCode)}
      </Badge>
    </span>
  )
}

export function RoleOnlyBadge({ role }: { role: string }) {
  return <Badge tone={roleTone(role)}>{roleLabel(role)}</Badge>
}

/** Paire rôle + périmètre (fiche agent, listes compactes). */
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
    <span className="inline-flex flex-wrap items-center gap-1.5">
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
    <div className="flex flex-col items-start gap-1.5">
      {roles.map((row) => (
        <div key={row.id} className="flex h-[22px] items-center">
          {render(row)}
        </div>
      ))}
    </div>
  )
}

/** Deux cellules alignées ligne à ligne : les rôles, puis le périmètre correspondant. */
export function RolePerimeterCells({ roles }: { roles: RoleAssignmentView[] }) {
  if (roles.length === 0) {
    return (
      <>
        <Td>
          <span className="text-[13px] text-ink-3">Aucun rôle</span>
        </Td>
        <Td>
          <span className="text-ink-3">–</span>
        </Td>
      </>
    )
  }
  return (
    <>
      <Td>
        <AssignmentStack roles={roles} render={(row) => <RoleOnlyBadge role={row.role} />} />
      </Td>
      <Td>
        <AssignmentStack roles={roles} render={(row) => <ScopeBadge projectCode={row.projectCode} projectNom={row.projectNom} />} />
      </Td>
    </>
  )
}

export function PerimeterFilter({
  value,
  onChange,
  projects,
  className,
}: {
  value: string
  onChange: (value: string) => void
  projects: { code: string; nom: string }[]
  className?: string
}) {
  return (
    <FilterSelect className={className} active={Boolean(value)} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Filtrer par périmètre">
      <option value="">Tous les périmètres</option>
      <option value="ENTREPRISE">Toute l’entreprise</option>
      {projects.map((p) => (
        <option key={p.code} value={p.code}>
          {p.nom}
        </option>
      ))}
    </FilterSelect>
  )
}
