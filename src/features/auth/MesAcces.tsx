import {
  Bug,
  Building2,
  FileText,
  LayoutDashboard,
  Receipt,
  Shield,
  Ticket,
  UserRound,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { Card, CardBody } from '../../components/ui/card'
import { useAuthStore } from '../../lib/auth/auth-store'
import { hasFullAccess, permissionLabel, ROLE_PERMISSIONS, roleLabel, projectLabel } from '../../lib/rbac/rbac'

function permissionMeta(code: string): { group: string; Icon: LucideIcon } {
  if (/INVOICE|FINANCE|PAYROLL|B2C|SUBSCRIPTION|INVOIC/.test(code)) return { group: 'Finance', Icon: Receipt }
  if (/USER|HR|STAFF|AGENT|ACCESS|PERMISSION/.test(code)) return { group: 'RH & agents', Icon: Users }
  if (/TICKET|BUG/.test(code)) return { group: 'Billetterie', Icon: Ticket }
  if (/MAP|FLEET|COURSE|INCIDENT|COURIER|DRIVER/.test(code)) return { group: 'Opérations', Icon: LayoutDashboard }
  if (/MEDIA|MARKETING/.test(code)) return { group: 'Marketing', Icon: FileText }
  if (/COMPLIANCE|PARTNER|AUDIT/.test(code)) return { group: 'Conformité', Icon: Shield }
  if (/MONITORING/.test(code)) return { group: 'Technique', Icon: Bug }
  if (/PROFILE/.test(code)) return { group: 'Compte', Icon: UserRound }
  return { group: 'Général', Icon: Building2 }
}

export function MesAcces() {
  const roles = useAuthStore((s) => s.roles)
  const full = hasFullAccess(roles)
  return (
    <Card>
      <CardBody className="space-y-4 text-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted">Mes accès</p>
        {full && (
          <p className="rounded-xl border border-ma-gold-500/40 bg-ma-gold-500/10 px-3 py-2">
            Vous disposez d’un accès complet à tous les modules et projets.
          </p>
        )}
        {roles.map((assignment, i) => {
          const perms = ROLE_PERMISSIONS[assignment.role] ?? []
          const labels = full
            ? ['Accès à l’ensemble des permissions du système', ...perms.map(permissionLabel)]
            : perms.map(permissionLabel)
          const codes = full ? ['FULL', ...perms] : perms
          return (
            <div key={`${assignment.role}-${assignment.projectCode}-${i}`} className="rounded-xl border border-ma-line p-3 dark:border-white/10">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-medium">{roleLabel(assignment.role)}</span>
                <Badge tone="gold">{projectLabel(assignment.projectCode)}</Badge>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {labels.map((label, idx) => {
                  const meta = permissionMeta(codes[idx] ?? '')
                  const Icon = meta.Icon
                  return (
                    <li key={label} className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-white/[0.04]">
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ma-gold-600" />
                      <span>
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-ma-muted">{meta.group}</span>
                        <span className="text-sm">{label}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </CardBody>
    </Card>
  )
}
