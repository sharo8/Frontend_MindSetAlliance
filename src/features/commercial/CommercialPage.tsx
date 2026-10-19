import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Bike, Building2, ChevronRight } from 'lucide-react'
import { Card, IconTile } from '../../components/ui/card'
import { PageHeader } from '../../components/ui/page-header'
import { Stagger, StaggerItem } from '../../components/motion/page-fade'
import { useActiveSociety } from '../../lib/projects/use-active-society'
import { RequirePermission } from '../../lib/rbac/RequirePermission'

export function CommercialPage() {
  const { t } = useTranslation()
  const { name } = useActiveSociety()
  const entries = [
    {
      to: '/commercial/coursiers',
      icon: <Bike />,
      tone: 'teal' as const,
      title: t('ops.couriers.title'),
      text: t('ops.couriers.subtitle'),
    },
    {
      to: '/commercial/entreprises',
      icon: <Building2 />,
      tone: 'indigo' as const,
      title: t('ops.enterprises.title'),
      text: t('ops.enterprises.subtitle'),
    },
  ]
  return (
    <RequirePermission permission="MANAGE_ENTERPRISE_ACCOUNTS">
      <div className="space-y-6">
        <PageHeader
          kicker={t('pages.commercial.kicker')}
          title={t('pages.commercial.title')}
          subtitle={t('opsui.commercial.subtitle', 'Validation des coursiers et comptes B2B de {{name}}.', { name })}
        />
        <p className="max-w-2xl text-[13.5px] leading-relaxed text-ink-3">
          {t('opsui.commercial.reserved', 'Espace réservé aux agents ayant le rôle Commercial.')}
        </p>
        <Stagger className="grid gap-4 md:grid-cols-2">
          {entries.map((entry) => (
            <StaggerItem key={entry.to} className="min-w-0">
              <Link to={entry.to} className="block rounded-[var(--radius-ma)] focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]">
                <Card interactive className="group flex items-center gap-4 p-5">
                  <IconTile tone={entry.tone} size="lg">
                    {entry.icon}
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-semibold tracking-[-0.02em] text-ink">{entry.title}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{entry.text}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-ink-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </RequirePermission>
  )
}
