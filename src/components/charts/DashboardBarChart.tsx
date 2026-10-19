import { useId, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame, ChartSummary, GlassTooltip, axisTick, fmtNumber, useViz } from './chart-kit'

export type BarPoint = { [key: string]: string | number }

/** Barres verticales (une série) : dégradé, coins arrondis, la barre survolée ressort. */
export function DashboardBarChart({
  data,
  dataKey,
  xAxisKey,
  title,
  subtitle,
  loading,
  tooltipDateKey = 'date',
  unit,
  zeroAsData = false,
  footnote,
  emptyMessage = 'Aucune donnée disponible pour cette période',
  className,
  showTotal = true,
  color = 2,
}: {
  data: BarPoint[]
  dataKey: string
  xAxisKey: string
  title: string
  subtitle?: string
  loading?: boolean
  tooltipDateKey?: string
  unit?: string
  zeroAsData?: boolean
  footnote?: string | null
  emptyMessage?: string
  className?: string
  showTotal?: boolean
  /** Index de couleur de la palette (1 = indigo, 2 = or…). */
  color?: 1 | 2 | 3 | 4 | 5 | 6
}) {
  const viz = useViz()
  const gid = useId().replace(/:/g, '')
  const [hover, setHover] = useState<number | null>(null)
  const allZero = data.every((row) => Number(row[dataKey] ?? 0) === 0)
  const empty = !loading && allZero && !zeroAsData
  const total = data.reduce((s, row) => s + Number(row[dataKey] ?? 0), 0)
  const base = viz.series[color - 1]

  return (
    <ChartFrame
      className={className}
      title={title}
      subtitle={subtitle}
      loading={loading}
      empty={empty}
      emptyMessage={emptyMessage}
      footnote={footnote}
      summary={showTotal && !loading && !empty ? <ChartSummary label="Total" value={`${fmtNumber(total)}${unit ? ` ${unit}` : ''}`} /> : undefined}
    >
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 12, right: 12, left: 4, bottom: 0 }}
            onMouseMove={(state) => setHover(typeof state?.activeTooltipIndex === 'number' ? state.activeTooltipIndex : null)}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={`bar-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={base} stopOpacity={1} />
                <stop offset="100%" stopColor={base} stopOpacity={0.72} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={viz.grid} vertical={false} strokeDasharray="0" />
            <XAxis dataKey={xAxisKey} tick={axisTick(viz.axis)} axisLine={false} tickLine={false} dy={8} />
            <YAxis
              allowDecimals={false}
              width={40}
              tick={axisTick(viz.axis)}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))}
            />
            <Tooltip
              cursor={{ fill: viz.dark ? 'rgba(255,255,255,0.035)' : 'rgba(17,27,63,0.035)', radius: 10 }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as BarPoint | undefined
                return (
                  <GlassTooltip
                    active={active}
                    title={String(row?.[tooltipDateKey] ?? row?.[xAxisKey] ?? '')}
                    rows={[{ color: base, label: 'Valeur', value: `${fmtNumber(Number(row?.[dataKey] ?? 0))}${unit ? ` ${unit}` : ''}` }]}
                  />
                )
              }}
            />
            <Bar dataKey={dataKey} radius={[8, 8, 4, 4]} maxBarSize={44} animationDuration={900} animationEasing="ease-out">
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={`url(#bar-${gid})`}
                  fillOpacity={hover === null || hover === i ? 1 : 0.38}
                  style={{ transition: 'fill-opacity 220ms ease' }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}
