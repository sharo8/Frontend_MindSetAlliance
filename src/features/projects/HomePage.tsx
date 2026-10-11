import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Bell, BellOff, CalendarClock, Inbox, KeyRound, Ticket, Timer } from 'lucide-react'
import { DashboardBarChart } from '../../components/charts/DashboardBarChart'
import { DashboardDonutChart } from '../../components/charts/DashboardDonutChart'
import { DashboardHistogram } from '../../components/charts/DashboardHistogram'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { CnnSourceBadge } from '../../components/ui/cnn-source-badge'
import { ScopeEmpty } from '../../components/ui/scope-empty'
import { prioriteLabel } from '../../components/ui/badge'
import { Skeleton } from '../../components/ui/skeleton'
import { PageHeader } from '../../components/ui/page-header'
import { fetchAccueilDashboard } from '../../lib/api/dashboard'
import { fetchMe } from '../../lib/api/auth'
import { fetchNotifications, fetchVitrine, markNotificationRead, type NotificationItem } from '../../lib/api/domain'
import { listTickets, type Ticket as TicketDto } from '../../lib/api/tickets'
import { useAuthStore } from '../../lib/auth/auth-store'
import { useProjectStore } from '../../lib/projects/project-store'
import { kpiLabel } from '../../lib/vitrine/labels'
import { roleLabel } from '../../lib/rbac/rbac'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils'
import { greetingName, greetingPeriod } from './greeting'

type NotifGroup = {
  key: string
  titre: string
  count: number
  ids: number[]
  latest: NotificationItem
}

function groupUnread(items: NotificationItem[]): NotifGroup[] {
  const map = new Map<string, NotifGroup>()
  for (const n of items) {
    const key = n.titre.trim().toLowerCase()
    const prev = map.get(key)
    if (!prev) {
      map.set(key, { key, titre: n.titre, count: 1, ids: [n.id], latest: n })
      continue
    }
    prev.count += 1
    prev.ids.push(n.id)
    if (n.createdAt > prev.latest.createdAt) prev.latest = n
  }
  return [...map.values()].sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt))
}

function formatNotifTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function useGreetingName(prenom: string | undefined, email: string | null) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  const name = greetingName(prenom, email)
  const salute = t(`dashboard.greeting.${greetingPeriod(now)}`)
  return name ? `${salute}, ${name}.` : `${salute}.`
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function useCountUp(value: number | null | undefined) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (value == null || Number.isNaN(value)) return
    if (prefersReducedMotion()) {
      setShown(value)
      return
    }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 700)
      const eased = 1 - (1 - progress) ** 3
      setShown(Math.round(value * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return value == null ? null : shown
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

  const cnn = currentProject === 'CNN'
  const accueil = useQuery({
    queryKey: ['accueil-dash', undefined, 'CNN'],
    queryFn: () => fetchAccueilDashboard(undefined, 'CNN'),
    enabled: ready && cnn,
    refetchInterval: cnn ? 10_000 : false,
  })
  const title = useGreetingName(me.data?.prenom, email)
  const roleText = roles.map((r) => roleLabel(r.role)).filter(Boolean).join(' · ')
  const cnnLive = accueil.data?.source === 'CNN_DB'

  return (
    <div className="space-y-6">
      <PageHeader className="ma-home-rise" kicker={t('home.workspace')} title={title} />
      <div className="ma-home-rise flex flex-wrap items-center gap-2" style={{ animationDelay: '40ms' }}>
        {cnn && (accueil.data || accueil.isError) && (
          <CnnSourceBadge source={accueil.data?.source} ageSecondes={accueil.data?.ageSecondes} message={accueil.data?.message ?? 'Source Colis na Nga indisponible.'} readOnlyVerified={accueil.data?.readOnlyVerified} />
        )}
        {roleText && (
          <span className="inline-flex items-center rounded-full border border-ma-line bg-white/80 px-3 py-1 text-xs text-ma-navy-900 dark:border-white/10 dark:bg-white/8 dark:text-ma-gray-300">
            {roleText}
          </span>
        )}
      </div>
      {cnn && (
        <>
          {!accueil.isLoading && !cnnLive && (
            <ScopeEmpty context={accueil.data?.message ?? 'Source Colis na Nga indisponible.'} />
          )}
          {accueil.isLoading && <MetricRow loading />}
          {cnnLive && (
            <MetricRow>
              <CnnMetric index={0} label="Courses livrées aujourd'hui" value={accueil.data?.coursesLivreesJour} hint={accueil.data?.livraisonJourMessage} />
              <CnnMetric index={1} label="Total livré" value={accueil.data?.coursesLivreesTotal} />
              <CnnMetric index={2} label="Coursiers actifs" value={accueil.data?.coursiersActifs} />
              <CnnMetric index={3} label="Abonnements réglés" value={accueil.data?.abonnementsRegles} />
            </MetricRow>
          )}
          <HomeAnalytics />
          <section className="space-y-3">
            <h2 className="font-display text-xl text-ma-navy-900 dark:text-ma-gold-400">Tickets internes Mindset Alliance</h2>
            <InternalTickets
              projectCode={projectCode}
              ticketsLoading={tickets.isLoading}
              ticketsError={tickets.isError}
              openTickets={openTickets}
              echeances={echeances}
              groupedNotifs={groupedNotifs}
            />
          </section>
        </>
      )}
      {!cnn && (
        <HomeLists
          columns={4}
          projectCode={projectCode}
          ticketsLoading={tickets.isLoading || kpis.isLoading}
          ticketsError={tickets.isError}
          openTickets={openTickets}
          echeances={echeances}
          groupedNotifs={groupedNotifs}
          kpis={scopedKpis.slice(0, 4).map((k) => ({ id: k.id, label: kpiLabel(k.cle, k.categorie), value: k.valeur }))}
        />
      )}
      {!cnn && <HomeAnalytics />}
    </div>
  )
}

function MetricRow({ children, loading }: { children?: ReactNode; loading?: boolean }) {
  return (
    <div className="grid w-full grid-cols-1 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-4">
      {loading
        ? [0, 1, 2, 3].map((i) => <CardSkeleton key={i} index={i} compact />)
        : children}
    </div>
  )
}

function CnnMetric({ index, label, value, hint }: { index: number; label: string; value: number | null | undefined; hint?: string | null }) {
  const shown = useCountUp(value)
  return (
    <Card className="ma-home-card flex h-full min-h-[9.5rem] flex-col motion-safe:hover:-translate-y-0.5" style={{ animationDelay: `${index * 40}ms` }}>
      <CardBody className="flex h-full flex-col p-4">
        <p className="text-xs uppercase tracking-wide text-ma-muted">{label}</p>
        <p className="mt-2 font-display text-3xl tabular-nums text-ma-navy-900 dark:text-ma-gold-300">{shown ?? '—'}</p>
        <p className="mt-2 min-h-8 text-xs text-ma-muted">{hint ?? ''}</p>
      </CardBody>
    </Card>
  )
}

function HomeLists({
  columns,
  projectCode,
  ticketsLoading,
  ticketsError,
  openTickets,
  echeances,
  groupedNotifs,
  kpis,
}: {
  columns: 3 | 4
  projectCode?: string
  ticketsLoading: boolean
  ticketsError: boolean
  openTickets: TicketDto[]
  echeances: TicketDto[]
  groupedNotifs: NotifGroup[]
  kpis?: { id: number; label: string; value: number | string | null }[]
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [fading, setFading] = useState<Set<number>>(new Set())
  const markRead = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => markNotificationRead(id))),
    onMutate: (ids) => setFading((prev) => new Set([...prev, ...ids])),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
  const grid = columns === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'
  if (ticketsLoading) {
    return (
      <div className={cn('grid w-full grid-cols-1 items-stretch gap-4 md:grid-cols-2', grid)}>
        {Array.from({ length: columns }, (_, i) => <CardSkeleton key={i} index={i} />)}
      </div>
    )
  }
  return (
    <div className={cn('grid w-full grid-cols-1 items-stretch gap-4 md:grid-cols-2', grid)}>
      <DashCard index={0} title={t('home.openTickets')} href="/tickets" action={t('home.seeAll')}>
        {ticketsError && <p className="px-4 py-3 text-sm text-status-danger">{t('home.ticketsLoadError')}</p>}
        {!ticketsError && openTickets.length === 0 && (
          <EmptyState icon={<Ticket className="h-4 w-4" />} title={projectCode ? t('home.noContextData') : t('home.noOpenTickets')} hint={t('home.emptyTicketsHint')} />
        )}
        {openTickets.map((row, i) => <TicketRow key={row.id} ticket={row} index={i} />)}
      </DashCard>
      <DashCard index={1} title={t('home.dueToday')} href="/tickets" action={t('home.seeAll')}>
        {echeances.length === 0 && (
          <EmptyState icon={<CalendarClock className="h-4 w-4" />} title={t('home.noDueToday')} hint={t('home.emptyDueHint')} />
        )}
        {echeances.map((row, i) => <TicketRow key={row.id} ticket={row} index={i} />)}
      </DashCard>
      <DashCard index={2} title={t('home.unreadNotifs')}>
        {groupedNotifs.length === 0 && (
          <EmptyState icon={<BellOff className="h-4 w-4" />} title={t('home.noUnread')} hint={t('home.emptyNotifsHint')} />
        )}
        {groupedNotifs.map((group, i) => (
          <NotifRow
            key={group.key}
            group={group}
            index={i}
            fading={group.ids.every((id) => fading.has(id))}
            onRead={() => markRead.mutate(group.ids)}
          />
        ))}
      </DashCard>
      {kpis && (
        <DashCard index={3} title={t('home.kpis')}>
          {kpis.length === 0 && (
            <EmptyState icon={<Inbox className="h-4 w-4" />} title={t('home.noKpis')} hint={t('home.emptyKpisHint')} />
          )}
          {kpis.map((row, i) => <KpiRow key={row.id} label={row.label} value={row.value} index={i} />)}
        </DashCard>
      )}
    </div>
  )
}

