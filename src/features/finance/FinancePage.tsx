import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Banknote, Briefcase, Landmark, TrendingDown, Undo2, Wallet } from 'lucide-react'
import { DashboardDonutChart } from '../../components/charts/DashboardDonutChart'
import { ChartSummary } from '../../components/charts/chart-kit'
import { Badge } from '../../components/ui/badge'
import { CnnSourceBadge } from '../../components/ui/cnn-source-badge'
import { Feedback } from '../../components/ui/feedback'
import { PageHeader } from '../../components/ui/page-header'
import { EmptyState, ScopeEmpty } from '../../components/ui/scope-empty'
import { StatCard } from '../../components/ui/stat-card'
import { SectionCard } from '../../components/ui/toolbar'
import { Segmented } from '../../components/ui/segmented'
import { Stagger, StaggerItem } from '../../components/motion/page-fade'
import { fetchFinanceDashboard, type FinanceMoney } from '../../lib/api/ops'
import { ApiError } from '../../lib/api/client'
import { useProjectStore } from '../../lib/projects/project-store'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { GroupedBarChart, MetricRow, StatSkeletons, compact, foldSlices } from '../ops/charts'

function formatAmount(value: number, lang: string) {
  return new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(value)
}

function formatDay(iso: string, lang: string) {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(year, month - 1, day))
}

function formatMonth(iso: string, lang: string) {
  const [year, month] = iso.split('-').map(Number)
  if (!year || !month) return iso
  return new Intl.DateTimeFormat(lang, { month: 'short', year: '2-digit' }).format(new Date(year, month - 1, 1))
}

const REFUND_TONE: Record<string, 'warning' | 'info' | 'success' | 'danger'> = {
  PENDING: 'warning',
  APPROVED: 'info',
  COMPLETED: 'success',
  REJECTED: 'danger',
}

