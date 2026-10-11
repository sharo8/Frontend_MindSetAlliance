import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardBody, CardHeader } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import { useThemeStore } from '../../lib/theme/theme-store'
import { cn } from '../../lib/utils'

export type BarPoint = { [key: string]: string | number }

export function DashboardBarChart({
  data,
  dataKey,
  xAxisKey,
  title,
  loading,
  tooltipDateKey = 'date',
  unit,
  zeroAsData = false,
  footnote,
  emptyMessage = 'Aucune donnée disponible pour cette période',
  className,
}: {
  data: BarPoint[]
  dataKey: string
  xAxisKey: string
  title: string
  loading?: boolean
  tooltipDateKey?: string
  unit?: string
  zeroAsData?: boolean
  footnote?: string | null
  emptyMessage?: string
  className?: string
}) {
  const theme = useThemeStore((s) => s.theme)
  const axis = theme === 'dark' ? '#94a3b8' : '#64748b'
  const grid = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'
  const allZero = data.every((row) => Number(row[dataKey] ?? 0) === 0)
  const empty = !loading && allZero && !zeroAsData

  return (
    <Card className={cn('flex h-full min-h-0 min-w-0 flex-col', className)}>
      <CardHeader className="shrink-0">
        <h2 className="font-semibold">{title}</h2>
      </CardHeader>
      <CardBody className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="min-h-0 flex-1">
        {loading && <Skeleton className="h-full w-full rounded-xl" />}
        {!loading && empty && (
          <p className="flex h-full items-center justify-center text-sm text-ma-muted dark:text-ma-gray-300">
            {emptyMessage}
          </p>
        )}
        {!loading && !empty && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="maGoldBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f6d06a" />
                  <stop offset="100%" stopColor="#c49214" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={grid} vertical={false} />
              <XAxis dataKey={xAxisKey} tick={{ fill: axis, fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide={!zeroAsData} allowDecimals={false} width={zeroAsData ? 28 : 0} tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' }}
                contentStyle={{
                  background: theme === 'dark' ? '#0f1a3d' : '#ffffff',
                  border: '1px solid #e8b42a55',
                  borderRadius: 12,
                  color: theme === 'dark' ? '#f8fafc' : '#0f172a',
                }}
                formatter={(value) => [`${value}${unit ? ` ${unit}` : ''}`, 'Valeur']}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as BarPoint | undefined
                  return String(row?.[tooltipDateKey] ?? '')
                }}
              />
              <Bar dataKey={dataKey} fill="url(#maGoldBar)" radius={[6, 6, 2, 2]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        )}
        </div>
        {!loading && footnote && <p className="shrink-0 text-sm text-ma-muted dark:text-ma-gray-300">{footnote}</p>}
      </CardBody>
    </Card>
  )
}
