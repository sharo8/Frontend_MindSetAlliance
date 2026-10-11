import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardBody, CardHeader } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import { useThemeStore } from '../../lib/theme/theme-store'
import { cn } from '../../lib/utils'

export type HistogramBin = { tranche: string; occurrences: number }

export function DashboardHistogram({
  bins,
  title,
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
  highlightMax?: boolean
  loading?: boolean
  synthesis?: string | null
  zeroAsData?: boolean
  emptyMessage?: string
  unavailableMessage?: string | null
  className?: string
}) {
  const theme = useThemeStore((s) => s.theme)
  const axis = theme === 'dark' ? '#94a3b8' : '#64748b'
  const grid = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'
  const max = Math.max(0, ...bins.map((b) => b.occurrences))
  const empty = !loading && !unavailableMessage && max === 0 && !zeroAsData

  return (
    <Card className={cn('flex h-full min-h-0 min-w-0 flex-col', className)}>
      <CardHeader className="shrink-0">
        <h2 className="font-semibold">{title}</h2>
      </CardHeader>
      <CardBody className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="min-h-0 flex-1">
          {loading && <Skeleton className="h-full w-full rounded-xl" />}
          {!loading && unavailableMessage && (
            <p className="flex h-full items-center justify-center px-4 text-center text-sm text-ma-muted dark:text-ma-gray-300">
              {unavailableMessage}
            </p>
          )}
          {!loading && empty && (
            <p className="flex h-full items-center justify-center text-sm text-ma-muted dark:text-ma-gray-300">
              {emptyMessage}
            </p>
          )}
          {!loading && !empty && !unavailableMessage && (
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
        {!loading && !unavailableMessage && (zeroAsData || !empty) && synthesis && (
          <p className="shrink-0 text-sm text-ma-muted dark:text-ma-gray-300">{synthesis}</p>
        )}
      </CardBody>
    </Card>
  )
}
