import { useTranslation } from 'react-i18next'
import { ModuleCrud } from '../../components/ui/module-crud'
import { useActiveSociety } from '../../lib/projects/use-active-society'

export function FleetMapPage() {
  const { t } = useTranslation()
  const { ville } = useActiveSociety()
  return (
    <ModuleCrud
      module="COURSE"
      permission="VIEW_FLEET_MAP"
      kicker={t('pages.ops.kicker')}
      title={t('ops.fleet.title')}
      subtitle={ville ? t('ops.fleet.subtitleCity', { ville }) : t('ops.fleet.subtitle')}
      createLabel={t('ops.fleet.create')}
    />
  )
}

export function IncidentsPage() {
  const { t } = useTranslation()
  return (
    <ModuleCrud
      module="INCIDENT"
      permission="RESOLVE_INCIDENTS"
      kicker={t('pages.ops.kicker')}
      title={t('ops.incidents.title')}
      subtitle={t('ops.incidents.subtitle')}
      createLabel={t('ops.incidents.create')}
    />
  )
}

export function CouriersPage() {
  const { t } = useTranslation()
  return (
    <ModuleCrud
      module="COURIER"
      permission="VALIDATE_COURIER"
      kicker={t('nav.section.commercial')}
      title={t('ops.couriers.title')}
      subtitle={t('ops.couriers.subtitle')}
      createLabel={t('ops.couriers.create')}
      archiveLabel={t('ops.couriers.archive')}
    />
  )
}

export function EnterprisesPage() {
  const { t } = useTranslation()
  return (
    <ModuleCrud
      module="ENTERPRISE"
      permission="MANAGE_ENTERPRISE_ACCOUNTS"
      kicker={t('nav.section.commercial')}
      title={t('ops.enterprises.title')}
      subtitle={t('ops.enterprises.subtitle')}
      createLabel={t('ops.enterprises.create')}
      archiveLabel={t('ops.enterprises.archive')}
    />
  )
}

export function SubscriptionsPage() {
  const { t } = useTranslation()
  return (
    <ModuleCrud
      module="SUBSCRIPTION"
      permission="MANAGE_SUBSCRIPTIONS"
      kicker={t('nav.section.finance')}
      title={t('ops.subscriptions.title')}
      subtitle={t('ops.subscriptions.subtitle')}
      createLabel={t('ops.subscriptions.create')}
      archiveLabel={t('ops.subscriptions.archive')}
    />
  )
}

export function InvoicingPage() {
  const { t } = useTranslation()
  return (
    <ModuleCrud
      module="INVOICE"
      permission="MANAGE_INVOICING"
      kicker={t('nav.section.finance')}
      title={t('ops.invoicing.title')}
      subtitle={t('ops.invoicing.subtitle')}
      createLabel={t('ops.invoicing.create')}
    />
  )
}

export function B2cPage() {
  const { t } = useTranslation()
  return (
    <ModuleCrud
      module="INVOICE"
      permission="VIEW_B2C_VOLUME"
      kicker={t('nav.section.finance')}
      title={t('ops.b2c.title')}
      subtitle={t('ops.b2c.subtitle')}
      createLabel={t('ops.b2c.create')}
    />
  )
}

export function LeavesPage() {
  const { t } = useTranslation()
  return (
    <ModuleCrud
      module="LEAVE"
      permission="MANAGE_STAFF"
      kicker={t('pages.hr.kicker')}
      title={t('ops.leaves.title')}
      subtitle={t('ops.leaves.subtitle')}
      createLabel={t('ops.leaves.create')}
      archiveLabel={t('ops.leaves.archive')}
    />
  )
}

export function PartnersPage() {
  const { t } = useTranslation()
  return (
    <ModuleCrud
      module="PARTNER"
      permission="MANAGE_PARTNER_REGISTRY"
      kicker={t('nav.section.legal')}
      title={t('ops.partners.title')}
      subtitle={t('ops.partners.subtitle')}
      createLabel={t('ops.partners.create')}
      archiveLabel={t('ops.partners.archive')}
    />
  )
}

export function CompliancePage() {
  const { t } = useTranslation()
  return (
    <ModuleCrud
      module="COMPLIANCE"
      permission="MANAGE_COMPLIANCE"
      kicker={t('nav.section.legal')}
      title={t('ops.compliance.title')}
      subtitle={t('ops.compliance.subtitle')}
      createLabel={t('ops.compliance.create')}
    />
  )
}

export function MarketingPage() {
  const { t } = useTranslation()
  return (
    <ModuleCrud
      module="MARKETING"
      permission="VIEW_MARKETING_PERFORMANCE"
      kicker={t('pages.media.kicker')}
      title={t('ops.marketing.title')}
      subtitle={t('ops.marketing.subtitle')}
      createLabel={t('ops.marketing.create')}
    />
  )
}

export function MediaLibraryPage() {
  const { t } = useTranslation()
  return (
    <ModuleCrud
      module="MEDIA"
      permission="MANAGE_MEDIA_LIBRARY"
      kicker={t('pages.media.kicker')}
      title={t('ops.media.title')}
      subtitle={t('ops.media.subtitle')}
      createLabel={t('ops.media.create')}
      archiveLabel={t('ops.media.archive')}
    />
  )
}

export function MonitoringPage() {
  const { t } = useTranslation()
  return (
    <ModuleCrud
      module="MONITORING"
      permission="VIEW_MONITORING"
      kicker={t('nav.section.tech')}
      title={t('ops.monitoring.title')}
      subtitle={t('ops.monitoring.subtitle')}
      createLabel={t('ops.monitoring.create')}
    />
  )
}

export function BugTicketsPage() {
  const { t } = useTranslation()
  return (
    <ModuleCrud
      module="BUG"
      permission="MANAGE_BUG_TICKETS"
      kicker={t('nav.section.tech')}
      title={t('ops.bugs.title')}
      subtitle={t('ops.bugs.subtitle')}
      createLabel={t('ops.bugs.create')}
    />
  )
}