export function FinancePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language || 'fr'
  const currentProject = useProjectStore((s) => s.currentProject)
  const dash = useQuery({
    queryKey: ['fin-dash', currentProject],
    queryFn: () => fetchFinanceDashboard(currentProject === 'ENTREPRISE' ? undefined : currentProject),
    refetchInterval: currentProject === 'CNN' ? 10_000 : false,
  })
  const d = dash.data
  const cnn = currentProject === 'CNN'
  const currency = (devise: string | null | undefined, stored?: boolean) => (stored && devise ? devise : t('cnn.finance.currencyUnknown'))
  const fmt = (n: number) => formatAmount(Math.round(n), lang)
  const currencies = [...new Set((d?.parCanal ?? []).filter((row) => row.deviseStockee && row.devise).map((row) => row.devise as string))]
  const [devise, setDevise] = useState<string | null>(null)
  const activeDevise = devise && currencies.includes(devise) ? devise : (currencies[0] ?? null)
  const channelSlices = foldSlices(
    (d?.parCanal ?? [])
      .filter((row) => currencies.length < 2 || (row.deviseStockee ? row.devise : null) === activeDevise)
      .map((row) => ({ label: t(`cnn.channel.${row.canal}`, { defaultValue: row.canal }), valeur: Number(row.montant ?? 0) })),
    6,
    t('opsui.charts.other', 'Autres'),
  )
  const comparison = (d?.comparaison6m ?? []).map((row) => ({ mois: row.mois, recettes: row.recettes, depenses: row.depenses ?? 0 }))

  return (
    <RequirePermission permission="VIEW_FINANCE">
      <div className="space-y-6">
        <PageHeader kicker={t('pages.finance.kicker')} title={t('pages.finance.title')} subtitle={t('pages.finance.subtitle')} />
        {cnn && (d || dash.isError) && (
          <div className="max-w-full [&>p]:h-auto [&>p]:min-h-7 [&>p]:rounded-[14px] [&>p]:py-1 [&>p]:leading-snug sm:[&>p]:rounded-full"><CnnSourceBadge source={d?.source} ageSecondes={d?.ageSecondes} message={d?.message} readOnlyVerified={d?.readOnlyVerified} /></div>
        )}
        {dash.isError && !cnn && (
          <Feedback tone="danger">{dash.error instanceof ApiError ? dash.error.message : t('crud.loadFail')}</Feedback>
        )}
        {cnn && dash.isLoading && <StatSkeletons count={3} />}
        {cnn && d?.source !== 'CNN_DB' && !dash.isLoading && <ScopeEmpty context={t('cnn.source.downDetail')} />}
        {cnn && d?.source === 'CNN_DB' && (
          <CnnFinance
            money={d.recettesParDevise ?? []}
            serie={d.serie6m ?? []}
            canals={d.parCanal ?? []}
            refunds={d.remboursements}
            volume={d.volumeAffaires}
            lang={lang}
            currency={currency}
          />
        )}
        {!cnn && (
          <>
            {dash.isLoading ? (
              <StatSkeletons />
            ) : (
              <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 [&>*>*]:h-full">
                <StaggerItem>
                  <StatCard label={t('cnn.finance.monthReceipts')} value={Math.round(Number(d?.recettesMois ?? 0))} accent="ok" icon={<Wallet />} />
                </StaggerItem>
                <StaggerItem>
                  <StatCard label={t('cnn.finance.expenses')} value={Math.round(Number(d?.depensesMois ?? 0))} accent="warn" icon={<TrendingDown />} />
                </StaggerItem>
                <StaggerItem>
                  <StatCard
                    label={t('cnn.finance.overdue')}
                    value={d?.facturesRetard ?? 0}
                    accent={(d?.facturesRetard ?? 0) > 0 ? 'danger' : 'info'}
                    icon={<AlertTriangle />}
                    hint={(d?.facturesRetard ?? 0) > 0 ? t('opsui.finance.overdueHint', 'À relancer en priorité') : t('opsui.finance.overdueNone', 'Aucune relance à faire')}
                  />
                </StaggerItem>
                <StaggerItem>
                  <StatCard label={t('cnn.finance.treasury')} value={Math.round(Number(d?.tresorerie ?? 0))} accent="gold" icon={<Landmark />} />
                </StaggerItem>
              </Stagger>
            )}
            <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="h-[400px] min-w-0">
                <GroupedBarChart
                  className="h-full"
                  title={t('cnn.finance.coreSeries')}
                  subtitle={t('opsui.finance.sixMonths', 'Six derniers mois')}
                  data={comparison}
                  xKey="mois"
                  series={[
                    { key: 'recettes', label: t('opsui.finance.receipts', 'Recettes') },
                    { key: 'depenses', label: t('cnn.finance.expenses') },
                  ]}
                  format={fmt}
                  loading={dash.isLoading}
                />
              </div>
              <div className="relative h-[400px] min-w-0">
                {currencies.length > 1 && activeDevise && (
                  <Segmented
                    size="sm"
                    className="absolute right-5 top-4 z-[1] sm:right-6"
                    ariaLabel={t('opsui.finance.currency', 'Devise')}
                    value={activeDevise}
                    onChange={setDevise}
                    options={currencies.map((c) => ({ value: c, label: c }))}
                  />
                )}
                <DashboardDonutChart
                  className="h-full"
                  subtitle={activeDevise ? t('opsui.finance.inCurrency', 'En {{unit}}', { unit: activeDevise }) : undefined}
                  title={t('cnn.finance.channels')}
                  data={channelSlices}
                  loading={dash.isLoading}
                  centerLabel={t('cnn.finance.center')}
                  centerValue={compact(channelSlices.reduce((s, x) => s + x.valeur, 0))}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </RequirePermission>
  )
}

function CnnFinance({
  money,
  serie,
  canals,
  refunds,
  volume,
  lang,
  currency,
}: {
  money: FinanceMoney[]
  serie: { mois: string; montants?: { devise: string | null; deviseStockee: boolean; montant: number }[] }[]
  canals: { canal: string; montant: number; devise?: string | null; deviseStockee?: boolean }[]
  refunds?: { statut: string; nombre: number; montant: number | null }[] | null
  volume?: {
    montant: number
    courses: number
    coursesAvecMontant: number
    devise: string | null
    deviseStockee: boolean
  } | null
  lang: string
  currency: (devise: string | null | undefined, stored?: boolean) => string
}) {
  const { t } = useTranslation()
  const groups = money.length ? money : []
  const fmt = (n: number) => formatAmount(n, lang)
  return (
    <>
      <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 [&>*>*]:h-full">
        {groups.map((row) => {
          const unit = currency(row.devise, row.deviseStockee)
          const hint =
            row.mois === 0
              ? row.dernier
                ? t('opsui.finance.noCollection', 'Aucun encaissement ce mois-ci. Dernier règlement le {{date}}.', { date: formatDay(row.dernier, lang) })
                : t('cnn.finance.noCollectionEver')
              : t('cnn.finance.totalHint', { total: formatAmount(row.total, lang), unit })
          return (
            <StaggerItem key={unit}>
              <StatCard
                label={`${t('cnn.finance.subscriptions')} · ${t('opsui.finance.thisMonth', 'ce mois-ci')}`}
                value={row.mois}
                format={(n) => formatAmount(Math.round(n), lang)}
                suffix={unit}
                hint={hint}
                accent="gold"
                icon={<Banknote />}
              />
            </StaggerItem>
          )
        })}
        {groups.length === 0 && (
          <StaggerItem>
            <StatCard label={t('cnn.finance.subscriptions')} value={0} hint={t('cnn.finance.noCollectionEver')} accent="gold" icon={<Banknote />} />
          </StaggerItem>
        )}
        {volume && (
          <StaggerItem>
            <StatCard
              label={t('cnn.finance.volume')}
              value={volume.montant}
              format={(n) => formatAmount(Math.round(n), lang)}
              suffix={currency(volume.devise, volume.deviseStockee)}
              accent="info"
              icon={<Briefcase />}
              hint={
                <>
                  {t('cnn.finance.pricedCourses', { priced: volume.coursesAvecMontant, total: volume.courses })}
                  <span className="mt-1 block text-ink-3/90">{t('cnn.finance.volumeHint')}</span>
                </>
              }
            />
          </StaggerItem>
        )}
      </Stagger>
      {groups.map((row, index) => {
        const unit = currency(row.devise, row.deviseStockee)
        const bars = serie.map((point) => ({
          mois: formatMonth(point.mois, lang),
          montant: point.montants?.find((part) => (part.devise ?? null) === (row.devise ?? null))?.montant ?? 0,
        }))
        const slices = foldSlices(
          canals
            .filter((canal) => (canal.devise ?? null) === (row.devise ?? null))
            .map((canal) => ({ label: t(`cnn.channel.${canal.canal}`, { defaultValue: canal.canal }), valeur: Number(canal.montant ?? 0) })),
          6,
          t('opsui.charts.other', 'Autres'),
        )
        const total = slices.reduce((sum, slice) => sum + slice.valeur, 0)
        const sixMonths = bars.reduce((sum, bar) => sum + bar.montant, 0)
        return (
          <div key={`charts-${unit}`} className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="h-[420px] min-w-0">
              <GroupedBarChart
                className="h-full"
                title={t('opsui.finance.series', 'Encaissements sur 6 mois')}
                subtitle={t('opsui.finance.inCurrency', 'En {{unit}}', { unit })}
                summary={<ChartSummary label={t('cnn.finance.center')} value={`${compact(sixMonths)} ${unit}`} />}
                data={bars}
                xKey="mois"
                series={[{ key: 'montant', label: t('cnn.finance.amount') }]}
                format={(n) => `${fmt(n)} ${unit}`}
              />
            </div>
            <div className="h-[420px] min-w-0">
              <DashboardDonutChart
                className="h-full"
                title={t('cnn.finance.channels')}
                subtitle={t('opsui.finance.inCurrency', 'En {{unit}}', { unit })}
                data={slices}
                centerLabel={t('cnn.finance.center')}
                centerValue={compact(total)}
                key={`${unit}-${index}`}
              />
            </div>
          </div>
        )
      })}
      <SectionCard title={t('cnn.finance.refunds')} icon={<Undo2 />} tone="coral" subtitle={t('opsui.finance.refundsHint', 'Demandes lues dans la base Colis na Nga')}>
        {(refunds ?? []).length === 0 ? (
          <EmptyState icon={<Undo2 />} title={t('cnn.finance.noRefunds')} />
        ) : (
          <div className="grid gap-x-8 sm:grid-cols-2">
            {(refunds ?? []).map((row) => (
              <MetricRow
                key={row.statut}
                label={
                  <Badge tone={REFUND_TONE[row.statut] ?? 'muted'} dot>
                    {t(`cnn.refund.${row.statut}`, { defaultValue: row.statut })}
                  </Badge>
                }
                hint={row.montant == null ? t('cnn.finance.refundAmountMissing') : t('opsui.finance.refundAmount', 'Montant : {{amount}}', { amount: formatAmount(row.montant, lang) })}
                value={row.nombre}
              />
            ))}
          </div>
        )}
      </SectionCard>
    </>
  )
}
