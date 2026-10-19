import { Bug, Building2, Check, FileText, LayoutDashboard, Receipt, Shield, ShieldCheck, Sparkles, Ticket, UserRound, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconTile, type IconTone } from '../../components/ui/card'
import { RoleScopeBadges } from '../../components/ui/role-scope-badges'
import { SectionCard } from '../../components/ui/toolbar'
import { useAuthStore } from '../../lib/auth/auth-store'
import { hasFullAccess, permissionLabel, ROLE_PERMISSIONS } from '../../lib/rbac/rbac'

function permissionMeta(code: string): { group: string; Icon: LucideIcon; tone: IconTone } {
  if (/INVOICE|FINANCE|PAYROLL|B2C|SUBSCRIPTION|INVOIC/.test(code)) return { group: 'Finance', Icon: Receipt, tone: 'teal' }
  if (/USER|HR|STAFF|AGENT|ACCESS|PERMISSION/.test(code)) return { group: 'RH & agents', Icon: Users, tone: 'violet' }
  if (/TICKET|BUG/.test(code)) return { group: 'Billetterie', Icon: Ticket, tone: 'coral' }
  if (/MAP|FLEET|COURSE|INCIDENT|COURIER|DRIVER/.test(code)) return { group: 'Opérations', Icon: LayoutDashboard, tone: 'sky' }
  if (/MEDIA|MARKETING/.test(code)) return { group: 'Marketing', Icon: FileText, tone: 'violet' }
  if (/COMPLIANCE|PARTNER|AUDIT/.test(code)) return { group: 'Conformité', Icon: Shield, tone: 'navy' }
  if (/MONITORING/.test(code)) return { group: 'Technique', Icon: Bug, tone: 'indigo' }
  if (/PROFILE/.test(code)) return { group: 'Compte', Icon: UserRound, tone: 'neutral' }
  return { group: 'Général', Icon: Building2, tone: 'gold' }
}

/** Regroupe les permissions d'un rôle par domaine (ordre d'apparition conservé). */
function groupPermissions(codes: string[]) {
  const map = new Map<string, { Icon: LucideIcon; tone: IconTone; labels: string[] }>()
  for (const code of codes) {
    const meta = permissionMeta(code)
    const entry = map.get(meta.group) ?? { Icon: meta.Icon, tone: meta.tone, labels: [] }
    entry.labels.push(permissionLabel(code))
    map.set(meta.group, entry)
  }
  return [...map.entries()]
}

export function MesAcces() {
  const { t } = useTranslation()
  const roles = useAuthStore((s) => s.roles)
  const full = hasFullAccess(roles)
  return (
    <SectionCard
      title={t('acces.account.myAccess', 'Mes accès')}
      subtitle={t('acces.account.myAccessHint', 'Rôles et permissions attachés à votre compte.')}
      icon={<ShieldCheck />}
      tone="gold"
      bodyClassName="space-y-4"
    >
      {full && (
        <div className="flex items-start gap-3 rounded-[16px] bg-ma-gold-500/[0.08] px-4 py-3 ring-1 ring-inset ring-ma-gold-500/25">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" />
          <p className="text-[13.5px] leading-snug text-ink">Vous disposez d’un accès complet à tous les modules et projets.</p>
        </div>
      )}
      {roles.length === 0 && <p className="text-[13.5px] text-ink-3">{t('acces.account.noRole', 'Aucun rôle attribué pour le moment.')}</p>}
      {roles.map((assignment, i) => {
        const perms = ROLE_PERMISSIONS[assignment.role] ?? []
        const groups = groupPermissions(perms)
        return (
          <div key={`${assignment.role}-${assignment.projectCode}-${i}`} className="overflow-hidden rounded-[18px] bg-surface ring-1 ring-hairline">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-surface-2 px-4 py-3">
              <RoleScopeBadges role={assignment.role} projectCode={assignment.projectCode} />
              <span className="text-[12px] tabular-nums text-ink-3">
                {t('acces.account.permCount', '{{count}} permissions', { count: perms.length })}
              </span>
            </div>
            <div className="divide-y divide-hairline">
              {full && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <IconTile tone="gold" size="sm">
                    <Sparkles />
                  </IconTile>
                  <p className="text-[13.5px] font-medium text-ink">Accès à l’ensemble des permissions du système</p>
                </div>
              )}
              {groups.map(([group, { Icon, tone, labels }]) => (
                <div key={group} className="flex gap-3 px-4 py-3">
                  <IconTile tone={tone} size="sm" className="mt-0.5">
                    <Icon />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-ink-2">{group}</p>
                    <ul className="mt-1.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                      {labels.map((label) => (
                        <li key={label} className="flex items-start gap-1.5 text-[13px] leading-snug text-ink">
                          <Check className="mt-[3px] h-3 w-3 shrink-0 text-status-success" strokeWidth={2.8} />
                          <span>{label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </SectionCard>
  )
}
