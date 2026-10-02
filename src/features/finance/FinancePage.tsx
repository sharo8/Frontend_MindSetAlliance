import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard, KpiCard } from '../../components/ui/charts'
import { PageHeader } from '../../components/ui/page-header'
import { fetchFinanceDashboard } from '../../lib/api/ops'
import { useProjectStore } from '../../lib/projects/project-store'
import { RequirePermission } from '../../lib/rbac/RequirePermission'

const COLORS = ['#e0a721', '#16215c', '#f97316', '#22c55e']

export function FinancePage() {
  const { t } = useTranslation()
  const currentProject = useProjectStore((s) => s.currentProject)
  const dash = useQuery({
    queryKey: ['fin-dash', currentProject],
    queryFn: () => fetchFinanceDashboard(currentProject === 'ENTREPRISE' ? undefined : currentProject),
  })
  const d = dash.data
  return (
    <RequirePermission permission="VIEW_FINANCE">
      <div className="space-y-4">
        <PageHeader kicker={t('pages.finance.kicker')} title={t('pages.finance.title')} subtitle={t('pages.finance.subtitle')} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Recettes du mois" value={Math.round(Number(d?.recettesMois ?? 0))} accent="ok" />
          <KpiCard label="Dépenses du mois" value={Math.round(Number(d?.depensesMois ?? 0))} accent="warn" />
          <KpiCard label="Factures en retard" value={d?.facturesRetard ?? 0} accent="info" />
          <KpiCard label="Trésorerie" value={Math.round(Number(d?.tresorerie ?? 0))} accent="gold" />
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <ChartCard title="Recettes vs dépenses — 6 mois">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d?.comparaison6m ?? []}>
                  <XAxis dataKey="mois" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="recettes" fill="#e0a721" radius={4} />
                  <Bar dataKey="depenses" fill="#16215c" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <ChartCard title="Canaux d’encaissement">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d?.parCanal ?? []} dataKey="montant" nameKey="canal" innerRadius={48} outerRadius={78}>
                  {(d?.parCanal ?? []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </RequirePermission>
  )
}
