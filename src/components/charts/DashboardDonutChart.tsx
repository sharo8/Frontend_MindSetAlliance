import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardBody, CardHeader } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import { useThemeStore } from '../../lib/theme/theme-store'
import { cn } from '../../lib/utils'

export type DonutSlice = { label: string; valeur: number; couleur: string }

export function DashboardDonutChart({
  data,
  title,
  centerLabel,
  centerValue,
  loading,
  className,
}: {
  data: DonutSlice[]
  title: string
  centerLabel?: string
  centerValue?: string | number
  loading?: boolean
  className?: string
}) {
  const theme = useThemeStore((s) => s.theme)
  const total = data.reduce((sum, row) => sum + Number(row.valeur ?? 0), 0)
  const empty = !loading && total === 0

  return (
    <Card className={cn('flex h-full min-h-0 min-w-0 flex-col', className)}>
      <CardHeader className="shrink-0">
        <h2 className="font-semibold">{title}</h2>
      </CardHeader>
      <CardBody className="flex min-h-0 flex-1 flex-col gap-3">
        {loading && <Skeleton className="min-h-0 flex-1 rounded-xl" />}
        {!loading && empty && (
          <p className="flex min-h-0 flex-1 items-center justify-center text-sm text-ma-muted dark:text-ma-gray-300">
            Aucune donnée disponible pour cette période
          </p>
        )}
        {!loading && !empty && (
          <>
            <div className="relative mx-auto h-[170px] w-[170px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="valeur" nameKey="label" innerRadius={50} outerRadius={74} paddingAngle={2}>
                    {data.map((slice) => (
                      <Cell key={slice.label} fill={slice.couleur} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: theme === 'dark' ? '#0f1a3d' : '#ffffff',
                      border: '1px solid #e8b42a55',
                      borderRadius: 12,
                      color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className="font-display text-xl text-ma-navy-900 dark:text-ma-gold-400">{centerValue ?? total}</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-ma-muted dark:text-ma-gray-300">
                  {centerLabel ?? 'Total'}
                </p>
              </div>
            </div>
            <ul className="ma-home-scroll grid min-h-0 flex-1 content-start grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto text-sm lg:grid-cols-1">
              {data.map((slice) => (
                <li key={slice.label} className="flex min-w-0 items-center gap-2" title={slice.label}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.couleur }} />
                  <span className="min-w-0 flex-1 truncate">{slice.label}</span>
                  <span className="shrink-0 tabular-nums text-ma-muted dark:text-ma-gray-300">
                    {total ? Math.round((slice.valeur / total) * 100) : 0}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  )
}
