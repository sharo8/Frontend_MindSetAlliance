import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  Activity,
  Bell,
  BellOff,
  CalendarClock,
  CheckCheck,
  ChevronRight,
  Gauge,
  Inbox,
  KeyRound,
  Ticket,
  Timer,
} from 'lucide-react'
import { DashboardBarChart } from '../../components/charts/DashboardBarChart'
import { DashboardDonutChart } from '../../components/charts/DashboardDonutChart'
import { DashboardHistogram } from '../../components/charts/DashboardHistogram'
import { Card, CardTitle, IconTile, type IconTone } from '../../components/ui/card'
import { EmptyState } from '../../components/ui/scope-empty'
import { Badge, prioriteLabel, prioriteTone } from '../../components/ui/badge'
import { Skeleton } from '../../components/ui/skeleton'
import { PageHeader, SectionHeader } from '../../components/ui/page-header'
import { Segmented } from '../../components/ui/segmented'
import { StatCard } from '../../components/ui/stat-card'
import { Stagger, StaggerItem } from '../../components/motion/page-fade'
import { spring } from '../../components/motion/springs'
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
import { CnnDashboard } from '../cnnadmin/CnnDashboard'

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
  const diff = (Date.now() - date.getTime()) / 60000
  if (diff < 1) return 'à l’instant'
  if (diff < 60) return `il y a ${Math.round(diff)} min`
  if (diff < 24 * 60) return `il y a ${Math.round(diff / 60)} h`
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
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

/** Accueil : le tableau de bord change avec le projet choisi dans le sélecteur. */
export function HomePage() {
  const currentProject = useProjectStore((s) => s.currentProject)
  if (currentProject === 'CNN') return <CnnDashboard />
  return <EnterpriseHome />
}

function EnterpriseHome() {
  const { t, i18n } = useTranslation()
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
  const allOpen = tickets.data ?? []
  const openTickets = allOpen.slice(0, 5)
  const dueToday = allOpen.filter((row) => row.echeance?.startsWith(today))
  const echeances = dueToday.slice(0, 5)
  const critical = allOpen.filter((row) => ['CRITIQUE', 'HIGH'].includes((row.priorite ?? '').toUpperCase())).length
  const unread = (notifs.data ?? []).filter((n) => !n.lu)
  const groupedNotifs = useMemo(() => groupUnread(unread).slice(0, 5), [unread])
  const scopedKpis = (kpis.data ?? []).filter((k) => !projectCode || k.project?.code === projectCode)

  const title = useGreetingName(me.data?.prenom, email)
  const roleNames = roles.map((r) => roleLabel(r.role)).filter(Boolean)
  const dateLocale = i18n.language === 'en' ? 'en-GB' : i18n.language === 'sw' ? 'sw-TZ' : 'fr-FR'
  const longDate = new Date().toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-8">
      <PageHeader
        kicker={longDate}
        title={title}
        subtitle={
          <span className="mt-1 flex flex-wrap items-center gap-2">
            {roleNames.map((r) => (
              <Badge key={r} tone="navy">
                {r}
              </Badge>
            ))}
          </span>
        }
      />

      {tickets.isLoading ? (
        <MetricSkeletons />
      ) : (
        <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StaggerItem>
            <StatCard label={t('home.openTickets')} value={allOpen.length} icon={<Ticket />} accent="info" hint={critical ? `${critical} critique${critical > 1 ? 's' : ''}` : 'Aucun critique'} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label={t('home.dueToday')} value={dueToday.length} icon={<CalendarClock />} accent="warn" hint={dueToday.length ? 'À traiter avant ce soir' : 'Rien d’urgent'} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label={t('home.unreadNotifs')} value={unread.length} icon={<Bell />} accent="gold" hint={unread.length ? 'En attente de lecture' : t('home.emptyNotifsHint')} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Indicateurs suivis" value={scopedKpis.length} icon={<Gauge />} accent="ok" hint={projectCode ? `Projet ${projectCode}` : 'Toute l’entreprise'} />
          </StaggerItem>
        </Stagger>
      )}
      <HomeLists
        projectCode={projectCode}
        ticketsLoading={tickets.isLoading || kpis.isLoading}
        ticketsError={tickets.isError}
        openTickets={openTickets}
        echeances={echeances}
        groupedNotifs={groupedNotifs}
        kpis={scopedKpis.slice(0, 5).map((k) => ({ id: k.id, label: kpiLabel(k.cle, k.categorie), value: k.valeur, project: k.project?.code }))}
      />
      <HomeAnalytics />
    </div>
  )
}

