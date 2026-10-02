import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, CardBody, CardHeader } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import { useThemeStore } from '../../lib/theme/theme-store'

export type BarPoint = { [key: string]: string | number }

export function DashboardBarChart({
  data,
  dataKey,
  xAxisKey,
  title,
  loading,
  tooltipDateKey = 'date',
  unit,
}: {
  data: BarPoint[]
  dataKey: string
  xAxisKey: string
  title: string
  loading?: boolean
  tooltipDateKey?: string
  unit?: string
}) {
  const theme = useThemeStore((s) => s.theme)
  const axis = theme === 'dark' ? '#94a3b8' : '#64748b'
  const grid = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'
  const empty = !loading && data.every((row) => Number(row[dataKey] ?? 0) === 0)

  return (
    <Card className="min-w-0">
      <CardHeader>
        <h2 className="font-semibold">{title}</h2>
      </CardHeader>
      <CardBody className="h-64">
        {loading && <Skeleton className="h-full w-full rounded-xl" />}
        {!loading && empty && (
          <p className="flex h-full items-center justify-center text-sm text-ma-muted dark:text-ma-gray-300">
            Aucune donnée disponible pour cette période
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
              <YAxis hide />
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
      </CardBody>
    </Card>
  )
}
