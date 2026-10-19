import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Building2, Download, LogIn, RotateCcw, Ticket, Timer, UserCheck } from 'lucide-react'
import { useId, useMemo, useState, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { ChartFrame, ChartSummary, GlassTooltip, axisTick, fmtNumber, useViz } from '../../components/charts/chart-kit'
import { DashboardDonutChart } from '../../components/charts/DashboardDonutChart'
import { DashboardHistogram } from '../../components/charts/DashboardHistogram'
import { Stagger, StaggerItem } from '../../components/motion/page-fade'
import { sentence } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { FilterSelect } from '../../components/ui/toolbar'
import { PageHeader, SectionHeader } from '../../components/ui/page-header'
import { EmptyState } from '../../components/ui/scope-empty'
import { Segmented } from '../../components/ui/segmented'
import { Skeleton } from '../../components/ui/skeleton'
import { StatCard } from '../../components/ui/stat-card'
import { Table, TableCard, TBody, THead, Td, Th, Tr } from '../../components/ui/table'
import { ApiError } from '../../lib/api/client'
import {
  fetchSystemStats,
  type StatsCoverage,
  type StatsHeatmap,
  type StatsPeriod,
  type StatsPoint,
  type StatsRolesParProjet,
  type StatsScatterPoint,
  type StatsTreemapNode,
  type StatsWeekPoint,
  type SystemStats,
} from '../../lib/api/stats'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { permissionLabel, roleLabel } from '../../lib/rbac/rbac'
import { cn } from '../../lib/utils'
import { HBarList, Legend, tint } from './stats-viz'

const PERIODS: StatsPeriod[] = ['7', '30', '90', 'ALL']

/** Priorités de la plus faible à la plus forte (axe X du nuage de points). */
const PRIORITIES = [
  { code: 'FAIBLE', x: 1, label: 'Faible' },
  { code: 'NORMALE', x: 2, label: 'Normale' },
  { code: 'ELEVEE', x: 3, label: 'Élevée' },
  { code: 'CRITIQUE', x: 4, label: 'Critique' },
] as const

const num = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const list = <T,>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : [])

/** Données complètes même si l'API n'en renvoie qu'une partie. */
function normalize(raw: Partial<SystemStats> | undefined | null, period: StatsPeriod): SystemStats | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const actifs = raw.agentsActifs ?? { actifs: 0, total: 0, taux: 0 }
  const roles: StatsRolesParProjet = { roles: list(raw.rolesParProjet?.roles), series: list(raw.rolesParProjet?.series) }
  const coverage: StatsCoverage = {
    modules: list(raw.permissionCoverage?.modules),
    roles: list(raw.permissionCoverage?.roles).map((role) => ({ ...role, modules: list(role.modules) })),
  }
  const heat: StatsHeatmap = { jours: list(raw.loginHeatmap?.jours), max: num(raw.loginHeatmap?.max), cells: list(raw.loginHeatmap?.cells) }
  return {
    period: raw.period ?? period,
    generatedAt: raw.generatedAt ?? '',
    agentsActifs: { actifs: num(actifs.actifs), total: num(actifs.total), taux: num(actifs.taux) },
    agentsParDepartement: list(raw.agentsParDepartement),
    agentsParPerimetre: list(raw.agentsParPerimetre),
    ticketsParStatut: list(raw.ticketsParStatut),
    ancienneteComptes: list(raw.ancienneteComptes),
    ticketsParJour: list(raw.ticketsParJour),
    permissionsTop: list(raw.permissionsTop),
    rolesParProjet: roles,
    permissionCoverage: coverage,
    ticketsTreemap: list(raw.ticketsTreemap),
    loginHeatmap: heat,
    ticketFunnel: list(raw.ticketFunnel),
    agentsVsTickets: list(raw.agentsVsTickets),
    resolutionScatter: list(raw.resolutionScatter),
  }
}

