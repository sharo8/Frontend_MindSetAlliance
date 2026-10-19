import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/ui/page-header'
import { Stagger, StaggerItem } from '../../components/motion/page-fade'
import { ProfileEditor } from './ProfileEditor'
import { MesAcces } from './MesAcces'

export function AccountPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <PageHeader kicker={t('pages.account.kicker')} title={t('pages.account.title')} subtitle={t('pages.account.subtitle')} />
      <Stagger>
        <StaggerItem>
          <ProfileEditor variant="page" aside={<MesAcces />} />
        </StaggerItem>
      </Stagger>
    </div>
  )
}
