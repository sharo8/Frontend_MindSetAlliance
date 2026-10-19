import { useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { ChartFrame, fmtNumber, useViz } from './chart-kit'
import { cn } from '../../lib/utils'

export type DonutSlice = { label: string; valeur: number; couleur: string }

/**
 * Anneau : épais, segments arrondis séparés par un fin espace.
 * Le survol (anneau ou légende) met le segment en avant et l'affiche au centre.
 */
export function DashboardDonutChart({
  data,
  title,
  subtitle,
  centerLabel,
  centerValue,
  loading,
  className,
  dataColors = false,
}: {
  data: DonutSlice[]
  title: string
  subtitle?: string
  centerLabel?: string
  centerValue?: string | number
  loading?: boolean
  className?: string
  /** Garder les couleurs fournies par l'API au lieu de la palette validée. */
  dataColors?: boolean
}) {
  const viz = useViz()
  const colorOf = (slice: DonutSlice, i: number) => (dataColors && slice.couleur ? slice.couleur : viz.series[i % viz.series.length])
  const [active, setActive] = useState<number | null>(null)
  const total = data.reduce((sum, row) => sum + Number(row.valeur ?? 0), 0)
  const empty = !loading && total === 0
  const focused = active !== null ? data[active] : null
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0)

  return (
    <ChartFrame className={className} title={title} subtitle={subtitle} loading={loading} empty={empty}>
      <div className="flex min-h-0 flex-1 flex-col items-center gap-3 px-2">
        <div className="relative mx-auto aspect-square w-full max-w-[184px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="valeur"
                nameKey="label"
                innerRadius="68%"
                outerRadius="92%"
                paddingAngle={2.5}
                cornerRadius={7}
                stroke={viz.surface}
                strokeWidth={2}
                startAngle={90}
                endAngle={-270}
                animationDuration={900}
                onMouseEnter={(_, i) => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                {data.map((slice, i) => (
                  <Cell key={slice.label} fill={colorOf(slice, i)} fillOpacity={active === null || active === i ? 1 : 0.4} style={{ transition: 'fill-opacity 220ms ease', cursor: 'pointer' }} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="text-[30px] font-semibold leading-none tracking-[-0.04em] text-ink tabular-nums">
              {focused ? fmtNumber(focused.valeur) : centerValue ?? fmtNumber(total)}
            </p>
            <p className="mt-1.5 max-w-[7.5rem] truncate text-[12px] font-medium text-ink-3">
              {focused ? `${focused.label} · ${pct(focused.valeur)} %` : centerLabel ?? 'Total'}
            </p>
          </div>
        </div>
        <ul className="ma-scroll w-full min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {data.map((slice, i) => (
            <li key={slice.label}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-[5px] text-left text-[13px] transition-colors duration-150',
                  active === i ? 'bg-ink/[0.05] dark:bg-white/[0.06]' : 'hover:bg-ink/[0.03]',
                )}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: colorOf(slice, i) }} />
                <span className="min-w-0 flex-1 truncate text-ink-2">{slice.label}</span>
                <span className="shrink-0 font-semibold tabular-nums text-ink">{fmtNumber(slice.valeur)}</span>
                <span className="w-10 shrink-0 text-right tabular-nums text-ink-3">{pct(slice.valeur)} %</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </ChartFrame>
  )
}
