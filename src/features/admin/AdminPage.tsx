import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ChevronRight, ShieldCheck, Users } from 'lucide-react'
import { Avatar } from '../../components/ui/avatar'
import { Badge, roleTone } from '../../components/ui/badge'
import { Card, IconTile, type IconTone } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { PageHeader, SectionHeader } from '../../components/ui/page-header'
import { EmptyState } from '../../components/ui/scope-empty'
import { Skeleton } from '../../components/ui/skeleton'
import { Stagger, StaggerItem } from '../../components/motion/page-fade'
import { PanelCard } from './admin-kit'
import { NAV_ICONS } from '../../components/layout/nav-icons'
import { fetchAgents } from '../../lib/api/domain'
import { RequirePermission, useRbac } from '../../lib/rbac/RequirePermission'
import { buildNavSections, projectLabel, roleLabel, type MenuItem } from '../../lib/rbac/rbac'

/** Présentation des tuiles : couleur, description et groupe. Les droits viennent de buildNavSections. */
const TILE: Record<string, { tone: IconTone; group: 'org' | 'security' | 'insight'; desc: string; fr: string }> = {
  societes: { tone: 'navy', group: 'org', desc: 'adminHub.desc.societes', fr: 'Contextes multi-société, statut et agents rattachés.' },
  departements: { tone: 'teal', group: 'org', desc: 'adminHub.desc.departements', fr: 'Structure interne et rôles attribués par défaut.' },
  users: { tone: 'sky', group: 'org', desc: 'adminHub.desc.users', fr: 'Annuaire des agents, comptes et dérogations individuelles.' },
  access: {
    tone: 'gold',
    group: 'security',
    desc: 'adminHub.desc.access',
    fr: 'Rôles par projet, attributions et révocations journalisées.',
  },
  permissions: {
    tone: 'violet',
    group: 'security',
    desc: 'adminHub.desc.permissions',
    fr: 'Matrice des rôles et des permissions, module par module.',
  },
  audit: { tone: 'neutral', group: 'security', desc: 'adminHub.desc.audit', fr: 'Traçabilité complète des actions, en lecture seule.' },
  stats: { tone: 'indigo', group: 'insight', desc: 'adminHub.desc.stats', fr: 'Vue d’ensemble chiffrée de tout le système.' },
  rapports: { tone: 'coral', group: 'insight', desc: 'adminHub.desc.rapports', fr: 'Rapports PDF prêts pour vos audits et présentations.' },
  assistant: {
    tone: 'navy',
    group: 'insight',
    desc: 'adminHub.desc.assistant',
    fr: 'Posez vos questions sur les données en langage courant.',
  },
}

const GROUPS = [
  { id: 'org', title: ['adminHub.group.org', 'Organisation'], subtitle: ['adminHub.group.orgHint', 'Sociétés, départements et agents.'] },
  {
    id: 'security',
    title: ['adminHub.group.security', 'Sécurité et accès'],
    subtitle: ['adminHub.group.securityHint', 'Qui peut voir et faire quoi, et la trace de chaque action.'],
  },
  {
    id: 'insight',
    title: ['adminHub.group.insight', 'Pilotage'],
    subtitle: ['adminHub.group.insightHint', 'Chiffres, rapports et assistant.'],
  },
] as const

function NavTile({ item }: { item: MenuItem }) {
  const { t } = useTranslation()
  const meta = TILE[item.id]
  const Icon = NAV_ICONS[item.id] ?? ShieldCheck
  return (
    <Link
      to={item.to}
      className="group block h-full rounded-[var(--radius-ma)] focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]"
    >
      <Card
        interactive
        className="flex h-full items-start gap-4 p-5 transition-[box-shadow,translate,scale] active:scale-[0.985] active:duration-100"
      >
        <IconTile tone={meta?.tone ?? 'neutral'} size="lg">
          <Icon />
        </IconTile>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[15.5px] font-semibold tracking-[-0.015em] text-ink">{t(`nav.${item.id}`, { defaultValue: item.label })}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{meta ? t(meta.desc, meta.fr) : item.to}</p>
        </div>
        <ChevronRight
          className="mt-1 h-[18px] w-[18px] shrink-0 text-ink-3/70 transition-[transform,color] duration-300 ease-[var(--ease-ma)] group-hover:translate-x-1 group-hover:text-accent-ink"
          strokeWidth={2.2}
          aria-hidden
        />
      </Card>
    </Link>
  )
}

