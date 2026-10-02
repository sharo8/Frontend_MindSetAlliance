import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { PageHeader } from '../../components/ui/page-header'
import { fetchAgents } from '../../lib/api/domain'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { projectLabel, roleLabel } from '../../lib/rbac/rbac'

export function AdminPage() {
  const { t } = useTranslation()
  const agents = useQuery({ queryKey: ['agents'], queryFn: fetchAgents })
  return (
    <RequirePermission permission="MANAGE_AGENTS">
      <div className="space-y-4">
        <PageHeader kicker={t('pages.admin.kicker')} title={t('pages.admin.title')} subtitle={t('pages.admin.subtitle')} />
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Agents et rôles</h2>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            {(agents.data ?? []).map((a) => (
              <div key={a.id} className="border-b border-ma-navy-950/5 pb-2">
                <p className="font-medium">
                  {a.prenom} {a.nom} — {a.emailPro}
                </p>
                <p className="text-ma-navy-700/80">
                  {a.roles.map((r) => `${roleLabel(r.role)} (${projectLabel(r.projectCode)})`).join(' · ')}
                </p>
              </div>
            ))}
            {agents.isError && <p className="text-status-danger">Droits insuffisants.</p>}
          </CardBody>
        </Card>
      </div>
    </RequirePermission>
  )
}
