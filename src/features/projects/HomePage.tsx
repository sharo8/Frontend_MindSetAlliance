import { useQuery } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BellOff, CalendarClock, Inbox, Ticket } from 'lucide-react'
import { DashboardBarChart } from '../../components/charts/DashboardBarChart'
import { DashboardDonutChart } from '../../components/charts/DashboardDonutChart'
import { DashboardHistogram } from '../../components/charts/DashboardHistogram'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { Badge, prioriteLabel, prioriteTone } from '../../components/ui/badge'
import { PageHeader } from '../../components/ui/page-header'
import { fetchAccueilDashboard } from '../../lib/api/dashboard'
import { fetchMe } from '../../lib/api/auth'
import { fetchNotifications, fetchVitrine, type NotificationItem } from '../../lib/api/domain'
import { listTickets, type Ticket as TicketDto } from '../../lib/api/tickets'
import { useAuthStore } from '../../lib/auth/auth-store'
import { useProjectStore } from '../../lib/projects/project-store'
import { kpiLabel } from '../../lib/vitrine/labels'
import { roleLabel } from '../../lib/rbac/rbac'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils'

type NotifGroup = {
  key: string
  titre: string
  count: number
  latest: NotificationItem
}

function groupUnread(items: NotificationItem[]): NotifGroup[] {
  const map = new Map<string, NotifGroup>()
  for (const n of items) {
    const key = n.titre.trim().toLowerCase()
    const prev = map.get(key)
    if (!prev) {
      map.set(key, { key, titre: n.titre, count: 1, latest: n })
      continue
    }
    prev.count += 1
    if (n.createdAt > prev.latest.createdAt) prev.latest = n
  }
  return [...map.values()].sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt))
}

function formatNotifTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('fr-CD', { hour: '2-digit', minute: '2-digit' })
}

function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-2 py-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ma-navy-900/6 text-ma-muted dark:bg-white/8 dark:text-ma-gray-300">
        {icon}
      </div>
      <p className="text-sm font-medium text-ma-navy-900 dark:text-ma-white">{title}</p>
      <p className="text-xs text-ma-muted dark:text-ma-gray-300">{hint}</p>
    </div>
  )
}

function Truncate({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn('block truncate', className)} title={text}>
      {text}
    </span>
  )
}

