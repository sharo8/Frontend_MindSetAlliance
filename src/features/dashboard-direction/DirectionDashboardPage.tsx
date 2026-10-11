import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, prioriteTone } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { PageHeader } from '../../components/ui/page-header'
import { CnnSourceBadge } from '../../components/ui/cnn-source-badge'
import { fetchDirectionDashboard, type DirectionCnn } from '../../lib/api/ops'
import { fetchVitrine } from '../../lib/api/domain'
import { exportTickets, listTickets } from '../../lib/api/tickets'
import { useProjectStore } from '../../lib/projects/project-store'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { categorieLabel, kpiLabel } from '../../lib/vitrine/labels'
import { projectLabel } from '../../lib/rbac/rbac'

const PIE_COLORS = ['#e0a721', '#16215c', '#3b82f6', '#22c55e']

export function DirectionDashboardPage() {
  const { t, i18n } = useTranslation()
  const currentProject = useProjectStore((s) => s.currentProject)
  const cnn = currentProject === 'CNN'
  const direction = useQuery({
    queryKey: ['direction-cnn', currentProject],
    queryFn: () => fetchDirectionDashboard(currentProject),
    enabled: cnn,
    refetchInterval: cnn ? 10_000 : false,
  })
  const kpis = useQuery({ queryKey: ['vitrine', currentProject], queryFn: fetchVitrine, enabled: !cnn })
  const tickets = useQuery({
    queryKey: ['tickets-dir', currentProject],
    queryFn: () =>
      listTickets({
        projectCode: currentProject === 'ENTREPRISE' ? undefined : currentProject,
      }),
    enabled: !cnn,
  })

  const filtered = (kpis.data ?? []).filter(
    (k) => currentProject === 'ENTREPRISE' || k.project?.code === currentProject,
  )
  const cards = filtered.slice(0, 4)
  const byCategory = Object.entries(
    filtered.reduce<Record<string, number>>((acc, kpi) => {
      acc[kpi.categorie] = (acc[kpi.categorie] ?? 0) + Number(kpi.valeur ?? 0)
      return acc
    }, {}),
  ).map(([name, value]) => ({ name: categorieLabel(name), value }))

  const incidents = (tickets.data ?? []).filter((t) => t.type === 'INCIDENT' && !['CLOTURE', 'ANNULE', 'RESOLU'].includes(t.statut))
  const volume = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'].map((mois, i) => ({
    mois,
    volume: filtered.reduce((sum, k) => sum + Number(k.valeur ?? 0), 0) / 6 + i,
  }))

  if (cnn) {
    return (
      <RequirePermission anyOf={['DIRECTION', 'CONSEIL_ADMINISTRATION', 'ADMIN_SYSTEME']}>
        <CnnDirection data={direction.data} loading={direction.isLoading} lang={i18n.language || 'fr'} />
      </RequirePermission>
    )
  }

  return (
    <RequirePermission anyOf={['DIRECTION', 'CONSEIL_ADMINISTRATION', 'ADMIN_SYSTEME']}>
      <div className="space-y-4">
        <PageHeader
          kicker={t('pages.direction.kicker')}
          title={t('pages.direction.title')}
          subtitle={projectLabel(currentProject === 'ENTREPRISE' ? null : currentProject)}
          actions={
            <Button
              variant="outline"
              onClick={() => void exportTickets(currentProject === 'ENTREPRISE' ? undefined : currentProject)}
            >
              Exporter le rapport
            </Button>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(cards.length ? cards : [{ id: 0, cle: 'indicateur', categorie: 'OPERATIONNEL', valeur: '—', project: undefined }]).map((kpi) => (
            <Card key={kpi.id}>
              <CardBody>
                <p className="text-xs uppercase tracking-wide text-ma-navy-700/70">
                  {categorieLabel(kpi.categorie)} · {kpi.project?.code ? projectLabel(kpi.project.code) : 'Tous projets'}
                </p>
                <p className="mt-2 text-3xl font-semibold">{kpi.valeur ?? '—'}</p>
                <p className="mt-1 text-sm">{kpiLabel(kpi.cle, kpi.categorie)}</p>
              </CardBody>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <h2 className="font-semibold">Volume mensuel</h2>
            </CardHeader>
            <CardBody className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volume}>
                  <XAxis dataKey="mois" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="volume" fill="#e0a721" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Répartition par catégorie</h2>
            </CardHeader>
            <CardBody className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory.length ? byCategory : [{ name: 'Aucune donnée', value: 1 }]} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                    {(byCategory.length ? byCategory : [{ name: 'Aucune donnée', value: 1 }]).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Incidents actifs</h2>
            </CardHeader>
            <CardBody className="space-y-2">
              {incidents.slice(0, 8).map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm">
                  <span>{t.reference} — {t.titre}</span>
                  <Badge tone={prioriteTone(t.priorite)}>{t.priorite}</Badge>
                </div>
              ))}
              {incidents.length === 0 && <p className="text-sm">Aucun incident actif.</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Santé du système</h2>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-status-success">● Cœur applicatif joignable</p>
              <p className="mt-2 text-sm">Dernière mise à jour vitrine : {filtered[0]?.derniereMaj ?? '—'}</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </RequirePermission>
  )
}

