import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { PageHeader } from '../../components/ui/page-header'
import { ScopeEmpty } from '../../components/ui/scope-empty'
import { fetchVitrine } from '../../lib/api/domain'
import { useActiveSociety } from '../../lib/projects/use-active-society'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { kpiLabel } from '../../lib/vitrine/labels'

export function MdrPage() {
  const { t } = useTranslation()
  const { currentProject, name, isEnterprise, code } = useActiveSociety()
  const kpis = useQuery({ queryKey: ['vitrine', currentProject], queryFn: fetchVitrine })
  const rows = (kpis.data ?? []).filter((k) => isEnterprise || k.project?.code === code)
  return (
    <RequirePermission permission="VIEW_MARKETING_PERFORMANCE">
      <div className="space-y-4">
        <PageHeader kicker={t('pages.media.kicker')} title={t('pages.media.title')} subtitle={t('pages.media.subtitle', { name })} />
        {rows.length === 0 ? (
          <ScopeEmpty context={`Aucune donnée pour « ${name} ».`} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map((k) => (
              <Card key={k.id}>
                <CardHeader>
                  <h2 className="font-semibold">{kpiLabel(k.cle, k.categorie)}</h2>
                </CardHeader>
                <CardBody>
                  <p className="text-3xl font-semibold">{k.valeur ?? '—'}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>
    </RequirePermission>
  )
}
