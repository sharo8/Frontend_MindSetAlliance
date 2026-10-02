import { useTranslation } from 'react-i18next'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { PageHeader } from '../../components/ui/page-header'
import { useActiveSociety } from '../../lib/projects/use-active-society'
import { RequirePermission } from '../../lib/rbac/RequirePermission'

export function CommercialPage() {
  const { t } = useTranslation()
  const { name } = useActiveSociety()
  return (
    <RequirePermission permission="MANAGE_ENTERPRISE_ACCOUNTS">
      <div className="space-y-4">
        <PageHeader
          kicker={t('pages.commercial.kicker')}
          title={t('pages.commercial.title')}
          subtitle={t('pages.commercial.subtitle', { name })}
        />
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Module Commercial</h2>
          </CardHeader>
          <CardBody className="text-sm text-ma-muted dark:text-ma-gray-300">
            Espace réservé aux agents ayant le rôle Commercial (validation coursiers, comptes entreprises).
          </CardBody>
        </Card>
      </div>
    </RequirePermission>
  )
}
