import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, prioriteTone } from '../../components/ui/badge'
import { ChartCard, KpiCard } from '../../components/ui/charts'
import { Card, CardBody } from '../../components/ui/card'
import { PageHeader } from '../../components/ui/page-header'
import { ScopeEmpty } from '../../components/ui/scope-empty'
import { TableSkeleton } from '../../components/ui/skeleton'
import { fetchCnnDashboard } from '../../lib/api/ops'
import { useActiveSociety } from '../../lib/projects/use-active-society'
import { RequirePermission } from '../../lib/rbac/RequirePermission'

const COLORS = ['#e0a721', '#16215c', '#3b82f6', '#22c55e', '#ef4444']

export function ColisNaNgaPage() {
  const { t } = useTranslation()
  const { currentProject, name, isEnterprise } = useActiveSociety()
  const dash = useQuery({
    queryKey: ['ops-dash', currentProject],
    queryFn: () => fetchCnnDashboard(currentProject),
    enabled: !isEnterprise,
  })
  const d = dash.data
  return (
    <RequirePermission anyOfPermissions={['VIEW_FLEET_MAP', 'MANAGE_COURSES', 'RESOLVE_INCIDENTS']}>
      <div className="space-y-4">
        <PageHeader
          kicker={t('pages.ops.kicker')}
          title={t('pages.ops.title')}
          subtitle={t('pages.ops.subtitle', { name })}
        />
        {isEnterprise && (
          <ScopeEmpty context="Sélectionnez une société dans le sélecteur en haut à gauche pour afficher la supervision opérationnelle." />
        )}
        {!isEnterprise && dash.isLoading && <TableSkeleton rows={4} />}
        {!isEnterprise && !dash.isLoading && (
          <>
            <div className="rounded-xl border border-ma-gold-500/40 bg-ma-gold-500/10 px-4 py-2.5 text-sm text-ma-navy-900 dark:text-ma-gold-300">
              Données de démonstration — intégration opérationnelle non connectée
            </div>
            {(d?.coursesDuJour ?? 0) === 0 && (d?.coursiersActifs ?? 0) === 0 && (d?.incidents?.length ?? 0) === 0 ? (
              <ScopeEmpty context={`Aucune donnée pour « ${name} ».`} />
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <KpiCard label="Courses du jour" value={d?.coursesDuJour ?? 0} accent="gold" />
                  <KpiCard label="Coursiers actifs" value={d?.coursiersActifs ?? 0} accent="info" />
                  <KpiCard label="Taux de livraison" value={Math.round(d?.tauxLivraison ?? 0)} hint="%" accent="ok" />
                  <KpiCard label="Incidents ouverts" value={d?.incidentsOuverts ?? 0} accent="warn" />
                </div>
                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="xl:col-span-2">
                    <ChartCard title="Volume de courses — 30 jours">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={d?.volume30j ?? []}>
                          <XAxis dataKey="jour" hide />
                          <YAxis />
                          <Tooltip />
                          <Area type="monotone" dataKey="volume" stroke="#e0a721" fill="#e0a72133" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </div>
                  <ChartCard title="Statuts des courses">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={d?.parStatut ?? []} dataKey="volume" nameKey="statut" innerRadius={48} outerRadius={78}>
                          {(d?.parStatut ?? []).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
                <ChartCard title="Répartition par zone">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d?.parZone ?? []}>
                      <XAxis dataKey="zone" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="volume" fill="#16215c" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
                <Card>
                  <CardBody className="overflow-x-auto p-0">
                    <table className="w-full text-left text-sm">
                      <thead className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted">
                        <tr>
                          <th className="px-4 py-3">Incident</th>
                          <th className="px-4 py-3">Priorité</th>
                          <th className="px-4 py-3">Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(d?.incidents ?? []).map((row) => (
                          <tr key={row.id} className="border-t border-ma-line/80">
                            <td className="px-4 py-2">{row.titre}</td>
                            <td className="px-4 py-2">
                              <Badge tone={prioriteTone(row.priorite ?? '')}>{row.priorite ?? '—'}</Badge>
                            </td>
                            <td className="px-4 py-2">{row.statut}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardBody>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </RequirePermission>
  )
}
