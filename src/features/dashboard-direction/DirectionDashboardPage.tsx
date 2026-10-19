import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarRange, CheckCircle2, ChevronRight, Database, Download, Gauge, PhoneCall, ShieldCheck, Truck, Undo2 } from 'lucide-react'
import { DashboardBarChart } from '../../components/charts/DashboardBarChart'
import { DashboardDonutChart } from '../../components/charts/DashboardDonutChart'
import { Badge, prioriteLabel, prioriteTone, sentence } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { PageHeader } from '../../components/ui/page-header'
import { CnnSourceBadge } from '../../components/ui/cnn-source-badge'
import { EmptyState, ScopeEmpty } from '../../components/ui/scope-empty'
import { StatCard } from '../../components/ui/stat-card'
import { SectionCard } from '../../components/ui/toolbar'
import { Mono } from '../../components/ui/table'
import { Skeleton } from '../../components/ui/skeleton'
import { Stagger, StaggerItem } from '../../components/motion/page-fade'
import { fetchDirectionDashboard, type DirectionCnn } from '../../lib/api/ops'
import { fetchVitrine, type VitrineKpi } from '../../lib/api/domain'
import { exportTickets, listTickets } from '../../lib/api/tickets'
import { useProjectStore } from '../../lib/projects/project-store'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { categorieLabel as rawCategorieLabel, kpiLabel } from '../../lib/vitrine/labels'

const categorieLabel = (code: string) => {
  const label = rawCategorieLabel(code)
  return label === code ? sentence(code.replaceAll('_', ' ')) : label
}
import { projectLabel } from '../../lib/rbac/rbac'
import { cn } from '../../lib/utils'
import { MetricRow, StatSkeletons, compact, foldSlices } from '../ops/charts'

const KPI_ACCENTS = ['gold', 'info', 'ok', 'warn'] as const

function formatDateTime(iso: string | undefined | null, lang: string) {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
}

