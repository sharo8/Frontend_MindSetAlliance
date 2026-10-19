import { useId, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame, GlassTooltip, axisTick, fmtNumber, useViz } from '../../components/charts/chart-kit'
import { spring } from '../../components/motion/springs'
import { cn } from '../../lib/utils'

/** Graduations compactes : 1 200 → 1,2 k ; 2 400 000 → 2,4 M. */
export function compact(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`
  if (abs >= 1_000) return `${(n / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k`
  return String(Math.round(n))
}

/** Légende : pastille de couleur + libellé (le texte reste en couleur d'encre). */
export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-[12.5px] text-ink-2">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: item.color }} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

/** Barres groupées (2 à 3 séries), un seul axe Y, légende au-dessus. */
export function GroupedBarChart({
  title,
  subtitle,
  summary,
  data,
  xKey,
  series,
  format = fmtNumber,
  loading,
  className,
  height,
}: {
  title: string
  subtitle?: ReactNode
  summary?: ReactNode
  data: Record<string, string | number>[]
  xKey: string
  series: { key: string; label: string }[]
  format?: (n: number) => string
  loading?: boolean
  className?: string
  height?: number
}) {
  const viz = useViz()
  const empty = !loading && data.every((row) => series.every((s) => !Number(row[s.key] ?? 0)))
  const colors = series.map((_, i) => viz.series[i])
  return (
    <ChartFrame className={className} title={title} subtitle={subtitle} summary={summary} loading={loading} empty={empty}>
      {series.length > 1 && <ChartLegend items={series.map((s, i) => ({ label: s.label, color: colors[i] }))} />}
      <div className="mt-2 min-h-0 min-w-0 flex-1" style={height ? { height } : undefined}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={3} barCategoryGap="28%">
            <CartesianGrid stroke={viz.grid} vertical={false} />
            <XAxis dataKey={xKey} tick={axisTick(viz.axis)} axisLine={false} tickLine={false} dy={8} interval={0} />
            <YAxis width={48} tick={axisTick(viz.axis)} axisLine={false} tickLine={false} tickFormatter={(v: number) => compact(v)} />
            <Tooltip
              cursor={{ fill: viz.dark ? 'rgba(255,255,255,0.035)' : 'rgba(17,27,63,0.035)', radius: 10 }}
              content={({ active, payload, label }) => (
                <GlassTooltip
                  active={active}
                  title={String(label ?? '')}
                  rows={series.map((s, i) => ({
                    color: colors[i],
                    label: s.label,
                    value: format(Number((payload?.[0]?.payload as Record<string, number> | undefined)?.[s.key] ?? 0)),
                  }))}
                />
              )}
            />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={colors[i]} radius={[8, 8, 4, 4]} maxBarSize={24} animationDuration={800} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}

/** Tendance sur une série : ligne de 2 px, voile à 10 %, point final. */
export function TrendAreaChart({
  title,
  subtitle,
  summary,
  data,
  xKey,
  yKey,
  label,
  formatX = (v) => v,
  format = fmtNumber,
  loading,
  emptyMessage,
  footnote,
  className,
  height,
  color = 1,
}: {
  title: string
  subtitle?: ReactNode
  summary?: ReactNode
  data: Record<string, string | number>[]
  xKey: string
  yKey: string
  label: string
  formatX?: (v: string) => string
  format?: (n: number) => string
  loading?: boolean
  emptyMessage?: ReactNode
  footnote?: ReactNode
  className?: string
  height?: number
  color?: 1 | 2 | 3 | 4 | 5 | 6
}) {
  const viz = useViz()
  const gid = useId().replace(/:/g, '')
  const stroke = viz.series[color - 1]
  const empty = !loading && data.every((row) => !Number(row[yKey] ?? 0))
  return (
    <ChartFrame
      className={className}
      title={title}
      subtitle={subtitle}
      summary={summary}
      loading={loading}
      empty={empty}
      emptyMessage={emptyMessage}
      footnote={footnote}
    >
      <div className="min-h-0 min-w-0 flex-1" style={height ? { height } : undefined}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.16} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={viz.grid} vertical={false} />
            <XAxis
              dataKey={xKey}
              tick={axisTick(viz.axis)}
              axisLine={false}
              tickLine={false}
              dy={8}
              minTickGap={28}
              tickFormatter={(v: string) => formatX(String(v))}
            />
            <YAxis width={40} tick={axisTick(viz.axis)} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={(v: number) => compact(v)} />
            <Tooltip
              cursor={{ stroke: viz.axis, strokeOpacity: 0.35, strokeWidth: 1 }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as Record<string, string | number> | undefined
                return (
                  <GlassTooltip
                    active={active}
                    title={row ? formatX(String(row[xKey])) : ''}
                    rows={[{ color: stroke, label, value: format(Number(row?.[yKey] ?? 0)) }]}
                  />
                )
              }}
            />
            <Area
              type="monotone"
              dataKey={yKey}
              stroke={stroke}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={`url(#area-${gid})`}
              activeDot={{ r: 5, fill: stroke, stroke: viz.surface, strokeWidth: 2 }}
              dot={false}
              animationDuration={900}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}

/** Classement en barres horizontales : lisible sur téléphone, même avec de longs libellés. */
export function RankedBars({
  rows,
  format = fmtNumber,
  color = 1,
}: {
  rows: { label: string; value: number }[]
  format?: (n: number) => string
  color?: 1 | 2 | 3 | 4 | 5 | 6
}) {
  const viz = useViz()
  const reduce = useReducedMotion()
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...rows.map((r) => r.value))
  const fill = viz.series[color - 1]
  return (
    <ul className="space-y-1 px-2">
      {rows.map((row, i) => (
        <li
          key={row.label}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          className={cn('rounded-[12px] px-2 py-2 transition-colors duration-150', hover === i && 'bg-ink/[0.035] dark:bg-white/[0.04]')}
        >
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-ink-2">{row.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-ink">{format(row.value)}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink/[0.05] dark:bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full"
              style={{ background: fill, opacity: hover === null || hover === i ? 1 : 0.45 }}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${(row.value / max) * 100}%` }}
              transition={{ ...spring.page, delay: reduce ? 0 : i * 0.04 }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Ligne libellé / valeur dans une carte de synthèse. */
export function MetricRow({ label, value, hint, tone }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: 'danger' | 'warning' }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hairline py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[13.5px] text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-[12px] text-ink-3">{hint}</p>}
      </div>
      <p
        className={cn(
          'shrink-0 text-[17px] font-semibold tabular-nums tracking-[-0.02em]',
          tone === 'danger' ? 'text-status-danger' : tone === 'warning' ? 'text-status-warning' : 'text-ink',
        )}
      >
        {value}
      </p>
    </div>
  )
}

/** Garde au plus `max` parts : les plus petites sont regroupées dans « Autres » (pas de couleur recyclée). */
export function foldSlices<T extends { label: string; valeur: number }>(slices: T[], max = 6, otherLabel = 'Autres') {
  const sorted = [...slices].sort((a, b) => b.valeur - a.valeur)
  if (sorted.length <= max) return sorted.map((s) => ({ label: s.label, valeur: s.valeur, couleur: '' }))
  const head = sorted.slice(0, max - 1).map((s) => ({ label: s.label, valeur: s.valeur, couleur: '' }))
  const rest = sorted.slice(max - 1).reduce((sum, s) => sum + s.valeur, 0)
  return [...head, { label: otherLabel, valeur: rest, couleur: '' }]
}

/** Squelettes d'une rangée de chiffres clés. */
export function StatSkeletons({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="clay min-h-[132px] rounded-[var(--radius-ma)] p-5 ring-1 ring-hairline">
          <div className="ma-shimmer h-3.5 w-28 rounded-[10px]" />
          <div className="ma-shimmer mt-9 h-8 w-20 rounded-[10px]" />
        </div>
      ))}
    </div>
  )
}
