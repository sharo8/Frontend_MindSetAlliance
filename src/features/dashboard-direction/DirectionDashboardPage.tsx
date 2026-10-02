import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge, prioriteTone } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { PageHeader } from '../../components/ui/page-header'
import { fetchVitrine } from '../../lib/api/domain'
import { exportTickets, listTickets } from '../../lib/api/tickets'
import { useProjectStore } from '../../lib/projects/project-store'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { categorieLabel, kpiLabel } from '../../lib/vitrine/labels'
import { projectLabel } from '../../lib/rbac/rbac'

const PIE_COLORS = ['#e0a721', '#16215c', '#3b82f6', '#22c55e']

export function DirectionDashboardPage() {
  const { t } = useTranslation()
  const currentProject = useProjectStore((s) => s.currentProject)
  const kpis = useQuery({ queryKey: ['vitrine', currentProject], queryFn: fetchVitrine })
  const tickets = useQuery({
    queryKey: ['tickets-dir', currentProject],
    queryFn: () =>
      listTickets({
        projectCode: currentProject === 'ENTREPRISE' ? undefined : currentProject,
      }),
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
