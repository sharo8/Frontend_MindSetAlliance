import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Funnel,
  FunnelChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '../../components/ui/button'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { Modal } from '../../components/ui/modal'
import { PageHeader } from '../../components/ui/page-header'
import { Skeleton } from '../../components/ui/skeleton'
import { ApiError } from '../../lib/api/client'
import {
  fetchSystemStats,
  type StatsHeatCell,
  type StatsPeriod,
  type StatsPoint,
  type StatsScatterPoint,
  type SystemStats,
} from '../../lib/api/stats'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { permissionLabel, roleLabel } from '../../lib/rbac/rbac'
import { useThemeStore } from '../../lib/theme/theme-store'
import { cn } from '../../lib/utils'

const PERIODS: StatsPeriod[] = ['7', '30', '90', 'ALL']

const NAVY = '#16215c'
const GOLD = '#c49214'
const GOLD_SOFT = '#f6d06a'

const ROLE_HEX: Record<string, string> = {
  FINANCE: '#0f766e',
  MARKETING: '#7c3aed',
  SUPPORT: '#d97706',
  DEV: '#2563eb',
  RH: '#16a34a',
  COMMERCIAL: '#c49214',
  DIRECTION: '#16215c',
  CONSEIL_ADMINISTRATION: '#1e3a8a',
  JURIDIQUE: '#64748b',
  ADMIN_SYSTEME: '#dc2626',
}

const PERIMETER_HEX: Record<string, string> = {
  ENTREPRISE: NAVY,
  PROJET: GOLD,
  AUTRE: '#94a3b8',
}

const TICKET_HEX: Record<string, string> = {
  OUVERT: '#2563eb',
  EN_COURS: '#d97706',
  EN_ATTENTE: '#eab308',
  RESOLU: '#16a34a',
  CLOTURE: '#0f766e',
  ANNULE: '#dc2626',
}

const PRIORITY_HEX: Record<string, string> = {
  CRITIQUE: '#dc2626',
  ELEVEE: '#d97706',
  NORMALE: '#2563eb',
  FAIBLE: '#64748b',
}

const FUNNEL_HEX = [NAVY, '#1e3a8a', GOLD, '#16a34a', '#0f766e']
const DEPT_PALETTE = [NAVY, GOLD, '#2563eb', '#16a34a', '#7c3aed', '#0f766e', '#d97706', '#dc2626', '#64748b', GOLD_SOFT]
const SENIORITY_PALETTE = [GOLD_SOFT, GOLD, NAVY, '#64748b']
const PRIORITY_TICKS = [
  { v: 1, label: 'Faible' },
  { v: 2, label: 'Normale' },
  { v: 3, label: 'Élevée' },
  { v: 4, label: 'Critique' },
]

