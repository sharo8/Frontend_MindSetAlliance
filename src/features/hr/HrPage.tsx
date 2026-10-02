import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard, KpiCard } from '../../components/ui/charts'
import { PageHeader } from '../../components/ui/page-header'
import { fetchRhDashboard } from '../../lib/api/ops'
import { useProjectStore } from '../../lib/projects/project-store'
import { RequirePermission } from '../../lib/rbac/RequirePermission'

export function HrPage() {
  const { t } = useTranslation()
  const currentProject = useProjectStore((s) => s.currentProject)
  const dash = useQuery({
    queryKey: ['rh-dash', currentProject],
    queryFn: () => fetchRhDashboard(currentProject === 'ENTREPRISE' ? undefined : currentProject),
  })
  const d = dash.data
  return (
    <RequirePermission permission="MANAGE_HR">
      <div className="space-y-4">
        <PageHeader kicker={t('pages.hr.kicker')} title={t('pages.hr.title')} subtitle={t('pages.hr.subtitle')} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Effectif total" value={d?.effectif ?? 0} accent="gold" />
          <KpiCard label="Présence du mois" value={d?.presence ?? 0} hint="%" accent="ok" />
          <KpiCard label="Congés en attente" value={d?.congesAttente ?? 0} accent="warn" />
          <KpiCard label="Contrats à échéance" value={d?.contratsEcheance ?? 0} accent="info" />
        </div>
        <ChartCard title="Effectifs par département">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d?.parDepartement ?? []}>
              <XAxis dataKey="departement" hide />
              <YAxis />
              <Tooltip />
              <Bar dataKey="effectif" fill="#e0a721" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </RequirePermission>
  )
}

export function PayrollPage() {
  const { t } = useTranslation()
  const currentProject = useProjectStore((s) => s.currentProject)
  const dash = useQuery({
    queryKey: ['rh-dash', currentProject],
    queryFn: () => fetchRhDashboard(currentProject === 'ENTREPRISE' ? undefined : currentProject),
  })
  return (
    <RequirePermission permission="VIEW_PAYROLL">
      <div className="space-y-4">
        <PageHeader kicker={t('pages.payroll.kicker')} title={t('pages.payroll.title')} subtitle={t('pages.payroll.subtitle')} />
        <KpiCard label="Effectif payé (actif)" value={dash.data?.effectif ?? 0} hint="Les bulletins restent dans le module paie Core." />
      </div>
    </RequirePermission>
  )
}