export function HomePage() {
  const { t } = useTranslation()
  const email = useAuthStore((s) => s.email)
  const roles = useAuthStore((s) => s.roles)
  const accessToken = useAuthStore((s) => s.accessToken)
  const currentProject = useProjectStore((s) => s.currentProject)
  const projectCode = currentProject === 'ENTREPRISE' ? undefined : currentProject

  const ready = Boolean(accessToken)
  const me = useQuery({ queryKey: ['agents-me'], queryFn: fetchMe, enabled: ready })
  const tickets = useQuery({
    queryKey: ['tickets', projectCode, 'OUVERT'],
    queryFn: () => listTickets({ projectCode, statut: 'OUVERT' }),
    enabled: ready,
  })
  const notifs = useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications, enabled: ready })
  const kpis = useQuery({ queryKey: ['vitrine', projectCode ?? 'ENTREPRISE'], queryFn: fetchVitrine, enabled: ready })

  const today = new Date().toISOString().slice(0, 10)
  const openTickets = (tickets.data ?? []).slice(0, 5)
  const echeances = (tickets.data ?? []).filter((row) => row.echeance?.startsWith(today)).slice(0, 5)
  const unread = (notifs.data ?? []).filter((n) => !n.lu)
  const groupedNotifs = useMemo(() => groupUnread(unread).slice(0, 5), [unread])
  const scopedKpis = (kpis.data ?? []).filter((k) => !projectCode || k.project?.code === projectCode)

  const firstName = me.data?.prenom?.trim()
  const title = firstName ? t('home.helloNamed', { name: firstName }) : t('home.hello')

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={t('home.workspace')}
        title={title}
        subtitle={`${email ?? ''} · ${roles.map((r) => roleLabel(r.role)).join(', ')}`}
      />
      <div className="grid w-full min-w-0 auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="flex min-h-[16.5rem] min-w-0 flex-col overflow-hidden">
          <CardHeader className="flex shrink-0 items-center justify-between gap-2">
            <h2 className="font-semibold text-ma-navy-900 dark:text-ma-white">{t('home.openTickets')}</h2>
            <Link
              to="/tickets"
              className="shrink-0 text-sm text-ma-gold-600 transition hover:text-ma-gold-500 focus-visible:outline-none dark:text-ma-gold-400"
            >
              {t('home.seeAll')}
            </Link>
          </CardHeader>
          <CardBody className="flex min-h-0 flex-1 flex-col gap-2 text-sm">
            {tickets.isError && <p className="text-status-danger">{t('home.ticketsLoadError')}</p>}
            {tickets.isLoading && <p className="text-ma-muted">{t('home.loading')}</p>}
            {!tickets.isLoading && openTickets.length === 0 && (
              <EmptyState
                icon={<Ticket className="h-4 w-4" />}
                title={projectCode ? t('home.noContextData') : t('home.noOpenTickets')}
                hint={t('home.emptyTicketsHint')}
              />
            )}
            {openTickets.map((row) => (
              <TicketRow key={row.id} ticket={row} />
            ))}
          </CardBody>
        </Card>

        <Card className="flex min-h-[16.5rem] min-w-0 flex-col overflow-hidden">
          <CardHeader className="shrink-0">
            <h2 className="font-semibold text-ma-navy-900 dark:text-ma-white">{t('home.dueToday')}</h2>
          </CardHeader>
          <CardBody className="flex min-h-0 flex-1 flex-col gap-2 text-sm">
            {echeances.length === 0 && (
              <EmptyState
                icon={<CalendarClock className="h-4 w-4" />}
                title={t('home.noDueToday')}
                hint={t('home.emptyDueHint')}
              />
            )}
            {echeances.map((row) => {
              const label = `${row.reference} — ${row.titre}`
              return (
                <Link
                  key={row.id}
                  to={`/tickets/${row.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 transition hover:bg-ma-navy-900/[0.04] dark:hover:bg-white/5"
                >
                  <Truncate text={label} className="min-w-0 text-ma-navy-900 dark:text-ma-white" />
                  <Badge tone={prioriteTone(row.priorite)}>{prioriteLabel(row.priorite)}</Badge>
                </Link>
              )
            })}
          </CardBody>
        </Card>

        <Card className="flex min-h-[16.5rem] min-w-0 flex-col overflow-hidden">
          <CardHeader className="shrink-0">
            <h2 className="font-semibold text-ma-navy-900 dark:text-ma-white">{t('home.unreadNotifs')}</h2>
          </CardHeader>
          <CardBody className="flex min-h-0 flex-1 flex-col gap-2 text-sm">
            {groupedNotifs.length === 0 && (
              <EmptyState
                icon={<BellOff className="h-4 w-4" />}
                title={t('home.noUnread')}
                hint={t('home.emptyNotifsHint')}
              />
            )}
            {groupedNotifs.map((group) => (
              <div key={group.key} className="flex items-start justify-between gap-2 rounded-lg px-1 py-1">
                <div className="min-w-0">
                  <Truncate text={group.titre} className="font-medium text-ma-navy-900 dark:text-ma-white" />
                  {group.latest.message && (
                    <Truncate text={group.latest.message} className="mt-0.5 text-xs text-ma-muted dark:text-ma-gray-300" />
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] text-ma-muted dark:text-ma-gray-300">
                  {group.count > 1 && (
                    <span className="rounded-full bg-ma-gold-500/15 px-1.5 py-0.5 font-semibold text-ma-gold-700 dark:text-ma-gold-400">
                      {t('home.times', { count: group.count })}
                    </span>
                  )}
                  <span>{formatNotifTime(group.latest.createdAt)}</span>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card className="flex min-h-[16.5rem] min-w-0 flex-col overflow-hidden">
          <CardHeader className="shrink-0">
            <h2 className="font-semibold text-ma-navy-900 dark:text-ma-white">{t('home.kpis')}</h2>
          </CardHeader>
          <CardBody className="flex min-h-0 flex-1 flex-col gap-3 text-sm">
            {scopedKpis.length === 0 && (
              <EmptyState
                icon={<Inbox className="h-4 w-4" />}
                title={t('home.noKpis')}
                hint={t('home.emptyKpisHint')}
              />
            )}
            {scopedKpis.slice(0, 4).map((k) => (
              <div key={k.id} className="flex items-end justify-between gap-3 border-b border-ma-line/60 pb-2 last:border-0 last:pb-0 dark:border-white/10">
                <span className="min-w-0 text-xs uppercase tracking-wide text-ma-muted dark:text-ma-gray-300">
                  <Truncate text={kpiLabel(k.cle, k.categorie)} />
                </span>
                <span className="font-display text-2xl leading-none tabular-nums text-ma-navy-900 dark:text-ma-gold-300">
                  {k.valeur ?? '—'}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
      <HomeAnalytics />
    </div>
  )
}

function TicketRow({ ticket }: { ticket: TicketDto }) {
  return (
    <Link
      to={`/tickets/${ticket.id}`}
      className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 transition hover:bg-ma-navy-900/[0.04] dark:hover:bg-white/5"
    >
      <Truncate text={ticket.titre} className="min-w-0 text-ma-navy-900 dark:text-ma-white" />
      <Badge tone={prioriteTone(ticket.priorite)}>{prioriteLabel(ticket.priorite)}</Badge>
    </Link>
  )
}

function HomeAnalytics() {
  const { t } = useTranslation()
  const accessToken = useAuthStore((s) => s.accessToken)
  const currentProject = useProjectStore((s) => s.currentProject)
  const projectCode = currentProject === 'ENTREPRISE' ? undefined : currentProject
  const [vue, setVue] = useState<string | undefined>()
  const dash = useQuery({
    queryKey: ['accueil-dash', vue, projectCode ?? 'ENTREPRISE'],
    queryFn: () => fetchAccueilDashboard(vue, projectCode),
    enabled: Boolean(accessToken),
  })
  const data = dash.data
  const views = data?.vuesDisponibles ?? []

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-ma-gold-600 dark:text-ma-gold-400">
            {t('home.workspace')}
          </p>
          <h2 className="font-display text-[1.65rem] leading-tight tracking-wide text-ma-navy-900 dark:text-ma-gold-400">
            {t('home.analytics')}
          </h2>
        </div>
        {views.length > 1 && (
          <div className="flex flex-wrap gap-1 rounded-2xl border border-ma-line bg-white/80 p-1 dark:border-white/10 dark:bg-ma-navy-800/60">
            {views.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setVue(option)}
                className={`rounded-xl px-3 py-1.5 text-sm transition duration-[var(--duration-ma)] ${
                  (data?.vue ?? option) === option
                    ? 'bg-ma-navy-900 text-white dark:bg-ma-gold-500/20 dark:text-ma-gold-400'
                    : 'text-ma-muted dark:text-ma-gray-300'
                }`}
              >
                {option === 'TICKETS' ? 'Tickets' : option === 'FINANCE' ? 'Finance' : 'RH'}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <DashboardBarChart
            title={data?.titreActivite ?? 'Activité des 7 derniers jours'}
            data={data?.activiteParJour ?? []}
            dataKey="valeur"
            xAxisKey="jour"
            loading={dash.isLoading}
            unit={data?.uniteActivite}
          />
        </div>
        <DashboardDonutChart
          title={data?.titreRepartition ?? 'Répartition par statut'}
          data={data?.repartitionParStatut ?? []}
          loading={dash.isLoading}
          centerLabel="Total"
          centerValue={(data?.repartitionParStatut ?? []).reduce((s, r) => s + r.valeur, 0)}
        />
      </div>
      <DashboardHistogram
        title={data?.titreHistogramme ?? 'Répartition des délais de traitement'}
        bins={data?.histogrammeDelais ?? []}
        loading={dash.isLoading}
        synthesis={data?.syntheseTendance}
      />
    </section>
  )
}