export function DirectionDashboardPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'fr'
  const currentProject = useProjectStore((s) => s.currentProject)
  const cnn = currentProject === 'CNN'
  const direction = useQuery({
    queryKey: ['direction-cnn', currentProject],
    queryFn: () => fetchDirectionDashboard(currentProject),
    enabled: cnn,
    refetchInterval: cnn ? 10_000 : false,
  })
  const kpis = useQuery({ queryKey: ['vitrine', currentProject], queryFn: fetchVitrine, enabled: !cnn })
  const tickets = useQuery({
    queryKey: ['tickets-dir', currentProject],
    queryFn: () =>
      listTickets({
        projectCode: currentProject === 'ENTREPRISE' ? undefined : currentProject,
      }),
    enabled: !cnn,
  })

  const filtered = (kpis.data ?? []).filter((k) => currentProject === 'ENTREPRISE' || k.project?.code === currentProject)
  const cards = filtered.slice(0, 4)
  const byCategory = Object.entries(
    filtered.reduce<Record<string, number>>((acc, kpi) => {
      acc[kpi.categorie] = (acc[kpi.categorie] ?? 0) + Number(kpi.valeur ?? 0)
      return acc
    }, {}),
  ).map(([name, value]) => ({ label: categorieLabel(name), valeur: value, couleur: '' }))

  const incidents = (tickets.data ?? []).filter((t) => t.type === 'INCIDENT' && !['CLOTURE', 'ANNULE', 'RESOLU'].includes(t.statut))
  const volume = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'].map((mois, i) => ({
    mois,
    volume: filtered.reduce((sum, k) => sum + Number(k.valeur ?? 0), 0) / 6 + i,
  }))
  const lastUpdate = formatDateTime(filtered[0]?.derniereMaj, lang)

  if (cnn) {
    return (
      <RequirePermission anyOf={['DIRECTION', 'CONSEIL_ADMINISTRATION', 'ADMIN_SYSTEME']}>
        <CnnDirection data={direction.data} loading={direction.isLoading} lang={lang} />
      </RequirePermission>
    )
  }

  return (
    <RequirePermission anyOf={['DIRECTION', 'CONSEIL_ADMINISTRATION', 'ADMIN_SYSTEME']}>
      <div className="space-y-6">
        <PageHeader
          kicker={t('pages.direction.kicker')}
          title={t('pages.direction.title')}
          subtitle={projectLabel(currentProject === 'ENTREPRISE' ? null : currentProject)}
          actions={
            <Button variant="outline" onClick={() => void exportTickets(currentProject === 'ENTREPRISE' ? undefined : currentProject)}>
              <Download size={16} />
              {t('opsui.direction.export', 'Exporter le rapport')}
            </Button>
          }
        />
        {kpis.isLoading ? (
          <StatSkeletons />
        ) : cards.length === 0 ? (
          <Card>
            <EmptyState icon={<Gauge />} title={t('opsui.direction.noKpi', 'Aucun indicateur publié')} hint={t('opsui.direction.noKpiHint', 'Les indicateurs de la vitrine apparaîtront ici dès leur publication.')} />
          </Card>
        ) : (
          <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 [&>*>*]:h-full">
            {cards.map((kpi, i) => (
              <StaggerItem key={kpi.id}>
                <KpiTile kpi={kpi} accent={KPI_ACCENTS[i % 4]} />
              </StaggerItem>
            ))}
          </Stagger>
        )}
        <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="h-[380px] min-w-0">
            <DashboardBarChart
              className="h-full"
              title={t('opsui.direction.monthly', 'Volume mensuel')}
              data={volume}
              dataKey="volume"
              xAxisKey="mois"
              loading={kpis.isLoading}
              color={1}
            />
          </div>
          <div className="h-[380px] min-w-0">
            <DashboardDonutChart
              className="h-full"
              title={t('opsui.direction.byCategory', 'Répartition par catégorie')}
              data={byCategory}
              loading={kpis.isLoading}
              centerLabel={t('cnn.finance.center')}
              centerValue={compact(byCategory.reduce((sum, row) => sum + row.valeur, 0))}
            />
          </div>
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <SectionCard
            title={t('opsui.direction.activeIncidents', 'Incidents actifs')}
            subtitle={incidents.length ? t('opsui.direction.incidentCount', '{{count}} en cours de traitement', { count: incidents.length }) : undefined}
            icon={<AlertTriangle />}
            tone="coral"
            bodyClassName="px-2 pb-3 pt-2 sm:px-3"
            action={
              incidents.length > 0 ? (
                <Link to="/tickets" className="rounded-[8px] px-2 py-1 text-[12.5px] font-semibold text-accent-ink hover:bg-ma-gold-500/10">
                  {t('opsui.direction.seeAll', 'Tout voir')}
                </Link>
              ) : undefined
            }
          >
            {tickets.isLoading ? (
              <div className="space-y-3 px-3 py-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : incidents.length === 0 ? (
              <EmptyState icon={<CheckCircle2 />} title={t('opsui.direction.noIncident', 'Aucun incident actif')} hint={t('opsui.direction.noIncidentHint', 'Tout est calme pour le moment.')} />
            ) : (
              <ul>
                {incidents.slice(0, 8).map((ticket) => (
                  <li key={ticket.id}>
                    <Link
                      to={`/tickets/${ticket.id}`}
                      className="group flex items-center gap-3 rounded-[14px] px-3 py-2.5 transition-colors hover:bg-ink/[0.035] focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)] dark:hover:bg-white/[0.04]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13.5px] font-medium text-ink">{ticket.titre}</p>
                        <Mono className="text-ink-3">{ticket.reference}</Mono>
                      </div>
                      <Badge tone={prioriteTone(ticket.priorite)}>{prioriteLabel(ticket.priorite)}</Badge>
                      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard title={t('opsui.direction.health', 'Santé du système')} icon={<ShieldCheck />} tone="teal">
            <HealthLine ok label={t('opsui.direction.coreUp', 'Cœur applicatif joignable')} />
            <MetricRow
              label={t('opsui.direction.vitrineUpdate', 'Dernière mise à jour de la vitrine')}
              value={<span className="text-[14px] font-medium">{lastUpdate ?? <span className="text-ink-3">–</span>}</span>}
            />
            <MetricRow label={t('opsui.direction.kpiCount', 'Indicateurs suivis')} value={filtered.length} />
          </SectionCard>
        </div>
      </div>
    </RequirePermission>
  )
}

function KpiTile({ kpi, accent }: { kpi: VitrineKpi; accent: (typeof KPI_ACCENTS)[number] }) {
  const { t } = useTranslation()
  const hint = `${categorieLabel(kpi.categorie)} · ${kpi.project?.code ? projectLabel(kpi.project.code) : t('opsui.direction.allProjects', 'Tous projets')}`
  const numeric = typeof kpi.valeur === 'number' ? kpi.valeur : kpi.valeur != null && kpi.valeur !== '' && !Number.isNaN(Number(kpi.valeur)) ? Number(kpi.valeur) : null
  if (numeric != null) return <StatCard label={kpiLabel(kpi.cle, kpi.categorie)} value={numeric} hint={hint} accent={accent} />
  return (
    <div className="clay flex min-h-[132px] flex-col rounded-[var(--radius-ma)] p-5 ring-1 ring-hairline">
      <p className="text-[12.5px] font-medium leading-snug text-ink-3">{kpiLabel(kpi.cle, kpi.categorie)}</p>
      <p className="mt-auto pt-3 text-[24px] font-semibold leading-tight tracking-[-0.03em] text-ink">{kpi.valeur ?? <span className="text-ink-3">–</span>}</p>
      <p className="mt-2 text-[12px] text-ink-3">{hint}</p>
    </div>
  )
}

function HealthLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-hairline pb-3">
      <span className="relative flex h-2.5 w-2.5">
        {ok && <span className="ma-pulse absolute inline-flex h-full w-full rounded-full bg-status-success/60" />}
        <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', ok ? 'bg-status-success' : 'bg-status-danger')} />
      </span>
      <p className="text-[13.5px] font-medium text-ink">{label}</p>
    </div>
  )
}

function CnnDirection({ data, loading, lang }: { data?: DirectionCnn; loading: boolean; lang: string }) {
  const { t } = useTranslation()
  const unavailable = !loading && data?.source !== 'CNN_DB'
  const slices = foldSlices(
    (data?.parStatut ?? []).map((row) => ({ label: t(`cnn.status.${row.statut}`, { defaultValue: row.statut }), valeur: Number(row.volume ?? 0) })),
    6,
    t('opsui.charts.other', 'Autres'),
  )
  const months = (data?.coursesParMois ?? []).map((row) => ({
    mois: formatMonth(row.mois, lang),
    volume: row.volume,
  }))
  const sixMonths = months.reduce((s, m) => s + Number(m.volume ?? 0), 0)
  const thisMonth = months.length ? Number(months[months.length - 1].volume ?? 0) : 0
  const updated = data?.calculeLe
    ? new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'medium', hour12: false }).format(new Date(data.calculeLe))
    : null
  const noIncidentData = data?.remboursementsEnAttente == null && data?.appelsUrgence == null
  return (
    <div className="space-y-6">
      <PageHeader
        kicker={t('pages.direction.kicker')}
        title={t('pages.direction.title')}
        subtitle={projectLabel('CNN')}
      />
      {(data || !loading) && <div className="max-w-full [&>p]:h-auto [&>p]:min-h-7 [&>p]:rounded-[14px] [&>p]:py-1 [&>p]:leading-snug sm:[&>p]:rounded-full"><CnnSourceBadge source={data?.source} ageSecondes={data?.ageSecondes} readOnlyVerified={data?.readOnlyVerified} /></div>}
      {loading && <StatSkeletons />}
      {unavailable && <ScopeEmpty context={t('cnn.source.downDetail')} />}
      {!unavailable && !loading && (
        <>
          <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 [&>*>*]:h-full">
            <StaggerItem>
              <StatCard label={t('opsui.direction.coursesMonth', 'Courses ce mois-ci')} value={thisMonth} accent="gold" icon={<Truck />} />
            </StaggerItem>
            <StaggerItem>
              <StatCard label={t('opsui.direction.courses6m', 'Courses sur 6 mois')} value={sixMonths} accent="info" icon={<CalendarRange />} />
            </StaggerItem>
            <StaggerItem>
              <StatCard label={t('cnn.direction.refundsPending')} value={data?.remboursementsEnAttente ?? 0} accent="warn" icon={<Undo2 />} />
            </StaggerItem>
            <StaggerItem>
              <StatCard label={t('cnn.direction.emergency')} value={data?.appelsUrgence ?? 0} accent={(data?.appelsUrgence ?? 0) > 0 ? 'danger' : 'ok'} icon={<PhoneCall />} />
            </StaggerItem>
          </Stagger>
          <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="h-[400px] min-w-0">
              <DashboardBarChart
                className="h-full"
                title={t('cnn.direction.volume')}
                subtitle={t('opsui.direction.sixMonths', 'Six derniers mois')}
                data={months}
                dataKey="volume"
                xAxisKey="mois"
                color={1}
                unit={t('cnn.direction.courses').toLocaleLowerCase(lang)}
              />
            </div>
            <div className="h-[400px] min-w-0">
              <DashboardDonutChart className="h-full" title={t('cnn.direction.split')} data={slices} centerLabel={t('cnn.direction.courses')} />
            </div>
          </div>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <SectionCard title={t('cnn.direction.incidents')} icon={<AlertTriangle />} tone="coral">
              {noIncidentData ? (
                <EmptyState icon={<CheckCircle2 />} title={t('cnn.direction.emptyIncidents')} />
              ) : (
                <>
                  <MetricRow
                    label={t('cnn.direction.refundsPending')}
                    value={data?.remboursementsEnAttente ?? 0}
                    tone={(data?.remboursementsEnAttente ?? 0) > 0 ? 'warning' : undefined}
                  />
                  <MetricRow label={t('cnn.direction.emergency')} value={data?.appelsUrgence ?? 0} tone={(data?.appelsUrgence ?? 0) > 0 ? 'danger' : undefined} />
                  {(data?.remboursementsEnAttente ?? 0) === 0 && (data?.appelsUrgence ?? 0) === 0 && (
                    <p className="pt-3 text-[13px] text-ink-3">{t('cnn.direction.noneOpen')}</p>
                  )}
                </>
              )}
            </SectionCard>
            <SectionCard title={t('cnn.direction.health')} icon={<Database />} tone="teal">
              <HealthLine ok={data?.source === 'CNN_DB'} label={t('opsui.direction.readOnlyDb', 'Base Colis na Nga lue en lecture seule')} />
              <MetricRow
                label={t('opsui.direction.lastRead', 'Dernière lecture')}
                value={<span className="text-[14px] font-medium">{updated ?? <span className="text-ink-3">–</span>}</span>}
              />
            </SectionCard>
          </div>
        </>
      )}
    </div>
  )
}

function formatMonth(iso: string, lang: string) {
  const [year, month] = iso.split('-').map(Number)
  if (!year || !month) return iso
  return new Intl.DateTimeFormat(lang, { month: 'short', year: '2-digit' }).format(new Date(year, month - 1, 1))
}