function roleColor(role: string, index = 0) {
  return ROLE_HEX[role] ?? DEPT_PALETTE[index % DEPT_PALETTE.length]
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function heatColor(value: number, max: number, dark: boolean) {
  if (!max || value <= 0) return dark ? 'rgba(255,255,255,0.06)' : '#eef2f7'
  const t = Math.min(1, value / max)
  const r = Math.round(22 + (196 - 22) * t)
  const g = Math.round(33 + (146 - 33) * t)
  const b = Math.round(92 + (20 - 92) * t)
  return `rgb(${r} ${g} ${b})`
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
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `statistiques-ma-${data.period.toLowerCase()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function HoverTip({
  active,
  payload,
  title,
  unit,
  nameFn,
  colorFn,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }>
  title?: string
  unit: string
  nameFn?: (name: string, row?: Record<string, unknown>) => string
  colorFn?: (name: string) => string | undefined
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const name = String(item.name ?? item.dataKey ?? '')
  const row = item.payload ?? {}
  const header = title ?? String(row.date ?? row.semaine ?? row.label ?? '')
  const color = item.color ?? colorFn?.(name)
  const displayName = nameFn?.(name, row) ?? name
  return (
    <div className="max-w-[240px] rounded-xl border border-ma-gold-500/45 bg-white px-3 py-2 text-sm shadow-[0_12px_28px_rgba(15,23,42,0.16)] dark:bg-ma-navy-800 dark:text-ma-white">
      {header && header !== displayName ? (
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-gold-600 dark:text-ma-gold-400">{header}</p>
      ) : null}
      <p className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color ?? GOLD }} />
        <span>
          {displayName} : {item.value} {unit}
        </span>
      </p>
    </div>
  )
}

const tipBox = {
  allowEscapeViewBox: { x: true, y: true } as const,
  wrapperStyle: { zIndex: 40, pointerEvents: 'none' as const, outline: 'none' },
}

function ChartCard({
  title,
  delay,
  extra,
  footer,
  bodyClassName,
  children,
}: {
  title: string
  delay: number
  extra?: ReactNode
  footer?: ReactNode
  bodyClassName?: string
  children: ReactNode
}) {
  return (
    <Card className="ma-enter min-w-0 overflow-visible" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ma-navy-800 dark:text-ma-gold-400">{title}</h2>
        {extra}
      </CardHeader>
      <CardBody className={cn('overflow-visible', bodyClassName ?? 'h-[300px]')}>{children}</CardBody>
      {footer}
    </Card>
  )
}

function EmptyState() {
  const { t } = useTranslation()
  return (
    <p className="flex h-full items-center justify-center text-sm text-ma-muted dark:text-ma-gray-300">
      {t('stats.empty')}
    </p>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ma-gold-600 dark:text-ma-gold-400">{title}</h2>
      <div className="grid gap-4 lg:grid-cols-2">{children}</div>
    </section>
  )
}

function TreemapLeaf(props: {
  x?: number
  y?: number
  width?: number
  height?: number
  name?: string
  depth?: number
  priorite?: string
}) {
  const { x = 0, y = 0, width = 0, height = 0, name, depth, priorite } = props
  if (width < 2 || height < 2) return null
  const fill = depth === 1 ? NAVY : PRIORITY_HEX[priorite ?? ''] ?? GOLD
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} stroke="#fff" strokeWidth={1.5} rx={4} />
      {width > 56 && height > 22 && (
        <text x={x + 8} y={y + 16} fill="#fff" fontSize={11}>
          {name}
        </text>
      )}
    </g>
  )
}

export function StatsGlobalesPage() {
  const { t, i18n } = useTranslation()
  const [period, setPeriod] = useState<StatsPeriod>('30')
  const [radarRole, setRadarRole] = useState<string>('')
  const [detailOpen, setDetailOpen] = useState(false)
  const theme = useThemeStore((s) => s.theme)
  const dark = theme === 'dark'
  const animate = !prefersReducedMotion()
  const axis = dark ? '#94a3b8' : '#64748b'
  const grid = dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'

  const query = useQuery({
    queryKey: ['system-stats', period],
    queryFn: () => fetchSystemStats(period),
    refetchInterval: 20_000,
  })

  const data = query.data
  const stacked = useMemo(() => data?.rolesParProjet.series ?? [], [data])
  const stackedRoles = data?.rolesParProjet.roles ?? []
  const coverageRoles = data?.permissionCoverage.roles ?? []
  const selectedRadar = radarRole || coverageRoles[0]?.code || ''
  const radarData = coverageRoles.find((row) => row.code === selectedRadar)?.modules.map((m) => ({
    module: m.label,
    pct: m.pct ?? m.valeur,
    possedees: m.possedees,
    total: m.total,
  })) ?? []
  const error = query.error instanceof ApiError ? query.error.message : query.error ? t('stats.loadError') : null

  return (
    <RequirePermission anyOf={['ADMIN_SYSTEME', 'DIRECTION']}>
      <div className="space-y-8">
        <PageHeader
          kicker={t('pages.stats.kicker')}
          title={t('pages.stats.title')}
          subtitle={t('pages.stats.subtitle')}
          actions={
            <Button variant="outline" disabled={!data} onClick={() => data && exportStats(data)}>
              <Download size={15} />
              {t('stats.export')}
            </Button>
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPeriod(item)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition',
                period === item
                  ? 'bg-ma-navy-800 text-ma-gold-300 ring-ma-navy-800 dark:bg-ma-gold-400 dark:text-ma-navy-950 dark:ring-ma-gold-400'
                  : 'bg-white text-ma-navy-800 ring-ma-line hover:bg-slate-50 dark:bg-ma-navy-800 dark:text-ma-gray-200 dark:ring-white/10 dark:hover:bg-white/5',
              )}
            >
              {t(`stats.period.${item}`)}
            </button>
          ))}
          {data?.generatedAt && (
            <p className="ml-auto text-xs text-ma-muted dark:text-ma-gray-300">
              {new Date(data.generatedAt).toLocaleTimeString(i18n.language === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {error && <Feedback tone="danger">{error}</Feedback>}
        {query.isLoading && (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[360px] w-full rounded-[14px]" />
            ))}
          </div>
        )}

        {data && (
          <>
            <Section title={t('stats.agentsAccess')}>
              <ChartCard title={t('stats.activeRate')} delay={0}>
                <div className="relative h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Actifs', value: data.agentsActifs.actifs },
                          { name: 'Suspendus', value: Math.max(0, data.agentsActifs.total - data.agentsActifs.actifs) },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={78}
                        outerRadius={104}
                        startAngle={90}
                        endAngle={-270}
                        paddingAngle={2}
                        isAnimationActive={animate}
                      >
                        <Cell fill={GOLD} />
                        <Cell fill={dark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'} />
                      </Pie>
                      <Tooltip {...tipBox} content={<HoverTip unit="compte(s)" />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="font-display text-3xl text-ma-navy-900 dark:text-ma-gold-400">{data.agentsActifs.taux}%</p>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-ma-muted dark:text-ma-gray-300">
                      {data.agentsActifs.actifs}/{data.agentsActifs.total} actifs
                    </p>
                  </div>
                </div>
              </ChartCard>

              <ChartCard title={t('stats.byScope')} delay={80}>
                {data.agentsParPerimetre.every((row) => row.valeur === 0) ? <EmptyState /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.agentsParPerimetre} dataKey="valeur" nameKey="label" cx="50%" cy="46%" outerRadius={90} isAnimationActive={animate}>
                        {data.agentsParPerimetre.map((slice) => (
                          <Cell key={slice.code} fill={PERIMETER_HEX[slice.code] ?? GOLD} />
                        ))}
                      </Pie>
                      <Tooltip {...tipBox} content={<HoverTip unit="agent(s)" />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title={t('stats.byDept')} delay={160}>
                {data.agentsParDepartement.every((row) => row.valeur === 0) ? <EmptyState /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.agentsParDepartement} margin={{ top: 8, right: 8, left: 0, bottom: 56 }}>
                      <CartesianGrid stroke={grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: axis, fontSize: 10 }} interval={0} angle={-28} textAnchor="end" height={70} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip {...tipBox} shared={false} content={<HoverTip unit="agent(s)" title="Département" nameFn={() => 'Actifs'} />} />
                      <Bar dataKey="valeur" name="Actifs" radius={[6, 6, 2, 2]} maxBarSize={36} isAnimationActive={animate}>
                        {data.agentsParDepartement.map((row, i) => (
                          <Cell key={row.code} fill={DEPT_PALETTE[i % DEPT_PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title={t('stats.seniority')} delay={240}>
                {data.ancienneteComptes.every((row) => row.valeur === 0) ? <EmptyState /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.ancienneteComptes} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid stroke={grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip {...tipBox} shared={false} content={<HoverTip unit="compte(s)" />} />
                      <Bar dataKey="valeur" name="Agents" radius={[6, 6, 2, 2]} maxBarSize={48} isAnimationActive={animate}>
                        {data.ancienneteComptes.map((row, i) => (
                          <Cell key={row.code} fill={SENIORITY_PALETTE[i % SENIORITY_PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard
                title={t('stats.rolesByCompany')}
                delay={320}
                footer={(
                  <div className="border-t border-ma-line/80 px-5 py-3 dark:border-white/10">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => setDetailOpen(true)}>
                      Voir le détail
                    </Button>
                  </div>
                )}
              >
                {stacked.length === 0 ? <EmptyState /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stacked} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
                      <CartesianGrid stroke={grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        {...tipBox}
                        shared={false}
                        content={
                          <HoverTip
                            unit="agent(s)"
                            nameFn={(name) => roleLabel(name)}
                            colorFn={(name) => roleColor(name)}
                          />
                        }
                      />
                      <Legend formatter={(value) => roleLabel(String(value))} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      {stackedRoles.map((role, i) => (
                        <Bar key={role} dataKey={role} name={role} stackId="roles" fill={roleColor(role, i)} maxBarSize={48} isAnimationActive={animate} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title={t('stats.newVsTickets')} delay={400}>
                {data.agentsVsTickets.every((row) => row.agents === 0 && row.tickets === 0) ? <EmptyState /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.agentsVsTickets} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid stroke={grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: axis, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        {...tipBox}
                        shared={false}
                        content={
                          <HoverTip
                            unit=""
                            title="Semaine"
                            nameFn={(name) => (name === 'agents' ? 'Nouveaux agents' : 'Tickets créés')}
                          />
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="agents" name="Nouveaux agents" fill={NAVY} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={animate} />
                      <Line dataKey="tickets" name="Tickets créés" type="monotone" stroke={GOLD} strokeWidth={2.2} dot={{ r: 3, fill: GOLD }} isAnimationActive={animate} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </Section>

            <Section title={t('stats.ticketsActivity')}>
              <ChartCard title={t('stats.ticketStatus')} delay={0}>
                {data.ticketsParStatut.every((row) => row.valeur === 0) ? <EmptyState /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.ticketsParStatut} dataKey="valeur" nameKey="label" innerRadius={58} outerRadius={84} paddingAngle={2} isAnimationActive={animate}>
                        {data.ticketsParStatut.map((slice) => (
                          <Cell key={slice.code} fill={TICKET_HEX[slice.code] ?? GOLD} />
                        ))}
                      </Pie>
                      <Tooltip {...tipBox} content={<HoverTip unit="ticket(s)" />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title={t('stats.ticketTrend')} delay={80}>
                {data.ticketsParJour.every((row) => row.valeur === 0) ? <EmptyState /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.ticketsParJour} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid stroke={grid} vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: axis, fontSize: 10 }} minTickGap={16} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        {...tipBox}
                        shared={false}
                        content={<HoverTip unit="ticket(s)" nameFn={() => 'Créés'} />}
                      />
                      <Line type="monotone" dataKey="valeur" name="Créés" stroke={GOLD} strokeWidth={2.4} dot={{ r: 2.5, fill: NAVY, stroke: GOLD }} isAnimationActive={animate} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title={t('stats.ticketCatPrio')} delay={160}>
                {data.ticketsTreemap.length === 0 ? <EmptyState /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap data={data.ticketsTreemap} dataKey="size" nameKey="name" stroke="#fff" isAnimationActive={animate} content={<TreemapLeaf />}>
                      <Tooltip
                        {...tipBox}
                        content={<HoverTip unit="ticket(s)" nameFn={(name) => name} />}
                      />
                    </Treemap>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title={t('stats.funnel')} delay={240}>
                {data.ticketFunnel.every((row) => row.valeur === 0) ? <EmptyState /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <FunnelChart>
                      <Tooltip {...tipBox} shared={false} content={<HoverTip unit="ticket(s)" />} />
                      <Funnel data={data.ticketFunnel} dataKey="valeur" nameKey="label" isAnimationActive={animate}>
                        {data.ticketFunnel.map((row, i) => (
                          <Cell key={row.code} fill={FUNNEL_HEX[i % FUNNEL_HEX.length]} />
                        ))}
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title={t('stats.resolution')} delay={320}>
                {data.resolutionScatter.length === 0 ? <EmptyState /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <CartesianGrid stroke={grid} />
                      <XAxis
                        type="number"
                        dataKey="x"
                        domain={[0.5, 4.5]}
                        ticks={PRIORITY_TICKS.map((t) => t.v)}
                        tickFormatter={(v) => PRIORITY_TICKS.find((t) => t.v === v)?.label ?? ''}
                        tick={{ fill: axis, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis type="number" dataKey="heures" name="Heures" tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        {...tipBox}
                        cursor={{ strokeDasharray: '3 3' }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const row = payload[0].payload as StatsScatterPoint
                          return (
                            <div className="max-w-[240px] rounded-xl border border-ma-gold-500/45 bg-white px-3 py-2 text-sm shadow-lg dark:bg-ma-navy-800 dark:text-ma-white">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-gold-600">{row.reference}</p>
                              <p className="mt-1 flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ background: PRIORITY_HEX[row.priorite] }} />
                                {row.prioriteLabel} : {row.heures} h
                              </p>
                            </div>
                          )
                        }}
                      />
                      <Scatter data={data.resolutionScatter} isAnimationActive={animate}>
                        {data.resolutionScatter.map((row) => (
                          <Cell key={row.id} fill={PRIORITY_HEX[row.priorite] ?? GOLD} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title={t('stats.heatmap')} delay={400} bodyClassName="min-h-[300px] overflow-x-auto">
                {data.loginHeatmap.max === 0 ? <EmptyState /> : (
                  <div className="min-w-[640px]">
                    <div className="mb-2 grid grid-cols-[72px_repeat(24,minmax(0,1fr))] gap-0.5 text-[9px] text-ma-muted">
                      <span />
                      {Array.from({ length: 24 }, (_, h) => (
                        <span key={h} className="text-center">{h}</span>
                      ))}
                    </div>
                    {data.loginHeatmap.jours.map((jour, d) => (
                      <div key={jour} className="mb-0.5 grid grid-cols-[72px_repeat(24,minmax(0,1fr))] gap-0.5">
                        <span className="truncate text-[11px] text-ma-muted dark:text-ma-gray-300">{jour.slice(0, 3)}</span>
                        {Array.from({ length: 24 }, (_, h) => {
                          const cell = data.loginHeatmap.cells.find((c: StatsHeatCell) => c.jourIndex === d + 1 && c.heure === h)
                          const valeur = cell?.valeur ?? 0
                          return (
                            <div
                              key={`${jour}-${h}`}
                              title={`${jour} ${String(h).padStart(2, '0')}h : ${valeur} connexion(s)`}
                              className="h-5 rounded-sm"
                              style={{ background: heatColor(valeur, data.loginHeatmap.max, dark) }}
                            />
                          )
                        })}
                      </div>
                    ))}
                    <p className="mt-2 text-[11px] text-ma-muted dark:text-ma-gray-300">Intensité = connexions journalisées (audit LOGIN). Survol d’une case pour le détail.</p>
                  </div>
                )}
              </ChartCard>
            </Section>

            <Section title={t('stats.permissions')}>
              <ChartCard title={t('stats.permTop')} delay={0}>
                {data.permissionsTop.every((row) => row.valeur === 0) ? <EmptyState /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={data.permissionsTop.map((row) => ({ ...row, label: permissionLabel(row.code) || row.label }))}
                      margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid stroke={grid} horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="label" width={148} tick={{ fill: axis, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip {...tipBox} shared={false} content={<HoverTip unit="rôle(s)" nameFn={() => 'Attribuée à'} />} />
                      <Bar dataKey="valeur" name="Rôles" fill={NAVY} radius={[0, 6, 6, 0]} maxBarSize={18} isAnimationActive={animate} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard
                title={t('stats.coverage')}
                delay={80}
                extra={(
                  <select
                    className="rounded-lg border border-ma-line bg-white px-2 py-1 text-sm dark:border-white/15 dark:bg-ma-navy-800"
                    value={selectedRadar}
                    onChange={(e) => setRadarRole(e.target.value)}
                  >
                    {coverageRoles.map((role) => (
                      <option key={role.code} value={role.code}>{roleLabel(role.code)}</option>
                    ))}
                  </select>
                )}
              >
                {radarData.length === 0 ? <EmptyState /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke={grid} />
                      <PolarAngleAxis dataKey="module" tick={{ fill: axis, fontSize: 10 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fill: axis, fontSize: 10 }} />
                      <Radar dataKey="pct" name={roleLabel(selectedRadar)} stroke={roleColor(selectedRadar)} fill={roleColor(selectedRadar)} fillOpacity={0.28} isAnimationActive={animate} />
                      <Tooltip
                        {...tipBox}
                        content={
                          <HoverTip
                            unit="%"
                            title={roleLabel(selectedRadar)}
                            nameFn={(_, row) => String(row?.module ?? 'Module')}
                          />
                        }
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </Section>
          </>
        )}

        <Modal
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          title={t('stats.rolesByCompany')}
          kicker="Détail"
          size="lg"
          footer={<Button variant="outline" onClick={() => setDetailOpen(false)}>Fermer</Button>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.14em] text-ma-muted">
                <tr>
                  <th className="px-2 py-2">Société</th>
                  {stackedRoles.map((role) => (
                    <th key={role} className="px-2 py-2">{roleLabel(role)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stacked.map((row) => (
                  <tr key={String(row.code)} className="border-t border-ma-line/70 dark:border-white/10">
                    <td className="px-2 py-2 font-medium">{String(row.label)}</td>
                    {stackedRoles.map((role) => (
                      <td key={role} className="px-2 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: roleColor(role) }} />
                          {row[role] ?? 0}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      </div>
    </RequirePermission>
  )
}
