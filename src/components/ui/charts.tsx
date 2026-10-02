import { StatCard } from './stat-card'
import { Card, CardBody, CardHeader } from './card'
import type { ReactNode } from 'react'

export function KpiCard({
  label,
  value,
  hint,
  accent = 'gold',
}: {
  label: string
  value: number
  hint?: string
  accent?: 'gold' | 'info' | 'warn' | 'ok'
}) {
  return <StatCard label={label} value={value} hint={hint} accent={accent} />
}

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">{title}</h2>
      </CardHeader>
      <CardBody className="h-64">{children}</CardBody>
    </Card>
  )
}