function InternalTickets(props: Omit<Parameters<typeof HomeLists>[0], 'columns' | 'kpis'>) {
  return <HomeLists {...props} columns={3} />
}

function DashCard({ index, title, href, action, children }: { index: number; title: string; href?: string; action?: string; children: ReactNode }) {
  return (
    <Card
      className="ma-home-card flex h-full min-h-[360px] min-w-0 flex-col overflow-hidden motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[var(--shadow-ma-md)]"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <CardHeader className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 py-0">
        <h2 className="min-w-0 truncate text-sm font-semibold text-ma-navy-900 dark:text-ma-white">{title}</h2>
        {href && action && (
          <Link
            to={href}
            className="shrink-0 text-sm text-ma-gold-600 transition hover:text-ma-gold-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ma-gold-500 dark:text-ma-gold-400"
          >
            {action}
          </Link>
        )}
      </CardHeader>
      <CardBody className="ma-home-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-0">{children}</CardBody>
    </Card>
  )
}

function CardSkeleton({ index, compact }: { index: number; compact?: boolean }) {
  return (
    <Card className={cn('flex h-full flex-col overflow-hidden', compact ? 'min-h-[9.5rem]' : 'min-h-[360px]')} style={{ animationDelay: `${index * 40}ms` }}>
      <CardHeader className="flex h-14 items-center px-4 py-0">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardBody className="flex flex-1 flex-col gap-0 p-0">
        {Array.from({ length: compact ? 1 : 4 }, (_, i) => (
          <Skeleton key={i} className={cn('mx-4 my-3 rounded-md', compact ? 'h-12' : 'h-10')} />
        ))}
      </CardBody>
    </Card>
  )
}

