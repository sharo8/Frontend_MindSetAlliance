import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardBody, CardHeader } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import { useThemeStore } from '../../lib/theme/theme-store'

export type HistogramBin = { tranche: string; occurrences: number }

export function DashboardHistogram({
  bins,
  title,
  highlightMax = true,
  loading,
  synthesis,
}: {
  bins: HistogramBin[]
  title: string
  highlightMax?: boolean
  loading?: boolean
  synthesis?: string | null
}) {
  const theme = useThemeStore((s) => s.theme)
  const axis = theme === 'dark' ? '#94a3b8' : '#64748b'
  const grid = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'
  const max = Math.max(0, ...bins.map((b) => b.occurrences))
  const empty = !loading && max === 0

  return (
    <Card className="min-w-0">
      <CardHeader>
        <h2 className="font-semibold">{title}</h2>
      </CardHeader>
      <CardBody className="space-y-3">
        <div className="h-64">
          {loading && <Skeleton className="h-full w-full rounded-xl" />}
          {!loading && empty && (
            <p className="flex h-full items-center justify-center text-sm text-ma-muted dark:text-ma-gray-300">
              Aucune donnée disponible pour cette période
            </p>
          )}
          {!loading && !empty && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bins} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={grid} vertical={false} />
                <XAxis dataKey="tranche" tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip
                  contentStyle={{
                    background: theme === 'dark' ? '#0f1a3d' : '#ffffff',
                    border: '1px solid #e8b42a55',
                    borderRadius: 12,
                    color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                  }}
                />
                <Bar dataKey="occurrences" radius={[6, 6, 2, 2]} maxBarSize={48}>
                  {bins.map((bin) => (
                    <Cell
                      key={bin.tranche}
                      fill={highlightMax && bin.occurrences === max ? '#e8b42a' : '#2563eb'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        {!loading && !empty && synthesis && (
          <p className="text-sm text-ma-muted dark:text-ma-gray-300">{synthesis}</p>
        )}
      </CardBody>
    </Card>
  )
}
