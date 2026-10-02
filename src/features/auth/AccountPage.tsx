import { useTranslation } from 'react-i18next'
import { Card, CardBody } from '../../components/ui/card'
import { PageHeader } from '../../components/ui/page-header'
import { ProfileEditor } from './ProfileEditor'
import { MesAcces } from './MesAcces'

export function AccountPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <PageHeader
        kicker={t('pages.account.kicker')}
        title={t('pages.account.title')}
        subtitle={t('pages.account.subtitle')}
      />
      <Card className="ma-enter">
        <CardBody className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted">{t('pages.account.title')}</p>
          <ProfileEditor />
        </CardBody>
      </Card>
      <div className="ma-enter" style={{ animationDelay: '120ms' }}>
        <MesAcces />
      </div>
    </div>
  )
}
