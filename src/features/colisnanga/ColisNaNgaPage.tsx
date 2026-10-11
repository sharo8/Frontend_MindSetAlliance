import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, prioriteTone } from '../../components/ui/badge'
import { ChartCard, KpiCard } from '../../components/ui/charts'
import { Card, CardBody } from '../../components/ui/card'
import { PageHeader } from '../../components/ui/page-header'
import { ScopeEmpty } from '../../components/ui/scope-empty'
import { TableSkeleton } from '../../components/ui/skeleton'
import { CnnSourceBadge } from '../../components/ui/cnn-source-badge'
import { fetchCnnDashboard } from '../../lib/api/ops'
import { useActiveSociety } from '../../lib/projects/use-active-society'
import { RequirePermission } from '../../lib/rbac/RequirePermission'

const COLORS = ['#e0a721', '#16215c', '#3b82f6', '#22c55e', '#ef4444']

function Metric({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: number | null | undefined
  hint?: string
  accent: 'gold' | 'info' | 'warn' | 'ok'
}) {
  if (value == null) {
    return (
      <Card>
        <CardBody>
          <p className="text-xs uppercase tracking-wide text-ma-muted">{label}</p>
          <p className="mt-2 font-display text-2xl text-ma-navy-900 dark:text-ma-gold-300">Donnée absente</p>
          {hint && <p className="mt-1 text-xs text-ma-muted">{hint}</p>}
        </CardBody>
      </Card>
    )
  }
  return <KpiCard label={label} value={value} hint={hint} accent={accent} />
}

export function ColisNaNgaPage() {
  const { t } = useTranslation()
  const { currentProject, name, isEnterprise } = useActiveSociety()
  const dash = useQuery({
    queryKey: ['ops-dash', currentProject],
    queryFn: () => fetchCnnDashboard(currentProject),
    enabled: !isEnterprise,
    refetchInterval: 10_000,
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
        {!isEnterprise && (d || dash.isError) && (
          <CnnSourceBadge source={d?.source} ageSecondes={d?.ageSecondes} message={d?.message} readOnlyVerified={d?.readOnlyVerified} />
        )}
        {!isEnterprise && dash.isLoading && <TableSkeleton rows={4} />}
        {!isEnterprise && !dash.isLoading && d?.source !== 'CNN_DB' && (
          <ScopeEmpty context={d?.message ?? 'Source Colis na Nga indisponible.'} />
        )}
        {!isEnterprise && !dash.isLoading && d?.source === 'CNN_DB' && (
          <>
              <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <>
                      <Metric label="Courses livrées aujourd'hui" value={d.coursesLivreesJour} hint={d.livraisonJourMessage ?? (d.coursesLivreesTotal == null ? undefined : `Total livré : ${d.coursesLivreesTotal}`)} accent="gold" />
                      <Metric label="Coursiers actifs" value={d.coursiersActifs} hint={d.coursiersExpiresMessage ?? undefined} accent="info" />
                      <Metric label="Taux de livraison" value={d.tauxLivraison == null ? null : Math.round(d.tauxLivraison)} hint="%" accent="ok" />
                      <Metric label="Incidents ouverts" value={d.incidentsOuverts} hint={d.urgences == null ? undefined : `Appels d'urgence : ${d.urgences}`} accent="warn" />
                    </>
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
                    {d?.volumeMessage && <p className="mt-2 text-sm text-ma-muted">{d.volumeMessage}</p>}
                  </div>
                  <ChartCard title="Statuts des courses">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={d?.parStatut ?? []} dataKey="volume" nameKey="libelle" innerRadius={48} outerRadius={78}>
                          {(d?.parStatut ?? []).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
                <p className="text-sm text-ma-muted">Zones — {d.zoneMessage ?? 'Non disponible dans la base Colis na Nga'}</p>
                <p className="text-sm text-ma-muted">Retards — {d.retardsMessage ?? 'Non disponible dans la base Colis na Nga'}</p>
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
                            <td className="px-4 py-2">
                              <div>{row.titre}</div>
                              {row.description && <div className="text-xs text-ma-muted">{row.description}</div>}
                            </td>
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
          </>
        )}
      </div>
    </RequirePermission>
  )
}
