import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard, KpiCard } from '../../components/ui/charts'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { CnnSourceBadge } from '../../components/ui/cnn-source-badge'
import { PageHeader } from '../../components/ui/page-header'
import { ScopeEmpty } from '../../components/ui/scope-empty'
import { fetchFinanceDashboard, type FinanceMoney } from '../../lib/api/ops'
import { useProjectStore } from '../../lib/projects/project-store'
import { RequirePermission } from '../../lib/rbac/RequirePermission'

const COLORS = ['#e0a721', '#16215c', '#f97316', '#22c55e', '#2563eb', '#7c3aed', '#0891b2']

function formatAmount(value: number, lang: string) {
  return new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(value)
}

function formatDay(iso: string, lang: string) {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(year, month - 1, day))
}

function formatMonth(iso: string, lang: string) {
  const [year, month] = iso.split('-').map(Number)
  if (!year || !month) return iso
  return new Intl.DateTimeFormat(lang, { month: 'short', year: '2-digit' }).format(new Date(year, month - 1, 1))
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
  const currency = (devise: string | null | undefined, stored?: boolean) =>
    stored && devise ? devise : t('cnn.finance.currencyUnknown')

  return (
    <RequirePermission permission="VIEW_FINANCE">
      <div className="space-y-4">
        <PageHeader kicker={t('pages.finance.kicker')} title={t('pages.finance.title')} subtitle={t('pages.finance.subtitle')} />
        {cnn && (d || dash.isError) && (
          <CnnSourceBadge source={d?.source} ageSecondes={d?.ageSecondes} message={d?.message} readOnlyVerified={d?.readOnlyVerified} />
        )}
        {cnn && d?.source !== 'CNN_DB' && !dash.isLoading && (
          <ScopeEmpty context={t('cnn.source.downDetail')} />
        )}
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
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label={t('cnn.finance.monthReceipts')} value={Math.round(Number(d?.recettesMois ?? 0))} accent="ok" />
              <KpiCard label={t('cnn.finance.expenses')} value={Math.round(Number(d?.depensesMois ?? 0))} accent="warn" />
              <KpiCard label={t('cnn.finance.overdue')} value={d?.facturesRetard ?? 0} accent="info" />
              <KpiCard label={t('cnn.finance.treasury')} value={Math.round(Number(d?.tresorerie ?? 0))} accent="gold" />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <ChartCard title={t('cnn.finance.coreSeries')}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d?.comparaison6m ?? []}>
                      <XAxis dataKey="mois" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="recettes" fill="#e0a721" radius={4} />
                      <Bar dataKey="depenses" fill="#16215c" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
              <ChartCard title={t('cnn.finance.channels')}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={d?.parCanal ?? []} dataKey="montant" nameKey="canal" innerRadius={48} outerRadius={78}>
                      {(d?.parCanal ?? []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
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
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((row) => {
          const unit = currency(row.devise, row.deviseStockee)
          const hint = row.mois === 0
            ? row.dernier
              ? t('cnn.finance.noCollection', { date: formatDay(row.dernier, lang) })
              : t('cnn.finance.noCollectionEver')
            : t('cnn.finance.totalHint', { total: formatAmount(row.total, lang), unit })
          return (
            <Card key={unit}>
              <CardBody>
                <p className="text-xs uppercase tracking-wide text-ma-muted">{t('cnn.finance.subscriptions')}</p>
                <p className="mt-2 text-3xl font-semibold tabular-nums">{formatAmount(row.mois, lang)}</p>
                <p className="text-sm text-ma-muted">{unit}</p>
                <p className="mt-1 text-sm text-ma-navy-900 dark:text-ma-gold-300">{hint}</p>
              </CardBody>
            </Card>
          )
        })}
        {groups.length === 0 && (
          <Card>
            <CardBody>
              <p className="text-xs uppercase tracking-wide text-ma-muted">{t('cnn.finance.subscriptions')}</p>
              <p className="mt-2 text-sm text-ma-navy-900 dark:text-ma-gold-300">{t('cnn.finance.noCollectionEver')}</p>
            </CardBody>
          </Card>
        )}
        {volume && (
          <Card>
            <CardBody>
              <p className="text-xs uppercase tracking-wide text-ma-muted">{t('cnn.finance.volume')}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">{formatAmount(volume.montant, lang)}</p>
              <p className="text-sm text-ma-muted">{currency(volume.devise, volume.deviseStockee)}</p>
              <p className="mt-1 text-sm">{t('cnn.finance.volumeHint')}</p>
              <p className="mt-1 text-sm text-ma-muted">
                {t('cnn.finance.pricedCourses', { priced: volume.coursesAvecMontant, total: volume.courses })}
              </p>
            </CardBody>
          </Card>
        )}
      </div>
      {groups.map((row) => {
        const unit = currency(row.devise, row.deviseStockee)
        const bars = serie.map((point) => ({
          mois: formatMonth(point.mois, lang),
          montant: point.montants?.find((part) => (part.devise ?? null) === (row.devise ?? null))?.montant ?? 0,
        }))
        const slices = canals
          .filter((canal) => (canal.devise ?? null) === (row.devise ?? null))
          .map((canal) => ({ ...canal, label: t(`cnn.channel.${canal.canal}`, { defaultValue: canal.canal }) }))
        const total = slices.reduce((sum, slice) => sum + Number(slice.montant ?? 0), 0)
        return (
          <div key={`charts-${unit}`} className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ChartCard title={`${t('cnn.finance.series')} · ${unit}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bars}>
                    <XAxis dataKey="mois" />
                    <YAxis width={88} tick={{ fontSize: 11 }} label={{ value: unit, angle: -90, position: 'insideLeft', fontSize: 11 }} />
                    <Tooltip
                      formatter={(value) => [`${formatAmount(Number(value), lang)} ${unit}`, t('cnn.finance.amount')]}
                    />
                    <Bar dataKey="montant" fill="#e0a721" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
            <Card>
              <CardHeader>
                <h2 className="font-semibold">{t('cnn.finance.channels')}</h2>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="relative mx-auto h-[160px] w-[160px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={slices.length ? slices : [{ label: unit, montant: 0 }]} dataKey="montant" nameKey="label" innerRadius={48} outerRadius={72}>
                        {(slices.length ? slices : [{ label: unit }]).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${formatAmount(Number(value), lang)} ${unit}`, t('cnn.finance.amount')]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <p className="text-lg font-semibold tabular-nums">{formatAmount(total, lang)}</p>
                    <p className="text-[10px] uppercase tracking-wide text-ma-muted">{t('cnn.finance.center')}</p>
                  </div>
                </div>
                <ul className="space-y-1 text-sm">
                  {slices.map((slice) => (
                    <li key={slice.canal} className="flex min-w-0 items-center gap-2" title={slice.label}>
                      <span className="min-w-0 flex-1 truncate">{slice.label}</span>
                      <span className="shrink-0 tabular-nums">{formatAmount(slice.montant, lang)}</span>
                      <span className="w-10 shrink-0 text-right tabular-nums text-ma-muted">
                        {total ? Math.round((slice.montant / total) * 100) : 0}%
                      </span>
                    </li>
                  ))}
                  {slices.length === 0 && <li className="text-ma-muted">{t('cnn.finance.noCollectionEver')}</li>}
                </ul>
              </CardBody>
            </Card>
          </div>
        )
      })}
      <Card>
        <CardHeader>
          <h2 className="font-semibold">{t('cnn.finance.refunds')}</h2>
        </CardHeader>
        <CardBody className="space-y-1 text-sm">
          {(refunds ?? []).map((row) => (
            <p key={row.statut} className="flex justify-between gap-3">
              <span>{t(`cnn.refund.${row.statut}`, { defaultValue: row.statut })}</span>
              <span className="tabular-nums">
                {row.nombre}
                {row.montant == null ? ` · ${t('cnn.finance.refundAmountMissing')}` : ` · ${formatAmount(row.montant, lang)}`}
              </span>
            </p>
          ))}
          {(refunds ?? []).length === 0 && <p>{t('cnn.finance.noRefunds')}</p>}
        </CardBody>
      </Card>
    </>
  )
}