function AgentsPreview({ usersLink }: { usersLink?: string }) {
  const { t } = useTranslation()
  const agents = useQuery({ queryKey: ['agents'], queryFn: fetchAgents })
  const rows = agents.data ?? []
  return (
    <PanelCard
      title={t('adminHub.agentsTitle', 'Agents et rôles')}
      subtitle={t('adminHub.agentsHint', 'Comptes déjà provisionnés et leurs périmètres.')}
      icon={<Users />}
      tone="sky"
      bodyClassName="px-0 pb-2 pt-3 sm:px-0"
      action={
        usersLink ? (
          <Link
            to={usersLink}
            className="press inline-flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-accent-ink hover:bg-ma-gold-500/10 focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]"
          >
            {t('adminHub.seeAll', 'Tout voir')}
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.4} />
          </Link>
        ) : undefined
      }
    >
      {agents.isLoading ? (
        <div className="space-y-4 px-5 py-2 sm:px-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          ))}
        </div>
      ) : agents.isError ? (
        <div className="px-5 pb-3 sm:px-6">
          <Feedback tone="danger">{t('adminHub.forbidden', 'Droits insuffisants pour afficher les agents.')}</Feedback>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={t('adminHub.noAgents', 'Aucun agent provisionné')}
          hint={t('adminHub.noAgentsHint', 'Les comptes créés depuis la page Agents apparaîtront ici.')}
        />
      ) : (
        <ul className="divide-y divide-hairline">
          {rows.map((a) => {
            const name = `${a.prenom} ${a.nom}`.trim()
            return (
              <li key={a.id} className="flex flex-col gap-2.5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={name} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-ink">{name}</p>
                    <p className="truncate text-[12.5px] text-ink-3">{a.emailPro}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-12 sm:justify-end sm:pl-0">
                  {a.roles.length === 0 && <span className="text-[13px] text-ink-3">–</span>}
                  {a.roles.map((r) => (
                    <Badge key={r.id} tone={roleTone(r.role)}>
                      {roleLabel(r.role)}
                      <span className="font-medium opacity-70">· {r.projectCode ? r.projectCode : projectLabel(r.projectCode)}</span>
                    </Badge>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </PanelCard>
  )
}

export function AdminPage() {
  const { t } = useTranslation()
  const { roles, permissionOverrides, currentProject } = useRbac()
  const items = useMemo(() => {
    const sections = buildNavSections(roles, currentProject, permissionOverrides)
    const seen = new Set<string>()
    return sections
      .filter((s) => s.id === 'admin' || s.id === 'direction')
      .flatMap((s) => s.items)
      .filter((item) => TILE[item.id] && !seen.has(item.id) && seen.add(item.id))
  }, [roles, currentProject, permissionOverrides])
  const usersLink = items.find((i) => i.id === 'users')?.to

  return (
    <RequirePermission permission="MANAGE_AGENTS">
      <div className="space-y-8">
        <PageHeader
          kicker={t('pages.admin.kicker')}
          title={t('pages.admin.title')}
          subtitle={t('adminHub.subtitle', 'Organisation, accès, rapports et traçabilité de MA Workspace, réunis au même endroit.')}
        />
        {GROUPS.map((group) => {
          const groupItems = items.filter((item) => TILE[item.id].group === group.id)
          if (groupItems.length === 0) return null
          return (
            <section key={group.id} className="space-y-3.5">
              <SectionHeader title={t(group.title[0], group.title[1])} subtitle={t(group.subtitle[0], group.subtitle[1])} />
              <Stagger className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
                {groupItems.map((item) => (
                  <StaggerItem key={item.id} className="min-w-0">
                    <NavTile item={item} />
                  </StaggerItem>
                ))}
              </Stagger>
            </section>
          )
        })}
        <AgentsPreview usersLink={usersLink} />
      </div>
    </RequirePermission>
  )
}