function CnnDirection({ data, loading, lang }: { data?: DirectionCnn; loading: boolean; lang: string }) {
  const { t } = useTranslation()
  const unavailable = !loading && data?.source !== 'CNN_DB'
  const slices = (data?.parStatut ?? []).map((row) => ({
    code: row.statut,
    label: t(`cnn.status.${row.statut}`, { defaultValue: row.statut }),
    value: Number(row.volume ?? 0),
    couleur: row.couleur ?? '#64748b',
  }))
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const months = (data?.coursesParMois ?? []).map((row) => ({
    mois: formatMonth(row.mois, lang),
    volume: row.volume,
  }))
  const updated = data?.calculeLe
    ? new Intl.DateTimeFormat(lang, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(data.calculeLe))
    : '—'
  return (
    <div className="space-y-4">
      <PageHeader kicker={t('pages.direction.kicker')} title={t('pages.direction.title')} subtitle={projectLabel('CNN')} />
      <CnnSourceBadge source={data?.source} ageSecondes={data?.ageSecondes} readOnlyVerified={data?.readOnlyVerified} />
      {unavailable && <p className="text-sm">{t('cnn.source.downDetail')}</p>}
      {!unavailable && (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <h2 className="font-semibold">{t('cnn.direction.volume')}</h2>
              </CardHeader>
              <CardBody className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={months}>
                    <XAxis dataKey="mois" />
                    <YAxis allowDecimals={false} width={36} />
                    <Tooltip formatter={(value) => [String(value), t('cnn.direction.courses')]} />
                    <Bar dataKey="volume" fill="#e0a721" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <h2 className="font-semibold">{t('cnn.direction.split')}</h2>
              </CardHeader>
              <CardBody className="space-y-2">
                <div className="relative mx-auto h-[150px] w-[150px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={slices.length ? slices : [{ label: t('cnn.direction.empty'), value: 0 }]} dataKey="value" nameKey="label" innerRadius={46} outerRadius={68}>
                        {(slices.length ? slices : [{ couleur: '#64748b' }]).map((slice, i) => (
                          <Cell key={i} fill={'couleur' in slice ? slice.couleur : COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-lg font-semibold tabular-nums">{total}</p>
                    <p className="text-[10px] uppercase tracking-wide text-ma-muted">{t('cnn.finance.center')}</p>
                  </div>
                </div>
                <ul className="space-y-1 text-sm">
                  {slices.map((slice) => (
                    <li key={slice.code} className="flex gap-2" title={slice.label}>
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.couleur }} />
                      <span className="min-w-0 flex-1 truncate">{slice.label}</span>
                      <span className="tabular-nums">{slice.value}</span>
                      <span className="w-10 text-right tabular-nums text-ma-muted">{total ? Math.round((slice.value / total) * 100) : 0}%</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <h2 className="font-semibold">{t('cnn.direction.incidents')}</h2>
              </CardHeader>
              <CardBody className="space-y-2 text-sm">
                {data?.remboursementsEnAttente == null && data?.appelsUrgence == null ? (
                  <p>{t('cnn.direction.emptyIncidents')}</p>
                ) : (
                  <>
                    <p className="flex justify-between">
                      <span>{t('cnn.direction.refundsPending')}</span>
                      <span className="tabular-nums">{data?.remboursementsEnAttente ?? 0}</span>
                    </p>
                    <p className="flex justify-between">
                      <span>{t('cnn.direction.emergency')}</span>
                      <span className="tabular-nums">{data?.appelsUrgence ?? 0}</span>
                    </p>
                    {(data?.remboursementsEnAttente ?? 0) === 0 && (data?.appelsUrgence ?? 0) === 0 && (
                      <p className="text-ma-muted">{t('cnn.direction.noneOpen')}</p>
                    )}
                  </>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <h2 className="font-semibold">{t('cnn.direction.health')}</h2>
              </CardHeader>
              <CardBody>
                <p className="text-sm">{t('cnn.direction.updated', { time: updated })}</p>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function formatMonth(iso: string, lang: string) {
  const [year, month] = iso.split('-').map(Number)
  if (!year || !month) return iso
  return new Intl.DateTimeFormat(lang, { month: 'short', year: '2-digit' }).format(new Date(year, month - 1, 1))
}

const COLORS = ['#e0a721', '#16215c', '#3b82f6', '#22c55e']
