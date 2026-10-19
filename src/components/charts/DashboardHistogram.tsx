import { useId, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame, GlassTooltip, axisTick, fmtNumber, useViz } from './chart-kit'

export type HistogramBin = { tranche: string; occurrences: number }

/** Histogramme : barres indigo, la classe la plus fréquente en or avec son libellé. */
export function DashboardHistogram({
  bins,
  title,
  subtitle,
  highlightMax = true,
  loading,
  synthesis,
  zeroAsData = false,
  emptyMessage = 'Aucune donnée disponible pour cette période',
  unavailableMessage,
  className,
}: {
  bins: HistogramBin[]
  title: string
  subtitle?: string
  highlightMax?: boolean
  loading?: boolean
  synthesis?: string | null
  zeroAsData?: boolean
  emptyMessage?: string
  unavailableMessage?: string | null
  className?: string
}) {
  const viz = useViz()
  const gid = useId().replace(/:/g, '')
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(0, ...bins.map((b) => b.occurrences))
  const empty = !loading && !unavailableMessage && max === 0 && !zeroAsData
  const total = bins.reduce((s, b) => s + b.occurrences, 0)
  const indigo = viz.series[0]
  const gold = viz.series[1]

  return (
    <ChartFrame
      className={className}
      title={title}
      subtitle={subtitle}
      loading={loading}
      empty={empty || Boolean(unavailableMessage)}
      emptyMessage={unavailableMessage || emptyMessage}
      footnote={!unavailableMessage && (zeroAsData || !empty) ? synthesis : null}
    >
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={bins}
            margin={{ top: 24, right: 12, left: 4, bottom: 0 }}
            onMouseMove={(state) => setHover(typeof state?.activeTooltipIndex === 'number' ? state.activeTooltipIndex : null)}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={`h-indigo-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={indigo} />
                <stop offset="100%" stopColor={indigo} stopOpacity={0.7} />
              </linearGradient>
              <linearGradient id={`h-gold-${gid}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gold} />
                <stop offset="100%" stopColor={gold} stopOpacity={0.72} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={viz.grid} vertical={false} />
            <XAxis dataKey="tranche" tick={axisTick(viz.axis)} axisLine={false} tickLine={false} dy={8} interval={0} />
            <YAxis tick={axisTick(viz.axis)} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
            <Tooltip
              cursor={{ fill: viz.dark ? 'rgba(255,255,255,0.035)' : 'rgba(17,27,63,0.035)', radius: 10 }}
              content={({ active, payload }) => {
                const bin = payload?.[0]?.payload as HistogramBin | undefined
                const share = bin && total ? Math.round((bin.occurrences / total) * 100) : 0
                return (
                  <GlassTooltip
                    active={active}
                    title={bin?.tranche}
                    rows={[
                      { color: bin?.occurrences === max && highlightMax ? gold : indigo, label: 'Occurrences', value: fmtNumber(bin?.occurrences ?? 0) },
                      { label: 'Part', value: `${share} %` },
                    ]}
                  />
                )
              }}
            />
            <Bar dataKey="occurrences" radius={[8, 8, 4, 4]} maxBarSize={56} animationDuration={900}>
              {bins.map((bin, i) => {
                const top = highlightMax && bin.occurrences === max && max > 0
                return (
                  <Cell
                    key={bin.tranche}
                    fill={top ? `url(#h-gold-${gid})` : `url(#h-indigo-${gid})`}
                    fillOpacity={hover === null || hover === i ? 1 : 0.4}
                    style={{ transition: 'fill-opacity 220ms ease' }}
                  />
                )
              })}
              <LabelList
                dataKey="occurrences"
                position="top"
                offset={8}
                content={(props) => {
                  const { x, y, width, value } = props as { x: number; y: number; width: number; value: number }
                  if (!highlightMax || value !== max || max === 0) return null
                  return (
                    <text x={x + width / 2} y={y - 8} textAnchor="middle" fill={viz.ink} fontSize={12} fontWeight={600}>
                      {fmtNumber(value)}
                    </text>
                  )
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}