function exportStats(data: SystemStats) {
  const rows = [['section', 'code', 'libelle', 'valeur']]
  const push = (section: string, points: StatsPoint[]) => {
    for (const point of points) rows.push([section, point.code, point.label, String(point.valeur)])
  }
  rows.push(['taux_actifs', 'ACTIFS', 'Comptes actifs', String(data.agentsActifs.actifs)])
  rows.push(['taux_actifs', 'TOTAL', 'Comptes total', String(data.agentsActifs.total)])
  rows.push(['taux_actifs', 'TAUX', 'Pourcentage actifs', String(data.agentsActifs.taux)])
  push('agents_departement', data.agentsParDepartement)
  push('agents_perimetre', data.agentsParPerimetre)
  push('tickets_statut', data.ticketsParStatut)
  push('anciennete', data.ancienneteComptes)
  push('tickets_jour', data.ticketsParJour)
  push('permissions_top', data.permissionsTop)
  push('funnel', data.ticketFunnel)
  for (const row of data.rolesParProjet.series) {
    for (const role of data.rolesParProjet.roles) {
      rows.push(['roles_projet', String(row.code ?? ''), `${row.label} · ${roleLabel(String(role))}`, String(row[role] ?? 0)])
    }
  }
  const csv = rows.map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\n')
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `statistiques-ma-${data.period.toLowerCase()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function median(values: number[]) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const fmtHours = (h: number) => (h >= 10 ? fmtNumber(h) : h.toLocaleString('fr-FR', { maximumFractionDigits: 1 }))

function shortDate(point: StatsPoint) {
  const iso = point.date ?? point.code
  const date = iso ? new Date(iso) : null
  if (!date || Number.isNaN(date.getTime())) return point.label
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

/** Rangée de deux ou trois graphiques. */
function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid gap-4', className)}>{children}</div>
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <SectionHeader title={title} subtitle={subtitle} />
      {children}
    </section>
  )
}

export function StatsGlobalesPage() {
  const { t, i18n } = useTranslation()
  const viz = useViz()
  const gid = useId().replace(/:/g, '')
  const [period, setPeriod] = useState<StatsPeriod>('30')
  const [radarRole, setRadarRole] = useState<string>('')
  const [heatHover, setHeatHover] = useState<{ jour: string; heure: number; valeur: number } | null>(null)

  const query = useQuery({
    queryKey: ['system-stats', period],
    queryFn: () => fetchSystemStats(period),
    refetchInterval: 20_000,
  })

  const data = useMemo(() => normalize(query.data, period), [query.data, period])
  const error = query.error instanceof ApiError ? query.error.message : query.error ? t('stats.loadError') : null

  const indigo = viz.series[0]
  const gold = viz.series[1]
  const track = tint(indigo, viz.dark ? 16 : 11, viz.surface)

  const derived = useMemo(() => {
    if (!data) return null
    const ticketsTotal = data.ticketsParJour.reduce((s, p) => s + num(p.valeur), 0)
    const hours = data.resolutionScatter.map((p) => num(p.heures))
    const logins = data.loginHeatmap.cells.reduce((s, c) => s + num(c.valeur), 0)
    const peak = data.loginHeatmap.cells.reduce<(typeof data.loginHeatmap.cells)[number] | null>(
      (best, c) => (!best || num(c.valeur) > num(best.valeur) ? c : best),
      null,
    )
    const medians = PRIORITIES.map((p) => ({
      ...p,
      median: median(data.resolutionScatter.filter((r) => r.priorite === p.code || r.x === p.x).map((r) => num(r.heures))),
      count: data.resolutionScatter.filter((r) => r.priorite === p.code || r.x === p.x).length,
    }))
    const categories = data.ticketsTreemap.map((node: StatsTreemapNode) => {
      const row: Record<string, string | number> = { label: node.name }
      for (const p of PRIORITIES) row[p.code] = 0
      for (const child of list(node.children)) {
        const code = child.priorite ?? ''
        row[code] = num(row[code]) + num(child.size)
      }
      if (!node.children?.length) row.NORMALE = num(node.size)
      return row
    })
    const usedRoles = data.rolesParProjet.roles.filter((role) => data.rolesParProjet.series.some((row) => num(row[role]) > 0))
    const roleMax = Math.max(1, ...data.rolesParProjet.series.flatMap((row) => usedRoles.map((role) => num(row[role]))))
    return { ticketsTotal, hours, logins, peak, medians, categories, usedRoles, roleMax }
  }, [data])

  const coverageRoles = data?.permissionCoverage.roles ?? []
  const selectedRadar = radarRole || coverageRoles[0]?.code || ''
  const coverageRows =
    coverageRoles
      .find((row) => row.code === selectedRadar)
      ?.modules.map((m) => ({
        key: m.code || m.label,
        label: m.label,
        value: num(m.pct ?? m.valeur),
        meta: m.total != null ? `${num(m.possedees)}/${num(m.total)}` : undefined,
      })) ?? []

  const ramp = (viz.dark ? [100, 74, 54, 38] : [100, 70, 46, 26]).map((p) => tint(indigo, p, viz.surface))
  const prioRamp: Record<string, string> = { CRITIQUE: ramp[0], ELEVEE: ramp[1], NORMALE: ramp[2], FAIBLE: ramp[3] }
  const periodLabel = t(`stats.period.${period}`)
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const updatedAt = data?.generatedAt ? new Date(data.generatedAt) : null

  return (
    <RequirePermission anyOf={['ADMIN_SYSTEME', 'DIRECTION']}>
      <div className="space-y-8">
        <PageHeader
          kicker={t('pages.stats.kicker')}
          title={sentence(t('pages.stats.title').toLowerCase())}
          subtitle={t('pages.stats.subtitle')}
          actions={
            <Button variant="outline" disabled={!data} onClick={() => data && exportStats(data)}>
              <Download className="h-4 w-4" />
              {t('stats.export')}
            </Button>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            ariaLabel={t('statsUi.period', 'Période')}
            options={PERIODS.map((item) => ({ value: item, label: t(`stats.period.${item}`) }))}
            value={period}
            onChange={setPeriod}
          />
          {updatedAt && !Number.isNaN(updatedAt.getTime()) && (
            <p className="inline-flex items-center gap-2 text-[12.5px] text-ink-3">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="ma-pulse absolute inline-flex h-full w-full rounded-full bg-status-success/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-status-success" />
              </span>
              {t('statsUi.updatedAt', 'Mis à jour à {{time}}', {
                time: updatedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
              })}
            </p>
          )}
        </div>

        {error && (
          <div className="space-y-2">
            <Feedback tone="danger">{error}</Feedback>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              <RotateCcw className="h-3.5 w-3.5" />
              {t('assistant.retry')}
            </Button>
          </div>
        )}

        {query.isLoading && (
          <div className="space-y-6" role="status" aria-label="Chargement">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[132px] rounded-[var(--radius-ma)]" />
              ))}
            </div>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[340px] rounded-[var(--radius-ma)]" />
              ))}
            </div>
          </div>
        )}

        {data && derived && (
          <>
            <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <StaggerItem className="min-w-0">
                <StatCard
                  label={t('stats.activeRate')}
                  value={data.agentsActifs.taux}
                  suffix="%"
                  accent="ok"
                  icon={<UserCheck />}
                  hint={t('statsUi.kpi.activeHint', '{{actifs}} sur {{total}} comptes', {
                    actifs: fmtNumber(data.agentsActifs.actifs),
                    total: fmtNumber(data.agentsActifs.total),
                  })}
                />
              </StaggerItem>
              <StaggerItem className="min-w-0">
                <StatCard
                  label={t('statsUi.kpi.tickets', 'Tickets créés')}
                  value={derived.ticketsTotal}
                  accent="info"
                  icon={<Ticket />}
                  hint={periodLabel}
                />
              </StaggerItem>
              <StaggerItem className="min-w-0">
                <StatCard
                  label={t('statsUi.kpi.resolution', 'Délai médian de résolution')}
                  value={median(derived.hours)}
                  format={fmtHours}
                  suffix="h"
                  accent="gold"
                  icon={<Timer />}
                  hint={t('statsUi.kpi.resolutionHint', 'Sur {{count}} tickets résolus', { count: derived.hours.length })}
                />
              </StaggerItem>
              <StaggerItem className="min-w-0">
                <StatCard
                  label={t('statsUi.kpi.logins', 'Connexions')}
                  value={derived.logins}
                  accent="warn"
                  icon={<LogIn />}
                  hint={
                    derived.peak && num(derived.peak.valeur) > 0
                      ? t('statsUi.kpi.loginsHint', 'Pic : {{day}} à {{hour}} h', {
                          day: String(derived.peak.jour ?? '').toLowerCase(),
                          hour: derived.peak.heure,
                        })
                      : periodLabel
                  }
                />
              </StaggerItem>
            </Stagger>

            <Section
              title={t('stats.agentsAccess')}
              subtitle={t('statsUi.sections.agents', 'Effectifs, périmètres et ancienneté des comptes.')}
            >
              <Row className="lg:grid-cols-2 xl:grid-cols-3">
                <DashboardDonutChart
                  className="h-[400px]"
                  title={t('stats.byScope')}
                  subtitle={t('statsUi.sub.byScope', 'Niveau d’accès des agents')}
                  centerLabel={t('statsUi.agents', 'Agents')}
                  data={data.agentsParPerimetre.map((p) => ({ label: p.label, valeur: num(p.valeur), couleur: '' }))}
                />
                <ChartFrame
                  className="h-[400px]"
                  title={t('stats.byDept')}
                  subtitle={t('statsUi.sub.byDept', 'Agents actifs')}
                  empty={data.agentsParDepartement.every((row) => num(row.valeur) === 0)}
                  emptyMessage={t('stats.empty')}
                  summary={
                    <ChartSummary
                      label={t('statsUi.total', 'Total')}
                      value={fmtNumber(data.agentsParDepartement.reduce((s, r) => s + num(r.valeur), 0))}
                    />
                  }
                >
                  <HBarList
                    color={indigo}
                    track={track}
                    rows={[...data.agentsParDepartement]
                      .sort((a, b) => num(b.valeur) - num(a.valeur))
                      .map((r) => ({ key: r.code || r.label, label: r.label, value: num(r.valeur) }))}
                  />
                </ChartFrame>
                <DashboardHistogram
                  className="h-[400px] lg:col-span-2 xl:col-span-1"
                  title={t('stats.seniority')}
                  subtitle={t('statsUi.sub.seniority', 'Comptes par ancienneté')}
                  emptyMessage={t('stats.empty')}
                  bins={data.ancienneteComptes.map((p) => ({ tranche: p.label, occurrences: num(p.valeur) }))}
                />
              </Row>

              <TableCard
                toolbar={
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">{t('stats.rolesByCompany')}</h2>
                      <p className="mt-0.5 text-[12.5px] text-ink-3">
                        {t('statsUi.sub.roles', 'Nombre d’agents par rôle dans chaque société')}
                      </p>
                    </div>
                    {derived.usedRoles.length > 0 && (
                      <p className="inline-flex items-center gap-2 text-[12px] text-ink-3">
                        <span>{t('statsUi.less', 'Moins')}</span>
                        <span className="flex gap-0.5" aria-hidden>
                          {[14, 30, 48, 66].map((p) => (
                            <span key={p} className="h-3 w-5 rounded-[4px]" style={{ background: tint(indigo, p, viz.surface) }} />
                          ))}
                        </span>
                        <span>{t('statsUi.more', 'Plus')}</span>
                      </p>
                    )}
                  </div>
                }
                empty={
                  data.rolesParProjet.series.length === 0 || derived.usedRoles.length === 0 ? (
                    <EmptyState icon={<Building2 />} title={t('stats.empty')} />
                  ) : undefined
                }
              >
                <Table minWidth={Math.max(560, 200 + derived.usedRoles.length * 112)}>
                  <THead>
                    <tr>
                      <Th>{t('statsUi.company', 'Société')}</Th>
                      {derived.usedRoles.map((role) => (
                        <Th key={role} align="right">
                          {roleLabel(role)}
                        </Th>
                      ))}
                      <Th align="right">{t('statsUi.total', 'Total')}</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {data.rolesParProjet.series.map((row) => {
                      const total = derived.usedRoles.reduce((s, role) => s + num(row[role]), 0)
                      return (
                        <Tr key={String(row.code ?? row.label)}>
                          <Td>
                            <span className="font-medium text-ink">{String(row.label ?? row.code ?? '–')}</span>
                          </Td>
                          {derived.usedRoles.map((role) => {
                            const v = num(row[role])
                            return (
                              <Td key={role} align="right" className="py-2">
                                {v > 0 ? (
                                  <span
                                    className="inline-flex h-7 min-w-9 items-center justify-center rounded-[8px] px-2 font-semibold tabular-nums text-ink"
                                    style={{ background: tint(indigo, 10 + (v / derived.roleMax) * 56, viz.surface) }}
                                  >
                                    {v}
                                  </span>
                                ) : (
                                  <span className="inline-flex h-7 min-w-9 items-center justify-center text-ink-3">–</span>
                                )}
                              </Td>
                            )
                          })}
                          <Td align="right" className="font-semibold tabular-nums">
                            {total}
                          </Td>
                        </Tr>
                      )
                    })}
                  </TBody>
                </Table>
              </TableCard>
            </Section>

            <Section
              title={t('stats.ticketsActivity')}
              subtitle={t('statsUi.sections.tickets', 'Volume, cycle de vie et délais de traitement.')}
            >
              <Row className="xl:grid-cols-3">
                <ChartFrame
                  className="h-[440px] xl:col-span-2"
                  title={t('stats.ticketTrend')}
                  subtitle={t('statsUi.sub.trend', 'Tickets créés par jour')}
                  empty={data.ticketsParJour.every((row) => num(row.valeur) === 0)}
                  emptyMessage={t('stats.empty')}
                  summary={<ChartSummary label={periodLabel} value={fmtNumber(derived.ticketsTotal)} />}
                >
                  <div className="min-h-0 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={data.ticketsParJour.map((p) => ({ ...p, valeur: num(p.valeur), jour: shortDate(p) }))}
                        margin={{ top: 12, right: 12, left: 4, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={indigo} stopOpacity={viz.dark ? 0.34 : 0.22} />
                            <stop offset="100%" stopColor={indigo} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke={viz.grid} vertical={false} />
                        <XAxis dataKey="jour" tick={axisTick(viz.axis)} axisLine={false} tickLine={false} minTickGap={28} dy={8} />
                        <YAxis allowDecimals={false} width={36} tick={axisTick(viz.axis)} axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ stroke: viz.axis, strokeOpacity: 0.35, strokeWidth: 1 }}
                          content={({ active, payload }) => {
                            const row = payload?.[0]?.payload as (StatsPoint & { jour: string }) | undefined
                            return (
                              <GlassTooltip
                                active={active}
                                title={row?.jour}
                                rows={[{ color: indigo, label: t('statsUi.created', 'Créés'), value: fmtNumber(num(row?.valeur)) }]}
                              />
                            )
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="valeur"
                          stroke={indigo}
                          strokeWidth={2.25}
                          fill={`url(#area-${gid})`}
                          dot={false}
                          activeDot={{ r: 5, fill: indigo, stroke: viz.surface, strokeWidth: 2 }}
                          animationDuration={900}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </ChartFrame>
                <DashboardDonutChart
                  className="h-[440px]"
                  title={t('stats.ticketStatus')}
                  subtitle={periodLabel}
                  centerLabel={t('statsUi.tickets', 'Tickets')}
                  data={data.ticketsParStatut.map((p) => ({ label: p.label, valeur: num(p.valeur), couleur: '' }))}
                />
              </Row>

              <Row className="lg:grid-cols-2 xl:grid-cols-3">
                <ChartFrame
                  className="h-[380px]"
                  title={t('stats.newVsTickets')}
                  subtitle={t('statsUi.sub.weekly', 'Par semaine, échelles séparées')}
                  empty={data.agentsVsTickets.every((row) => num(row.agents) === 0 && num(row.tickets) === 0)}
                  emptyMessage={t('stats.empty')}
                >
                  <div className="flex min-h-0 flex-1 flex-col gap-2">
                    {(
                      [
                        { key: 'tickets', label: t('statsUi.ticketsCreated', 'Tickets créés'), color: indigo, axis: false },
                        { key: 'agents', label: t('statsUi.newAgents', 'Nouveaux agents'), color: gold, axis: true },
                      ] as const
                    ).map((panel) => (
                      <div key={panel.key} className="flex min-h-0 flex-1 flex-col">
                        <div className="flex items-center justify-between px-2">
                          <Legend items={[{ color: panel.color, label: panel.label }]} />
                          <span className="text-[12.5px] font-semibold tabular-nums text-ink">
                            {fmtNumber(data.agentsVsTickets.reduce((s, w) => s + num(w[panel.key]), 0))}
                          </span>
                        </div>
                        <div className="min-h-0 flex-1">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.agentsVsTickets} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                              <CartesianGrid stroke={viz.grid} vertical={false} />
                              <XAxis
                                dataKey="label"
                                hide={!panel.axis}
                                tick={axisTick(viz.axis)}
                                axisLine={false}
                                tickLine={false}
                                dy={6}
                              />
                              <YAxis
                                allowDecimals={false}
                                width={32}
                                tickCount={3}
                                tick={axisTick(viz.axis)}
                                axisLine={false}
                                tickLine={false}
                              />
                              <Tooltip
                                cursor={{ fill: viz.dark ? 'rgba(255,255,255,0.035)' : 'rgba(17,27,63,0.035)', radius: 8 }}
                                content={({ active, payload }) => {
                                  const row = payload?.[0]?.payload as StatsWeekPoint | undefined
                                  return (
                                    <GlassTooltip
                                      active={active}
                                      title={row?.label}
                                      rows={[{ color: panel.color, label: panel.label, value: fmtNumber(num(row?.[panel.key])) }]}
                                    />
                                  )
                                }}
                              />
                              <Bar dataKey={panel.key} fill={panel.color} radius={[6, 6, 3, 3]} maxBarSize={26} animationDuration={900} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                </ChartFrame>

                <ChartFrame
                  className="h-[380px]"
                  title={t('stats.ticketCatPrio')}
                  subtitle={t('statsUi.sub.catPrio', 'Empilé par priorité')}
                  empty={derived.categories.length === 0}
                  emptyMessage={t('stats.empty')}
                >
                  <Legend
                    className="px-2 pb-1"
                    items={[...PRIORITIES].reverse().map((p) => ({ color: prioRamp[p.code], label: p.label }))}
                  />
                  <div className="min-h-0 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={derived.categories}
                        margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
                        barCategoryGap="26%"
                      >
                        <CartesianGrid stroke={viz.grid} horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={axisTick(viz.axis)} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="label" width={92} tick={axisTick(viz.axis)} axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ fill: viz.dark ? 'rgba(255,255,255,0.035)' : 'rgba(17,27,63,0.035)', radius: 8 }}
                          content={({ active, payload }) => {
                            const row = payload?.[0]?.payload as Record<string, string | number> | undefined
                            return (
                              <GlassTooltip
                                active={active}
                                title={row?.label}
                                rows={[...PRIORITIES]
                                  .reverse()
                                  .map((p) => ({ color: prioRamp[p.code], label: p.label, value: fmtNumber(num(row?.[p.code])) }))}
                              />
                            )
                          }}
                        />
                        {[...PRIORITIES].reverse().map((p, i, all) => (
                          <Bar
                            key={p.code}
                            dataKey={p.code}
                            stackId="prio"
                            fill={prioRamp[p.code]}
                            stroke={viz.surface}
                            strokeWidth={1.5}
                            radius={i === all.length - 1 ? [0, 6, 6, 0] : 0}
                            animationDuration={900}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartFrame>

                <ChartFrame
                  className="h-[380px] lg:col-span-2 xl:col-span-1"
                  title={t('stats.funnel')}
                  subtitle={t('statsUi.sub.funnel', 'Part restante à chaque étape')}
                  empty={data.ticketFunnel.every((row) => num(row.valeur) === 0)}
                  emptyMessage={t('stats.empty')}
                >
                  <HBarList
                    color={indigo}
                    track={track}
                    stacked
                    max={Math.max(1, num(data.ticketFunnel[0]?.valeur))}
                    rows={data.ticketFunnel.map((r) => {
                      const first = Math.max(1, num(data.ticketFunnel[0]?.valeur))
                      return {
                        key: r.code || r.label,
                        label: r.label,
                        value: num(r.valeur),
                        meta: `${Math.round((num(r.valeur) / first) * 100)} %`,
                      }
                    })}
                  />
                </ChartFrame>
              </Row>

              <Row className="xl:grid-cols-3">
                <ChartFrame
                  className="h-[400px]"
                  title={t('stats.resolution')}
                  subtitle={t('statsUi.sub.resolution', 'Un point par ticket, trait : médiane')}
                  empty={data.resolutionScatter.length === 0}
                  emptyMessage={t('stats.empty')}
                  summary={<ChartSummary label={t('statsUi.median', 'Médiane')} value={`${fmtHours(median(derived.hours))} h`} />}
                >
                  <div className="min-h-0 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
                        <CartesianGrid stroke={viz.grid} vertical={false} />
                        <XAxis
                          type="number"
                          dataKey="px"
                          domain={[0.5, 4.5]}
                          ticks={PRIORITIES.map((p) => p.x)}
                          tickFormatter={(v: number) => PRIORITIES.find((p) => p.x === v)?.label ?? ''}
                          tick={axisTick(viz.axis)}
                          axisLine={false}
                          tickLine={false}
                          dy={8}
                        />
                        <YAxis
                          type="number"
                          dataKey="heures"
                          width={44}
                          tick={axisTick(viz.axis)}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: number) => `${v} h`}
                        />
                        <ZAxis range={[46, 46]} />
                        <Tooltip
                          cursor={false}
                          content={({ active, payload }) => {
                            const row = payload?.[0]?.payload as StatsScatterPoint | undefined
                            return (
                              <GlassTooltip
                                active={active}
                                title={row?.reference}
                                rows={[{ color: indigo, label: row?.prioriteLabel ?? '', value: `${fmtHours(num(row?.heures))} h` }]}
                              />
                            )
                          }}
                        />
                        <Scatter
                          data={data.resolutionScatter.map((r) => ({ ...r, px: num(r.x) + (((num(r.id) * 37) % 100) / 100 - 0.5) * 0.46 }))}
                          fill={indigo}
                          fillOpacity={0.62}
                          stroke={viz.surface}
                          strokeWidth={1.5}
                          animationDuration={700}
                        />
                        {derived.medians
                          .filter((m) => m.count > 0)
                          .map((m) => (
                            <ReferenceLine
                              key={m.code}
                              segment={[
                                { x: m.x - 0.32, y: m.median },
                                { x: m.x + 0.32, y: m.median },
                              ]}
                              stroke={viz.ink}
                              strokeWidth={2.5}
                              strokeLinecap="round"
                              ifOverflow="extendDomain"
                            />
                          ))}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </ChartFrame>

                <ChartFrame
                  className="min-h-[400px] xl:col-span-2"
                  title={t('stats.heatmap')}
                  subtitle={t('statsUi.sub.heatmap', 'Connexions journalisées par jour et par heure')}
                  empty={data.loginHeatmap.max === 0 || data.loginHeatmap.jours.length === 0}
                  emptyMessage={t('stats.empty')}
                  summary={
                    heatHover ? (
                      <ChartSummary
                        label={`${heatHover.jour} · ${String(heatHover.heure).padStart(2, '0')} h`}
                        value={fmtNumber(heatHover.valeur)}
                      />
                    ) : (
                      <ChartSummary label={t('statsUi.total', 'Total')} value={fmtNumber(derived.logins)} />
                    )
                  }
                >
                  <div className="ma-scroll flex-1 overflow-x-auto px-2 pb-1">
                    <div className="min-w-[620px]" onMouseLeave={() => setHeatHover(null)}>
                      <div className="mb-1 grid grid-cols-[48px_repeat(24,minmax(0,1fr))] gap-[3px] text-[11px] tabular-nums text-ink-3">
                        <span />
                        {Array.from({ length: 24 }, (_, h) => (
                          <span key={h} className="text-center">
                            {h % 3 === 0 ? h : ''}
                          </span>
                        ))}
                      </div>
                      {data.loginHeatmap.jours.map((jour, d) => (
                        <div key={jour} className="mb-[3px] grid grid-cols-[48px_repeat(24,minmax(0,1fr))] gap-[3px]">
                          <span className="flex items-center text-[12px] font-medium text-ink-3">{jour.slice(0, 3)}</span>
                          {Array.from({ length: 24 }, (_, h) => {
                            const cellData = data.loginHeatmap.cells.find((c) => num(c.jourIndex) === d + 1 && num(c.heure) === h)
                            const valeur = num(cellData?.valeur)
                            const ratio = data.loginHeatmap.max ? valeur / data.loginHeatmap.max : 0
                            const active = heatHover?.jour === jour && heatHover.heure === h
                            return (
                              <div
                                key={`${jour}-${h}`}
                                title={`${jour} ${String(h).padStart(2, '0')} h : ${valeur}`}
                                onMouseEnter={() => setHeatHover({ jour, heure: h, valeur })}
                                className={cn(
                                  'aspect-square max-h-7 w-full rounded-[5px] transition-[transform,box-shadow] duration-150',
                                  valeur <= 0 && 'bg-ink/[0.045] dark:bg-white/[0.05]',
                                  active && 'z-10 scale-[1.18] [box-shadow:0_0_0_2px_var(--ma-surface),0_0_0_3.5px_var(--ma-accent)]',
                                )}
                                style={valeur > 0 ? { background: tint(indigo, 14 + ratio * 86, viz.surface) } : undefined}
                              />
                            )
                          })}
                        </div>
                      ))}
                      <div className="mt-3 flex items-center justify-end gap-2 text-[12px] text-ink-3">
                        <span>{t('statsUi.less', 'Moins')}</span>
                        <span className="flex gap-[3px]" aria-hidden>
                          {[14, 36, 58, 80, 100].map((p) => (
                            <span key={p} className="h-3 w-3 rounded-[3px]" style={{ background: tint(indigo, p, viz.surface) }} />
                          ))}
                        </span>
                        <span>{t('statsUi.more', 'Plus')}</span>
                      </div>
                    </div>
                  </div>
                </ChartFrame>
              </Row>
            </Section>

            <Section
              title={t('stats.permissions')}
              subtitle={t('statsUi.sections.permissions', 'Diffusion des permissions et couverture des modules par rôle.')}
            >
              <Row className="lg:grid-cols-2">
                <ChartFrame
                  className="min-h-[380px]"
                  title={t('stats.permTop')}
                  subtitle={t('statsUi.sub.permTop', 'Nombre de rôles qui détiennent la permission')}
                  empty={data.permissionsTop.every((row) => num(row.valeur) === 0)}
                  emptyMessage={t('stats.empty')}
                >
                  <HBarList
                    color={indigo}
                    track={track}
                    labelWidth="w-[46%]"
                    rows={data.permissionsTop.map((r) => ({
                      key: r.code,
                      label: permissionLabel(r.code) || r.label,
                      value: num(r.valeur),
                    }))}
                  />
                </ChartFrame>
                <ChartFrame
                  className="min-h-[380px]"
                  title={t('stats.coverage')}
                  subtitle={t('statsUi.sub.coverage', 'Part des permissions du module détenues')}
                  empty={coverageRows.length === 0}
                  emptyMessage={t('stats.empty')}
                >
                  {coverageRoles.length > 0 && (
                    <div className="px-2 pb-1">
                      <FilterSelect
                        aria-label={t('statsUi.role', 'Rôle')}
                        className="h-9 max-w-full text-[13px]"
                        value={selectedRadar}
                        onChange={(e) => setRadarRole(e.target.value)}
                      >
                        {coverageRoles.map((role) => (
                          <option key={role.code} value={role.code}>
                            {roleLabel(role.code)}
                          </option>
                        ))}
                      </FilterSelect>
                    </div>
                  )}
                  <HBarList color={indigo} track={track} max={100} stacked format={(n) => `${Math.round(n)} %`} rows={coverageRows} />
                </ChartFrame>
              </Row>
            </Section>
          </>
        )}

        {!query.isLoading && !error && !data && <EmptyState icon={<Ticket />} title={t('stats.empty')} />}
      </div>
    </RequirePermission>
  )
}
