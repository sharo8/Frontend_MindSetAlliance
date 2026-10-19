import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowUpRight, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { Segmented } from '../../components/ui/segmented'
import { Skeleton } from '../../components/ui/skeleton'
import { ChartFrame, ChartSummary, GlassTooltip, axisTick, useViz } from '../../components/charts/chart-kit'
import { DashboardDonutChart } from '../../components/charts/DashboardDonutChart'
import { fetchCnnStatistiques } from '../../lib/api/cnnAdmin'
import { cn } from '../../lib/utils'
import { CnnAdminHeader, relayErrorMessage, useLocaleTag } from './shared'

type Period = '7' | '30' | '90' | '365'

const yTick = (v: number) => (v >= 1_000_000 ? `${Math.round(v / 100_000) / 10}M` : v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))

/** Statistiques Colis na Nga : toutes les données de l'application, en graphiques, sur une période. */
export function CnnStatsPage() {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const viz = useViz()
  const [period, setPeriod] = useState<Period>('30')
  const stats = useQuery({ queryKey: ['cnn-stats', period], queryFn: () => fetchCnnStatistiques(Number(period)), staleTime: 60_000, placeholderData: keepPreviousData })
  const s = stats.data
  const loading = stats.isLoading
  const monthly = s?.periode.granularite === 'mois'

  const fmtN = (n: number | null | undefined, digits = 0) => (n == null ? '–' : Number(n).toLocaleString(locale, { maximumFractionDigits: digits }))
  const fmtFc = (n: number | null | undefined) => (n == null ? '–' : `${Math.round(Number(n)).toLocaleString(locale)} FC`)
  const dayLabel = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`)
    return monthly
      ? d.toLocaleDateString(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' })
      : d.toLocaleDateString(locale, { day: '2-digit', month: 'short', timeZone: 'UTC' })
  }
  const dayTitle = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`)
    return monthly
      ? d.toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
      : d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  }

  const serie = useMemo(
    () => (s?.serie ?? []).map((r) => ({ ...r, autres: Math.max(0, r.creees - r.livrees - r.annulees), label: dayLabel(r.date) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, locale],
  )
  const label = (prefix: string, key: string) => t(`${prefix}.${key}`, { defaultValue: key })
  const kv = (rows: { cle: string; valeur: number }[] | null | undefined, prefix: string) => (rows ?? []).map((r) => ({ label: label(prefix, r.cle), value: r.valeur }))

  const k = s?.kpis
  const p = s?.kpisPrecedents
  const periodLabel = { '7': t('cnnStats.p7', '7 derniers jours'), '30': t('cnnStats.p30', '30 derniers jours'), '90': t('cnnStats.p90', '90 derniers jours'), '365': t('cnnStats.p365', '12 derniers mois') }[period]

  return (
    <div className="space-y-6">
      <CnnAdminHeader
        title={t('cnnStats.title', 'Statistiques')}
        subtitle={t('cnnStats.subtitle', 'Toute l’activité de Colis na Nga en graphiques, lue en direct dans sa base.')}
        actions={
          <>
            <Segmented<Period>
              size="sm"
              value={period}
              onChange={setPeriod}
              ariaLabel={t('cnnStats.period', 'Période')}
              options={[
                { value: '7', label: t('cnnStats.s7', '7 j') },
                { value: '30', label: t('cnnStats.s30', '30 j') },
                { value: '90', label: t('cnnStats.s90', '90 j') },
                { value: '365', label: t('cnnStats.s365', '12 mois') },
              ]}
            />
            <Button variant="ghost" size="sm" onClick={() => stats.refetch()} disabled={stats.isFetching} aria-label={t('cnnStats.refresh', 'Actualiser')}>
              <RefreshCw className={cn('h-4 w-4', stats.isFetching && 'animate-spin')} />
            </Button>
          </>
        }
      />
      {stats.isError && <Feedback tone="danger">{relayErrorMessage(stats.error, (key, v) => t(key, v))}</Feedback>}

      <p className="-mt-2 text-[12.5px] text-ink-3">
        {periodLabel}
        {s && ` · ${t('cnnStats.compared', 'comparé à la période précédente de même durée')}`}
      </p>

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi loading={loading} label={t('cnnStats.kOrders', 'Commandes créées')} value={fmtN(k?.commandes)} now={k?.commandes} before={p?.commandes} />
        <Kpi loading={loading} label={t('cnnStats.kDelivered', 'Livrées')} value={fmtN(k?.livrees)} hint={k?.tauxLivraison != null ? t('cnnStats.rate', '{{n}} % des commandes', { n: fmtN(k.tauxLivraison, 1) }) : undefined} now={k?.livrees} before={p?.livrees} />
        <Kpi loading={loading} label={t('cnnStats.kRevenue', 'Chiffre livré')} value={fmtFc(k?.chiffreLivre)} now={k?.chiffreLivre} before={p?.chiffreLivre} />
        <Kpi loading={loading} label={t('cnnStats.kBasket', 'Panier moyen')} value={fmtFc(k?.panierMoyen)} hint={k?.distanceMoyenne != null ? t('cnnStats.avgDistance', '{{n}} km en moyenne', { n: fmtN(k.distanceMoyenne, 1) }) : undefined} now={k?.panierMoyen} before={p?.panierMoyen} />
        <Kpi loading={loading} label={t('cnnStats.kClients', 'Nouveaux clients')} value={fmtN(k?.nouveauxClients)} now={k?.nouveauxClients} before={p?.nouveauxClients} />
        <Kpi loading={loading} label={t('cnnStats.kCredits', 'Crédits vendus')} value={fmtN(k?.creditsVendus)} hint={fmtFc(k?.revenusCredits)} now={k?.creditsVendus} before={p?.creditsVendus} />
        <Kpi loading={loading} label={t('cnnStats.kSubs', 'Revenus abonnements')} value={fmtFc(k?.revenusAbonnements)} now={k?.revenusAbonnements} before={p?.revenusAbonnements} />
        <Kpi
          loading={loading}
          label={t('cnnStats.kRating', 'Note moyenne')}
          value={k?.noteMoyenne != null ? `${fmtN(k.noteMoyenne, 2)} / 5` : '–'}
          hint={t('cnnStats.incidents', '{{u}} urgences · {{s}} signalements', { u: fmtN(k?.urgences), s: fmtN(k?.signalements) })}
          now={k?.noteMoyenne}
          before={p?.noteMoyenne}
        />
      </div>

      {/* Commandes et chiffre d'affaires */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ChartFrame
          className="min-h-[340px]"
          title={t('cnnStats.ordersTitle', 'Commandes')}
          subtitle={monthly ? t('cnnStats.perMonth', 'Par mois de création') : t('cnnStats.perDay', 'Par jour de création')}
          loading={loading}
          empty={!loading && serie.every((r) => r.creees === 0)}
          emptyMessage={t('cnnStats.empty', 'Aucune donnée sur cette période')}
          summary={!loading ? <ChartSummary label={t('cnnStats.total', 'Total')} value={fmtN(k?.commandes)} /> : undefined}
        >
          <Legend items={[{ color: viz.series[2], label: t('cnnStats.delivered', 'Livrées') }, { color: viz.series[0], label: t('cnnStats.other', 'En cours ou en attente') }, { color: viz.series[4], label: t('cnnStats.cancelled', 'Annulées') }]} />
          <div className="min-h-[220px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={viz.grid} vertical={false} />
                <XAxis dataKey="label" tick={axisTick(viz.axis)} axisLine={false} tickLine={false} dy={6} interval="preserveStartEnd" minTickGap={16} />
                <YAxis allowDecimals={false} width={36} tick={axisTick(viz.axis)} axisLine={false} tickLine={false} tickFormatter={yTick} />
                <Tooltip
                  cursor={{ fill: viz.dark ? 'rgba(255,255,255,0.04)' : 'rgba(17,27,63,0.04)' }}
                  content={({ active, payload }) => {
                    const r = payload?.[0]?.payload as (typeof serie)[number] | undefined
                    return (
                      <GlassTooltip
                        active={active}
                        title={r ? dayTitle(r.date) : ''}
                        rows={[
                          { color: viz.series[2], label: t('cnnStats.delivered', 'Livrées'), value: fmtN(r?.livrees) },
                          { color: viz.series[0], label: t('cnnStats.other', 'En cours ou en attente'), value: fmtN(r?.autres) },
                          { color: viz.series[4], label: t('cnnStats.cancelled', 'Annulées'), value: fmtN(r?.annulees) },
                          { label: t('cnnStats.total', 'Total'), value: fmtN(r?.creees) },
                        ]}
                      />
                    )
                  }}
                />
                <Bar dataKey="livrees" stackId="a" fill={viz.series[2]} stroke={viz.surface} strokeWidth={1} maxBarSize={28} />
                <Bar dataKey="autres" stackId="a" fill={viz.series[0]} stroke={viz.surface} strokeWidth={1} maxBarSize={28} />
                <Bar dataKey="annulees" stackId="a" fill={viz.series[4]} stroke={viz.surface} strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>

        <ChartFrame
          className="min-h-[340px]"
          title={t('cnnStats.revenueTitle', 'Chiffre d’affaires livré')}
          subtitle={t('cnnStats.revenueSub', 'Prix des commandes livrées, en francs congolais')}
          loading={loading}
          empty={!loading && serie.every((r) => Number(r.chiffre) === 0)}
          emptyMessage={t('cnnStats.empty', 'Aucune donnée sur cette période')}
          summary={!loading ? <ChartSummary label={t('cnnStats.total', 'Total')} value={fmtFc(k?.chiffreLivre)} /> : undefined}
        >
          <div className="min-h-[220px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cnn-rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={viz.series[1]} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={viz.series[1]} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={viz.grid} vertical={false} />
                <XAxis dataKey="label" tick={axisTick(viz.axis)} axisLine={false} tickLine={false} dy={6} interval="preserveStartEnd" minTickGap={16} />
                <YAxis width={44} tick={axisTick(viz.axis)} axisLine={false} tickLine={false} tickFormatter={yTick} />
                <Tooltip
                  cursor={{ stroke: viz.axis, strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    const r = payload?.[0]?.payload as (typeof serie)[number] | undefined
                    return <GlassTooltip active={active} title={r ? dayTitle(r.date) : ''} rows={[{ color: viz.series[1], label: t('cnnStats.revenue', 'Chiffre livré'), value: fmtFc(r?.chiffre) }]} />
                  }}
                />
                <Area type="monotone" dataKey="chiffre" stroke={viz.series[1]} strokeWidth={2} fill="url(#cnn-rev)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: viz.surface }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>
      </div>

      {/* Répartitions */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <RankCard loading={loading} title={t('cnnStats.byStatus', 'Statut des commandes')} subtitle={t('cnnStats.byStatusSub', 'Commandes créées sur la période, statut actuel')} rows={kv(s?.parStatut, 'cnnAdmin.orderStatus')} color={viz.series[0]} />
        <DashboardDonutChart
          className="min-h-[340px]"
          loading={loading}
          title={t('cnnStats.byCourier', 'Qui livre ?')}
          subtitle={t('cnnStats.byCourierSub', 'Livreurs Colis na Nga ou motards partenaires')}
          data={donut(kv(s?.parCoursier, 'cnnStats.courier'), t('cnnStats.others', 'Autres'))}
          centerLabel={t('cnnStats.orders', 'Commandes')}
        />
        <DashboardDonutChart
          className="min-h-[340px]"
          loading={loading}
          title={t('cnnStats.byParcel', 'Types de colis')}
          data={donut(kv(s?.parTypeColis, 'cnnStats.parcel'), t('cnnStats.others', 'Autres'))}
          centerLabel={t('cnnStats.orders', 'Commandes')}
        />
        <RankCard loading={loading} title={t('cnnStats.byPayment', 'Modes de paiement')} subtitle={t('cnnStats.byPaymentSub', 'Choisis par les clients à la commande')} rows={kv(s?.parPaiement, 'cnnStats.payment')} color={viz.series[5]} />
        <SimpleBars
          loading={loading}
          title={t('cnnStats.byHour', 'Heures de pointe')}
          subtitle={t('cnnStats.byHourSub', 'Commandes par heure de la journée (Kinshasa)')}
          data={(s?.parHeure ?? []).map((r) => ({ label: `${r.heure}h`, title: t('cnnStats.hourRange', '{{h}} h à {{n}} h', { h: r.heure, n: (r.heure + 1) % 24 }), value: r.valeur }))}
          color={viz.series[3]}
          unit={t('cnnStats.ordersUnit', 'commandes')}
        />
        <SimpleBars
          loading={loading}
          title={t('cnnStats.byWeekday', 'Jours de la semaine')}
          subtitle={t('cnnStats.byWeekdaySub', 'Commandes selon le jour')}
          data={(s?.parJourSemaine ?? []).map((r) => {
            const d = new Date(Date.UTC(2024, 0, r.jour)) // 1er janvier 2024 = lundi
            return { label: d.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }), title: d.toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' }), value: r.valeur }
          })}
          color={viz.series[3]}
          unit={t('cnnStats.ordersUnit', 'commandes')}
        />
      </div>

      {/* Croissance et revenus annexes */}
      <div className="grid gap-4 xl:grid-cols-3">
        <StackedSeries
          loading={loading}
          title={t('cnnStats.signups', 'Inscriptions')}
          subtitle={t('cnnStats.signupsSub', 'Nouveaux comptes par profil')}
          rows={(s?.inscriptions ?? []).map((r) => ({ date: r.date, label: dayLabel(r.date), values: [r.CLIENT, r.PARTNER_MOTARD, r.DELIVERY_AGENT, r.ASSOCIATION] }))}
          series={[
            { label: t('cnnStats.role.CLIENT', 'Clients'), color: viz.series[0] },
            { label: t('cnnStats.role.PARTNER_MOTARD', 'Motards partenaires'), color: viz.series[2] },
            { label: t('cnnStats.role.DELIVERY_AGENT', 'Livreurs'), color: viz.series[4] },
            { label: t('cnnStats.role.ASSOCIATION', 'Associations'), color: viz.series[3] },
          ]}
          dayTitle={dayTitle}
          fmt={(n) => fmtN(n)}
        />
        <StackedSeries
          loading={loading}
          title={t('cnnStats.credits', 'Crédits des motards')}
          subtitle={t('cnnStats.creditsSub', 'Crédits achetés et crédits offerts')}
          rows={(s?.credits ?? []).map((r) => ({ date: r.date, label: dayLabel(r.date), values: [r.credits, r.offerts], extra: fmtFc(r.montant) }))}
          series={[
            { label: t('cnnStats.bought', 'Achetés'), color: viz.series[2] },
            { label: t('cnnStats.offered', 'Offerts'), color: viz.series[1] },
          ]}
          extraLabel={t('cnnStats.paid', 'Montant payé')}
          dayTitle={dayTitle}
          fmt={(n) => fmtN(n)}
        />
        <StackedSeries
          loading={loading}
          title={t('cnnStats.subscriptions', 'Abonnements')}
          subtitle={t('cnnStats.subscriptionsSub', 'Montant encaissé (paiements réussis)')}
          rows={(s?.abonnements ?? []).map((r) => ({ date: r.date, label: dayLabel(r.date), values: [Number(r.montant)], extra: fmtN(r.paiements) }))}
          series={[{ label: t('cnnStats.amount', 'Montant'), color: viz.series[5] }]}
          extraLabel={t('cnnStats.payments', 'Paiements')}
          dayTitle={dayTitle}
          fmt={(n) => fmtFc(n)}
        />
      </div>

      {/* Coursiers, associations, qualité */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <RankCard loading={loading} title={t('cnnStats.topAgents', 'Meilleurs livreurs')} subtitle={t('cnnStats.topSub', 'Courses livrées sur la période')} rows={(s?.topLivreurs ?? []).map((r) => ({ label: r.nom ?? '–', value: r.livrees, note: t('cnnStats.of', 'sur {{n}}', { n: r.courses }) }))} color={viz.series[4]} />
        <RankCard loading={loading} title={t('cnnStats.topMotards', 'Meilleurs motards partenaires')} subtitle={t('cnnStats.topSub', 'Courses livrées sur la période')} rows={(s?.topMotards ?? []).map((r) => ({ label: r.nom ?? '–', value: r.livrees, note: t('cnnStats.of', 'sur {{n}}', { n: r.courses }) }))} color={viz.series[2]} />
        <RankCard loading={loading} title={t('cnnStats.topAssociations', 'Associations les plus actives')} subtitle={t('cnnStats.topSub', 'Courses livrées sur la période')} rows={(s?.topAssociations ?? []).map((r) => ({ label: r.nom, value: r.livrees, note: t('cnnStats.of', 'sur {{n}}', { n: r.courses }) }))} color={viz.series[3]} />
        <SimpleBars
          loading={loading}
          title={t('cnnStats.ratings', 'Notes attribuées')}
          subtitle={t('cnnStats.ratingsSub', 'Évaluations laissées après les courses')}
          data={(s?.notes ?? []).map((r) => ({ label: `${r.note}★`, title: t('cnnStats.stars', '{{n}} sur 5', { n: r.note }), value: r.valeur }))}
          color={viz.series[1]}
          unit={t('cnnStats.ratingsUnit', 'notes')}
        />
        <RankCard loading={loading} title={t('cnnStats.reports', 'Signalements de motards')} subtitle={t('cnnStats.reportsSub', 'Par motif')} rows={kv(s?.signalements, 'cnnIncidents.category')} color={viz.series[4]} />
        <RankCard
          loading={loading}
          title={t('cnnStats.emergencies', 'Urgences et remboursements')}
          subtitle={t('cnnStats.emergenciesSub', 'Appels par profil, demandes de remboursement par statut')}
          rows={[
            ...kv(s?.urgences, 'cnnTrace.role').map((r) => ({ ...r, label: `${t('cnnStats.call', 'Appel')} · ${r.label}` })),
            ...kv(s?.remboursements, 'cnnIncidents.refundStatus').map((r) => ({ ...r, label: `${t('cnnStats.refund', 'Remboursement')} · ${r.label}` })),
          ]}
          color={viz.series[5]}
        />
      </div>
      {s && (
        <p className="text-[12px] text-ink-3">
          {t('cnnStats.computedAt', 'Calculé le {{date}}, heure de Kinshasa.', { date: new Date(s.calculeLe).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) })}
        </p>
      )}
    </div>
  )
}

/** Au plus six parts dans un anneau ; le reste est regroupé dans « Autres ». */
function donut(rows: { label: string; value: number }[], other: string) {
  const sorted = [...rows].sort((a, b) => b.value - a.value)
  const head = sorted.slice(0, 5).map((r) => ({ label: r.label, valeur: r.value, couleur: '' }))
  const rest = sorted.slice(5).reduce((sum, r) => sum + r.value, 0)
  if (rest > 0) head.push({ label: other, valeur: rest, couleur: '' })
  return head
}

function Kpi({ label, value, hint, now, before, loading }: { label: string; value: string; hint?: string; now?: number | null; before?: number | null; loading?: boolean }) {
  const { t } = useTranslation()
  const delta = now != null && before != null && Number(before) !== 0 ? ((Number(now) - Number(before)) / Math.abs(Number(before))) * 100 : null
  return (
    <div className="clay flex min-h-[112px] flex-col rounded-[var(--radius-ma)] p-4">
      <p className="truncate text-[12.5px] font-medium text-ink-3">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24 rounded-[8px]" />
      ) : (
        <p className="mt-1 truncate text-[22px] font-semibold tabular-nums tracking-[-0.03em] text-ink">{value}</p>
      )}
      <div className="mt-auto flex items-center gap-2 pt-1.5 text-[12px]">
        {delta != null && !loading && (
          <span className={cn('inline-flex items-center gap-0.5 font-semibold tabular-nums', delta >= 0 ? 'text-status-success' : 'text-status-danger')} title={t('cnnStats.vsPrevious', 'Par rapport à la période précédente')}>
            {delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {`${delta >= 0 ? '+' : ''}${Math.round(delta)} %`}
          </span>
        )}
        {hint && !loading && <span className="truncate text-ink-3">{hint}</span>}
      </div>
    </div>
  )
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-2 text-[12px] text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[4px]" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

/** Classement en barres horizontales (une seule teinte : on compare des quantités). */
function RankCard({ title, subtitle, rows, color, loading }: { title: string; subtitle?: string; rows: { label: string; value: number; note?: string }[]; color: string; loading?: boolean }) {
  const { t } = useTranslation()
  const max = Math.max(1, ...rows.map((r) => r.value))
  const total = rows.reduce((sum, r) => sum + r.value, 0)
  return (
    <ChartFrame className="min-h-[340px]" title={title} subtitle={subtitle} loading={loading} empty={!loading && total === 0} emptyMessage={t('cnnStats.empty', 'Aucune donnée sur cette période')}>
      <ul className="ma-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto px-2 pt-1">
        {[...rows].sort((a, b) => b.value - a.value).map((r, i) => (
          <li key={`${r.label}-${i}`} title={`${r.label} : ${r.value.toLocaleString()}`}>
            <div className="mb-1 flex items-baseline gap-2 text-[12.5px]">
              <span className="min-w-0 flex-1 truncate text-ink-2">{r.label}</span>
              {r.note && <span className="shrink-0 text-[11.5px] text-ink-3">{r.note}</span>}
              <span className="shrink-0 font-semibold tabular-nums text-ink">{r.value.toLocaleString()}</span>
            </div>
            <div className="h-2 rounded-full bg-ink/[0.05] dark:bg-white/[0.06]">
              <div className="h-2 rounded-full transition-[width] duration-700" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: color }} />
            </div>
          </li>
        ))}
      </ul>
    </ChartFrame>
  )
}