function ticketHint(ticket: TicketDto): string | null {
  const embedded = ticket.titre.match(/([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 .'-]{0,24}#\d+)/)
  if (embedded) return embedded[1].trim()
  if (ticket.reference && ticket.titre.includes(ticket.reference)) return ticket.reference
  return null
}

const PRIORITY: Record<string, string> = {
  CRITIQUE: 'bg-red-700 text-white',
  HIGH: 'bg-red-700 text-white',
  ELEVEE: 'bg-orange-700 text-white',
  MEDIUM: 'bg-orange-700 text-white',
  NORMALE: 'bg-slate-600 text-white dark:bg-slate-500',
  NORMAL: 'bg-slate-600 text-white dark:bg-slate-500',
  FAIBLE: 'bg-sky-100 text-sky-950 dark:bg-sky-900/50 dark:text-sky-100',
  LOW: 'bg-sky-100 text-sky-950 dark:bg-sky-900/50 dark:text-sky-100',
}

function PriorityPill({ priorite }: { priorite: string }) {
  const key = priorite?.toUpperCase() ?? ''
  return (
    <span className={cn('inline-flex h-6 w-[5.75rem] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', PRIORITY[key] ?? 'bg-slate-600 text-white')}>
      {prioriteLabel(priorite)}
    </span>
  )
}

function TicketRow({ ticket, index }: { ticket: TicketDto; index: number }) {
  const hint = ticketHint(ticket)
  return (
    <Link
      to={`/tickets/${ticket.id}`}
      title={ticket.titre}
      style={{ animationDelay: `${index * 40}ms` }}
      className="group ma-home-line flex h-16 shrink-0 items-center gap-3 border-b border-ma-line/70 px-4 transition duration-200 hover:translate-x-0.5 hover:bg-ma-navy-900/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ma-gold-500 dark:border-white/10 dark:hover:bg-white/5"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ma-navy-900 dark:text-ma-white">{ticket.titre}</span>
        {hint && <span className="block truncate text-xs text-ma-muted dark:text-ma-gray-300">{hint}</span>}
      </span>
      <PriorityPill priorite={ticket.priorite} />
      <ArrowRight className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-ma-gold-600 opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 dark:text-ma-gold-400" />
    </Link>
  )
}

function notifVisual(titre: string, message: string) {
  const text = `${titre} ${message}`.toLowerCase()
  if (/permission|accès|acces|rôle|role|grant/.test(text)) {
    return { Icon: KeyRound, box: 'bg-violet-500/15 text-violet-800 dark:text-violet-200' }
  }
  if (/sla|échéance|echeance|retard|délai|delai/.test(text)) {
    return { Icon: Timer, box: 'bg-orange-500/15 text-orange-800 dark:text-orange-200' }
  }
  if (/ticket/.test(text)) {
    return { Icon: Ticket, box: 'bg-sky-500/15 text-sky-950 dark:text-sky-100' }
  }
  return { Icon: Bell, box: 'bg-ma-navy-900/8 text-ma-navy-800 dark:bg-white/10 dark:text-ma-gold-300' }
}

function NotifRow({ group, index, fading, onRead }: { group: NotifGroup; index: number; fading: boolean; onRead: () => void }) {
  const { t } = useTranslation()
  const { Icon, box } = notifVisual(group.titre, group.latest.message ?? '')
  const message = group.latest.message ?? ''
  return (
    <button
      type="button"
      onClick={onRead}
      title={message || group.titre}
      style={{ animationDelay: `${index * 40}ms` }}
      className="ma-home-line flex h-16 w-full shrink-0 items-start gap-3 overflow-hidden border-b border-ma-line/70 px-4 pt-2 text-left transition duration-200 hover:bg-ma-navy-900/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ma-gold-500 dark:border-white/10 dark:hover:bg-white/5"
    >
      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', box)}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ma-navy-900 dark:text-ma-white">{group.titre}</span>
        {message && <span className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-ma-muted dark:text-ma-gray-300">{message}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[11px] tabular-nums text-ma-muted dark:text-ma-gray-300">{formatNotifTime(group.latest.createdAt)}</span>
        <span className="flex items-center gap-1.5">
          {group.count > 1 && (
            <span className="rounded-full bg-ma-gold-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-ma-gold-700 dark:text-ma-gold-400">
              {t('home.times', { count: group.count })}
            </span>
          )}
          <span className={cn('h-2 w-2 rounded-full bg-ma-gold-500 transition duration-300', fading ? 'scale-0 opacity-0' : 'opacity-100')} />
        </span>
      </span>
    </button>
  )
}

function KpiRow({ label, value, index }: { label: string; value: number | string | null; index: number }) {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null
  const shown = useCountUp(numeric)
  return (
    <div
      style={{ animationDelay: `${index * 40}ms` }}
      className="ma-home-line flex h-16 shrink-0 items-center justify-between gap-3 border-b border-ma-line/70 px-4 dark:border-white/10"
    >
      <span className="min-w-0 truncate text-sm text-ma-navy-900 dark:text-ma-white" title={label}>{label}</span>
      <span className="font-display text-lg tabular-nums text-ma-navy-900 dark:text-ma-gold-300">{shown ?? value ?? '—'}</span>
    </div>
  )
}

function HomeAnalytics() {
  const { t } = useTranslation()
  const accessToken = useAuthStore((s) => s.accessToken)
  const currentProject = useProjectStore((s) => s.currentProject)
  const projectCode = currentProject === 'ENTREPRISE' ? undefined : currentProject
  const [vue, setVue] = useState<string | undefined>()
  const cnn = currentProject === 'CNN'
  const dash = useQuery({
    queryKey: ['accueil-dash', cnn ? undefined : vue, projectCode ?? 'ENTREPRISE'],
    queryFn: () => fetchAccueilDashboard(cnn ? undefined : vue, projectCode),
    enabled: Boolean(accessToken),
    refetchInterval: cnn ? 10_000 : false,
  })
  const data = dash.data
  const views = data?.vuesDisponibles ?? []
  if (cnn && data && data.source !== 'CNN_DB') {
    return null
  }

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
      <div className="grid items-stretch gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="ma-home-rise h-[420px] min-w-0">
        <DashboardBarChart
          className="h-full"
          title={data?.titreActivite ?? 'Activité des 7 derniers jours'}
          data={data?.activiteParJour ?? []}
          dataKey="valeur"
          xAxisKey="jour"
          loading={dash.isLoading}
          unit={data?.uniteActivite}
          zeroAsData={data?.vue === 'CNN'}
          footnote={data?.activiteMessage}
        />
        </div>
        <div className="ma-home-rise h-[420px] min-w-0" style={{ animationDelay: '40ms' }}>
        <DashboardDonutChart
          className="h-full"
          title={data?.titreRepartition ?? 'Répartition par statut'}
          data={data?.repartitionParStatut ?? []}
          loading={dash.isLoading}
          centerLabel="Total"
          centerValue={(data?.repartitionParStatut ?? []).reduce((s, r) => s + r.valeur, 0)}
        />
        </div>
      </div>
      <div className="ma-home-rise h-[420px] min-w-0" style={{ animationDelay: '80ms' }}>
      <DashboardHistogram
        className="h-full"
        title={data?.titreHistogramme ?? 'Répartition des délais de traitement'}
        bins={data?.histogrammeDelais ?? []}
        loading={dash.isLoading}
        synthesis={data?.syntheseTendance}
        zeroAsData={data?.vue === 'CNN' && data?.histogrammeDisponible !== false}
        unavailableMessage={data?.histogrammeDisponible === false ? data.histogrammeMessage : null}
      />
      </div>
    </section>
  )
}
