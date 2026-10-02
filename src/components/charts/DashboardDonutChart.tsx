import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardBody, CardHeader } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import { useThemeStore } from '../../lib/theme/theme-store'

export type DonutSlice = { label: string; valeur: number; couleur: string }

export function DashboardDonutChart({
  data,
  title,
  centerLabel,
  centerValue,
  loading,
}: {
  data: DonutSlice[]
  title: string
  centerLabel?: string
  centerValue?: string | number
  loading?: boolean
}) {
  const theme = useThemeStore((s) => s.theme)
  const total = data.reduce((sum, row) => sum + Number(row.valeur ?? 0), 0)
  const empty = !loading && total === 0

  return (
    <Card className="min-w-0">
      <CardHeader>
        <h2 className="font-semibold">{title}</h2>
      </CardHeader>
      <CardBody className="space-y-3">
        {loading && <Skeleton className="h-56 w-full rounded-xl" />}
        {!loading && empty && (
          <p className="flex h-56 items-center justify-center text-sm text-ma-muted dark:text-ma-gray-300">
            Aucune donnée disponible pour cette période
          </p>
        )}
        {!loading && !empty && (
          <>
            <div className="relative h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="valeur" nameKey="label" innerRadius={58} outerRadius={82} paddingAngle={2}>
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
            <ul className="space-y-1 text-sm">
              {data.map((slice) => (
                <li key={slice.label} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: slice.couleur }} />
                    {slice.label}
                  </span>
                  <span className="text-ma-muted dark:text-ma-gray-300">
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