function MetricSkeletons() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="min-h-[132px] p-5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="mt-9 h-8 w-20" />
        </Card>
      ))}
    </div>
  )
}

function HomeLists({
  projectCode,
  ticketsLoading,
  ticketsError,
  openTickets,
  echeances,
  groupedNotifs,
  kpis,
}: {
  projectCode?: string
  ticketsLoading: boolean
  ticketsError: boolean
  openTickets: TicketDto[]
  echeances: TicketDto[]
  groupedNotifs: NotifGroup[]
  kpis?: { id: number; label: string; value: number | string | null; project?: string }[]
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
  const grid = kpis ? 'lg:grid-cols-2 2xl:grid-cols-4' : 'lg:grid-cols-3'
  if (ticketsLoading) {
    return (
      <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', grid)}>
        {Array.from({ length: kpis ? 4 : 3 }, (_, i) => (
          <Card key={i} className="min-h-[380px] p-5">
            <Skeleton className="h-4 w-40" />
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="mt-6 flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-[11px]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-2.5 w-2/5" />
                </div>
              </div>
            ))}
          </Card>
        ))}
      </div>
    )
  }
  return (
    <Stagger className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', grid)} delay={0.08}>
      <StaggerItem className="min-w-0">
        <DashCard title={t('home.openTickets')} icon={<Ticket />} tone="indigo" href="/tickets" action={t('home.seeAll')}>
          {ticketsError && <p className="px-5 py-4 text-sm text-status-danger">{t('home.ticketsLoadError')}</p>}
          {!ticketsError && openTickets.length === 0 && (
            <EmptyState icon={<Ticket />} title={projectCode ? t('home.noContextData') : t('home.noOpenTickets')} hint={t('home.emptyTicketsHint')} />
          )}
          {openTickets.map((row) => (
            <TicketRow key={row.id} ticket={row} />
          ))}
        </DashCard>
      </StaggerItem>
      <StaggerItem className="min-w-0">
        <DashCard title={t('home.dueToday')} icon={<CalendarClock />} tone="coral" href="/tickets" action={t('home.seeAll')}>
          {echeances.length === 0 && <EmptyState icon={<CalendarClock />} title={t('home.noDueToday')} hint={t('home.emptyDueHint')} />}
          {echeances.map((row) => (
            <TicketRow key={row.id} ticket={row} due />
          ))}
        </DashCard>
      </StaggerItem>
      <StaggerItem className="min-w-0">
        <DashCard title={t('home.unreadNotifs')} icon={<Bell />} tone="gold">
          {groupedNotifs.length === 0 && <EmptyState icon={<BellOff />} title={t('home.noUnread')} hint={t('home.emptyNotifsHint')} />}
          <AnimatePresence initial={false}>
            {groupedNotifs.map((group) => (
              <NotifRow
                key={group.key}
                group={group}
                fading={group.ids.every((id) => fading.has(id))}
                onRead={() => markRead.mutate(group.ids)}
              />
            ))}
          </AnimatePresence>
          {groupedNotifs.length > 0 && groupedNotifs.length < 4 && (
            <p className="mt-auto flex items-center justify-center gap-2 px-5 pb-1 pt-6 text-center text-[12px] text-ink-3">
              <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
              {t('home.notifsFooterHint')}
            </p>
          )}
        </DashCard>
      </StaggerItem>
      {kpis && (
        <StaggerItem className="min-w-0">
          <DashCard title={t('home.kpis')} icon={<Activity />} tone="teal">
            {kpis.length === 0 && <EmptyState icon={<Inbox />} title={t('home.noKpis')} hint={t('home.emptyKpisHint')} />}
            {kpis.map((row) => (
              <KpiRow key={row.id} label={row.label} value={row.value} project={row.project} />
            ))}
          </DashCard>
        </StaggerItem>
      )}
    </Stagger>
  )
}