function SimpleBars({ title, subtitle, data, color, unit, loading }: { title: string; subtitle?: string; data: { label: string; title: string; value: number }[]; color: string; unit: string; loading?: boolean }) {
  const { t } = useTranslation()
  const viz = useViz()
  return (
    <ChartFrame className="min-h-[340px]" title={title} subtitle={subtitle} loading={loading} empty={!loading && data.every((d) => d.value === 0)} emptyMessage={t('cnnStats.empty', 'Aucune donnée sur cette période')}>
      <div className="min-h-[220px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={viz.grid} vertical={false} />
            <XAxis dataKey="label" tick={axisTick(viz.axis)} axisLine={false} tickLine={false} dy={6} interval="preserveStartEnd" minTickGap={6} />
            <YAxis allowDecimals={false} width={32} tick={axisTick(viz.axis)} axisLine={false} tickLine={false} tickFormatter={yTick} />
            <Tooltip
              cursor={{ fill: viz.dark ? 'rgba(255,255,255,0.04)' : 'rgba(17,27,63,0.04)' }}
              content={({ active, payload }) => {
                const r = payload?.[0]?.payload as { title: string; value: number } | undefined
                return <GlassTooltip active={active} title={r?.title} rows={[{ color, label: unit, value: (r?.value ?? 0).toLocaleString() }]} />
              }}
            />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}

function StackedSeries({
  title,
  subtitle,
  rows,
  series,
  extraLabel,
  dayTitle,
  fmt,
  loading,
}: {
  title: string
  subtitle?: string
  rows: { date: string; label: string; values: number[]; extra?: string }[]
  series: { label: string; color: string }[]
  extraLabel?: string
  dayTitle: (iso: string) => string
  fmt: (n: number) => string
  loading?: boolean
}) {
  const { t } = useTranslation()
  const viz = useViz()
  const data = rows.map((r) => ({ ...r, ...Object.fromEntries(r.values.map((v, i) => [`s${i}`, Number(v)])) }))
  const total = rows.reduce((sum, r) => sum + r.values.reduce((a, b) => a + Number(b), 0), 0)
  return (
    <ChartFrame
      className="min-h-[340px]"
      title={title}
      subtitle={subtitle}
      loading={loading}
      empty={!loading && total === 0}
      emptyMessage={t('cnnStats.empty', 'Aucune donnée sur cette période')}
      summary={!loading && total > 0 ? <ChartSummary label={t('cnnStats.total', 'Total')} value={fmt(total)} /> : undefined}
    >
      {series.length > 1 && <Legend items={series} />}
      <div className="min-h-[200px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={viz.grid} vertical={false} />
            <XAxis dataKey="label" tick={axisTick(viz.axis)} axisLine={false} tickLine={false} dy={6} interval="preserveStartEnd" minTickGap={16} />
            <YAxis allowDecimals={false} width={40} tick={axisTick(viz.axis)} axisLine={false} tickLine={false} tickFormatter={yTick} />
            <Tooltip
              cursor={{ fill: viz.dark ? 'rgba(255,255,255,0.04)' : 'rgba(17,27,63,0.04)' }}
              content={({ active, payload }) => {
                const r = payload?.[0]?.payload as (typeof data)[number] | undefined
                const rowsOut: { color?: string; label: ReactNode; value: ReactNode }[] = series.map((s, i) => ({ color: s.color, label: s.label, value: fmt(Number(r?.values[i] ?? 0)) }))
                if (extraLabel && r?.extra) rowsOut.push({ label: extraLabel, value: r.extra })
                return <GlassTooltip active={active} title={r ? dayTitle(r.date) : ''} rows={rowsOut} />
              }}
            />
            {series.map((s, i) => (
              <Bar key={s.label} dataKey={`s${i}`} stackId="a" fill={s.color} stroke={viz.surface} strokeWidth={1} maxBarSize={26} radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  )
}

