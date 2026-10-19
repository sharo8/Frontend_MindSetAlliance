import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BadgeCheck, CalendarClock, ChevronRight, FileClock, Info, Users, Wallet } from 'lucide-react'
import { ChartFrame, ChartSummary } from '../../components/charts/chart-kit'
import { Feedback } from '../../components/ui/feedback'
import { PageHeader } from '../../components/ui/page-header'
import { StatCard } from '../../components/ui/stat-card'
import { SectionCard } from '../../components/ui/toolbar'
import { Stagger, StaggerItem } from '../../components/motion/page-fade'
import { fetchRhDashboard } from '../../lib/api/ops'
import { ApiError } from '../../lib/api/client'
import { useProjectStore } from '../../lib/projects/project-store'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { MetricRow, RankedBars, StatSkeletons } from '../ops/charts'

export function HrPage() {
  const { t } = useTranslation()
  const currentProject = useProjectStore((s) => s.currentProject)
  const dash = useQuery({
    queryKey: ['rh-dash', currentProject],
    queryFn: () => fetchRhDashboard(currentProject === 'ENTREPRISE' ? undefined : currentProject),
  })
  const d = dash.data
  const departments = [...(d?.parDepartement ?? [])]
    .map((row) => ({ label: row.departement, value: Number(row.effectif ?? 0) }))
    .sort((a, b) => b.value - a.value)
  const pending = d?.congesAttente ?? 0
  const expiring = d?.contratsEcheance ?? 0
  return (
    <RequirePermission permission="MANAGE_HR">
      <div className="space-y-6">
        <PageHeader kicker={t('pages.hr.kicker')} title={t('pages.hr.title')} subtitle={t('pages.hr.subtitle')} />
        {dash.isError && <Feedback tone="danger">{dash.error instanceof ApiError ? dash.error.message : t('crud.loadFail')}</Feedback>}
        {dash.isLoading ? (
          <StatSkeletons />
        ) : (
          <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 [&>*>*]:h-full">
            <StaggerItem>
              <StatCard label={t('opsui.hr.headcount', 'Effectif total')} value={d?.effectif ?? 0} accent="gold" icon={<Users />} />
            </StaggerItem>
            <StaggerItem>
              <StatCard label={t('opsui.hr.presence', 'Présence du mois')} value={d?.presence ?? 0} suffix="%" accent="ok" icon={<BadgeCheck />} />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label={t('opsui.hr.pendingLeaves', 'Congés en attente')}
                value={pending}
                accent="warn"
                icon={<CalendarClock />}
                hint={pending ? t('opsui.hr.toValidate', 'À valider') : t('opsui.hr.nothingPending', 'Rien en attente')}
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                label={t('opsui.hr.expiringContracts', 'Contrats à échéance')}
                value={expiring}
                accent="info"
                icon={<FileClock />}
              />
            </StaggerItem>
          </Stagger>
        )}
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ChartFrame
            title={t('opsui.hr.byDepartment', 'Effectifs par département')}
            subtitle={t('opsui.hr.byDepartmentHint', 'Agents actifs, du plus grand au plus petit')}
            summary={departments.length ? <ChartSummary label={t('opsui.hr.departments', 'Départements')} value={departments.length} /> : undefined}
            loading={dash.isLoading}
            empty={!dash.isLoading && departments.length === 0}
            emptyMessage={t('opsui.hr.noDepartments', 'Aucun département avec des agents actifs.')}
            className="min-h-[220px]"
          >
            <RankedBars rows={departments} />
          </ChartFrame>
          <SectionCard title={t('opsui.hr.attention', 'Points d’attention')} icon={<CalendarClock />} tone="gold">
            <MetricRow label={t('opsui.hr.pendingLeaves', 'Congés en attente')} value={pending} tone={pending ? 'warning' : undefined} hint={t('opsui.hr.twoLevels', 'Validation à deux niveaux')} />
            <MetricRow label={t('opsui.hr.expiringContracts', 'Contrats à échéance')} value={expiring} tone={expiring ? 'warning' : undefined} />
            <MetricRow label={t('opsui.hr.presence', 'Présence du mois')} value={`${d?.presence ?? 0} %`} />
            <Link
              to="/rh/conges"
              className="press mt-4 flex h-10 items-center justify-between rounded-[13px] bg-ma-gold-500/12 px-4 text-[13.5px] font-semibold text-accent-ink transition-colors hover:bg-ma-gold-500/18 focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)] dark:bg-ma-gold-400/12"
            >
              {t('opsui.hr.openLeaves', 'Ouvrir les demandes de congé')}
              <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
            </Link>
          </SectionCard>
        </div>
      </div>
    </RequirePermission>
  )
}

export function PayrollPage() {
  const { t } = useTranslation()
  const currentProject = useProjectStore((s) => s.currentProject)
  const dash = useQuery({
    queryKey: ['rh-dash', currentProject],
    queryFn: () => fetchRhDashboard(currentProject === 'ENTREPRISE' ? undefined : currentProject),
  })
  return (
    <RequirePermission permission="VIEW_PAYROLL">
      <div className="space-y-6">
        <PageHeader
          kicker={t('pages.payroll.kicker')}
          title={t('pages.payroll.title')}
          subtitle={t('opsui.payroll.subtitle', 'Consultation des indicateurs de rémunération. Aucune suppression possible.')}
        />
        {dash.isLoading ? (
          <StatSkeletons count={2} />
        ) : (
          <Stagger className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 [&>*>*]:h-full">
            <StaggerItem>
              <StatCard label={t('opsui.payroll.paid', 'Effectif payé (actif)')} value={dash.data?.effectif ?? 0} accent="gold" icon={<Wallet />} />
            </StaggerItem>
            <StaggerItem className="xl:col-span-2">
              <SectionCard title={t('opsui.payroll.whereTitle', 'Où trouver les bulletins ?')} icon={<Info />} tone="neutral" className="h-full">
                <p className="text-[13.5px] leading-relaxed text-ink-2">
                  {t('opsui.payroll.where', 'Les bulletins de paie restent dans le module paie du Core. Cette page n’affiche que les indicateurs agrégés.')}
                </p>
              </SectionCard>
            </StaggerItem>
          </Stagger>
        )}
      </div>
    </RequirePermission>
  )
}