function DashCard({
  title,
  icon,
  tone,
  href,
  action,
  children,
}: {
  title: string
  icon: ReactNode
  tone: IconTone
  href?: string
  action?: string
  children: ReactNode
}) {
  return (
    <Card className="flex h-full min-h-[380px] min-w-0 flex-col overflow-hidden">
      <div className="shrink-0 px-5 pb-2 pt-5">
        <CardTitle
          title={title}
          icon={<IconTile tone={tone} size="sm">{icon}</IconTile>}
          action={
            href && action ? (
              <Link
                to={href}
                className="press inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[13px] font-semibold text-accent-ink hover:bg-ma-gold-500/10"
              >
                {action}
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              </Link>
            ) : undefined
          }
        />
      </div>
      <div className="ma-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">{children}</div>
    </Card>
  )
}

const PRIORITY_TONE: Record<string, IconTone> = { danger: 'coral', warning: 'gold', info: 'sky', muted: 'neutral' }

function TicketRow({ ticket, due }: { ticket: TicketDto; due?: boolean }) {
  const { i18n } = useTranslation()
  const tone = prioriteTone(ticket.priorite)
  const time = due && ticket.echeance
    ? new Date(ticket.echeance).toLocaleTimeString(i18n.language || 'fr', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    : null
  return (
    <Link
      to={`/tickets/${ticket.id}`}
      title={ticket.titre}
      className="press group flex min-h-[64px] items-center gap-3 rounded-[16px] px-3 py-2.5 hover:bg-ink/[0.04] focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)] dark:hover:bg-white/[0.05]"
    >
      <IconTile tone={PRIORITY_TONE[tone] ?? 'neutral'} size="sm">
        {due ? <Timer /> : <Ticket />}
      </IconTile>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium leading-snug text-ink">{ticket.titre}</span>
        <span className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-ink-3">
          <span className="font-mono text-[11px] tracking-tight">{ticket.reference}</span>
          {ticket.project?.code && <span aria-hidden>·</span>}
          {ticket.project?.code && <span>{ticket.project.code}</span>}
          {time && <span aria-hidden>·</span>}
          {time && <span className="font-medium text-accent-ink">{time}</span>}
        </span>
      </span>
      <Badge tone={tone} className="hidden sm:inline-flex">
        {prioriteLabel(ticket.priorite)}
      </Badge>
      <ChevronRight className="-ml-3 h-4 w-0 shrink-0 text-ink-3 opacity-0 transition-all duration-300 group-hover:ml-0 group-hover:w-4 group-hover:opacity-100" />
    </Link>
  )
}

function notifVisual(titre: string, message: string): { Icon: typeof Bell; tone: IconTone } {
  const text = `${titre} ${message}`.toLowerCase()
  if (/permission|accès|acces|rôle|role|grant|connexion/.test(text)) return { Icon: KeyRound, tone: 'violet' }
  if (/sla|échéance|echeance|retard|délai|delai/.test(text)) return { Icon: Timer, tone: 'coral' }
  if (/ticket/.test(text)) return { Icon: Ticket, tone: 'indigo' }
  return { Icon: Bell, tone: 'navy' }
}

function NotifRow({ group, fading, onRead }: { group: NotifGroup; fading: boolean; onRead: () => void }) {
  const { t } = useTranslation()
  const { Icon, tone } = notifVisual(group.titre, group.latest.message ?? '')
  const message = group.latest.message ?? ''
  return (
    <motion.button
      layout
      type="button"
      onClick={onRead}
      title={message || group.titre}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: fading ? 0.45 : 1, y: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
      transition={spring.snappy}
      className="flex min-h-[64px] w-full items-start gap-3 rounded-[16px] px-3 py-2.5 text-left hover:bg-ink/[0.04] focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)] dark:hover:bg-white/[0.05]"
    >
      <IconTile tone={tone} size="sm">
        <Icon />
      </IconTile>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-ink">{group.titre}</span>
          {group.count > 1 && (
            <span className="shrink-0 rounded-full bg-ma-gold-500/15 px-1.5 text-[11px] font-semibold text-accent-ink">{t('home.times', { count: group.count })}</span>
          )}
        </span>
        {message && <span className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-3">{message}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
        <span className="text-[11.5px] tabular-nums text-ink-3">{formatNotifTime(group.latest.createdAt)}</span>
        <span className={cn('h-2 w-2 rounded-full bg-ma-gold-500 transition duration-300', fading && 'scale-0 opacity-0')} />
      </span>
    </motion.button>
  )
}

function KpiRow({ label, value, project }: { label: string; value: number | string | null; project?: string }) {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null
  return (
    <div className="flex min-h-[64px] items-center justify-between gap-3 rounded-[16px] px-3 py-2.5">
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-medium text-ink" title={label}>
          {label}
        </span>
        {project && <span className="mt-0.5 block text-[12px] text-ink-3">{project}</span>}
      </span>
      <span className="text-[20px] font-semibold tracking-[-0.03em] text-ink tabular-nums">
        {numeric !== null ? numeric.toLocaleString('fr-FR') : value ?? '–'}
      </span>
    </div>
  )
}

const VIEW_LABEL: Record<string, string> = { TICKETS: 'Tickets', FINANCE: 'Finance', RH: 'RH', CNN: 'Colis na Nga' }

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
    placeholderData: (prev) => prev,
  })
  const data = dash.data
  const views = data?.vuesDisponibles ?? []
  if (cnn && data && data.source !== 'CNN_DB') {
    return null
  }

  return (
    <section className="space-y-4">
      <SectionHeader
        title={t('home.analytics')}
        subtitle="Les 7 derniers jours en un coup d’œil."
        actions={
          views.length > 1 ? (
            <Segmented
              ariaLabel="Vue"
              value={(data?.vue ?? views[0]) as string}
              onChange={(v) => setVue(v)}
              options={views.map((option) => ({ value: option, label: VIEW_LABEL[option] ?? option }))}
            />
          ) : undefined
        }
      />
      <div className={cn('grid items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] transition-opacity duration-300', dash.isFetching && !dash.isLoading && 'opacity-70')}>
        <div className="h-[420px] min-w-0">
          <DashboardBarChart
            className="h-full"
            title={data?.titreActivite ?? 'Activité des 7 derniers jours'}
            subtitle={data?.uniteActivite ? `En ${data.uniteActivite}` : undefined}
            data={data?.activiteParJour ?? []}
            dataKey="valeur"
            xAxisKey="jour"
            loading={dash.isLoading}
            unit={data?.uniteActivite}
            zeroAsData={data?.vue === 'CNN'}
            footnote={data?.activiteMessage}
          />
        </div>
        <div className="h-[420px] min-w-0">
          <DashboardDonutChart
            className="h-full"
            title={data?.titreRepartition ?? 'Répartition par statut'}
            data={data?.repartitionParStatut ?? []}
            loading={dash.isLoading}
            centerLabel="Total"
          />
        </div>
      </div>
      <div className="h-[380px] min-w-0">
        <DashboardHistogram
          className="h-full"
          title={data?.titreHistogramme ?? 'Répartition des délais de traitement'}
          subtitle="Nombre de tickets par durée de résolution"
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
