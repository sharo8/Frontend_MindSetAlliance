import { useTranslation } from 'react-i18next'
import { useEffect, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Bike,
  Building2,
  Clock3,
  CreditCard,
  Gauge,
  LifeBuoy,
  Package,
  PackageCheck,
  ShieldCheck,
  Motorbike,
  Users,
  Wallet,
} from 'lucide-react'
import { DashboardBarChart } from '../../components/charts/DashboardBarChart'
import { DashboardDonutChart } from '../../components/charts/DashboardDonutChart'
import { Badge } from '../../components/ui/badge'
import { ProjectLogo } from '../../components/ui/brand-marks'
import { IconTile, type IconTone } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { PageHeader, SectionHeader } from '../../components/ui/page-header'
import { EmptyState } from '../../components/ui/scope-empty'
import { Skeleton } from '../../components/ui/skeleton'
import { CellStack, Mono, Table, TableCard, TBody, Td, Th, THead, Tr } from '../../components/ui/table'
import { DetailList, SectionCard } from '../../components/ui/toolbar'
import { Stagger, StaggerItem } from '../../components/motion/page-fade'
import { useCount } from '../../components/ui/stat-card'
import { fetchCnnStatistiques, fetchCnnSynthese, useCnnRelay, type CnnSynthese } from '../../lib/api/cnnAdmin'
import { cn } from '../../lib/utils'
import { CurrencyFlag } from '../../components/ui/flags'
import { OrderStatusBadge, useLocaleTag } from './shared'

type Num = number | null | undefined

function useFmt() {
  const locale = useLocaleTag()
  const { t } = useTranslation()
  const missing = t('cnnDash.missing', 'Indisponible')
  return {
    locale,
    missing,
    n: (v: Num) => (v == null ? missing : Math.round(Number(v)).toLocaleString(locale)),
    fc: (v: Num) => (v == null ? missing : `${Math.round(Number(v)).toLocaleString(locale)} FC`),
    money: (v: Num, devise: string | null | undefined) =>
      v == null ? missing : `${Number(v).toLocaleString(locale, { maximumFractionDigits: 2 })}${devise ? ` ${devise === 'CDF' ? 'FC' : devise}` : ''}`,
    time: (iso: string | null | undefined) =>
      iso ? new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : missing,
    dateTime: (iso: string | null | undefined) =>
      iso ? new Date(iso).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–',
  }
}

/** Carte chiffre clé (même rôle que les cartes de l'accueil admin Colis na Nga), cliquable si une page existe. */
function Kpi({
  label,
  sub,
  value,
  display,
  icon,
  tone,
  to,
}: {
  label: string
  sub: string
  value: Num
  display?: string
  icon: ReactNode
  tone: IconTone
  to?: string
}) {
  const { t, i18n } = useTranslation()
  const animated = useCount(Number(value ?? 0))
  const locale = i18n.language?.startsWith('en') ? 'en-GB' : 'fr-FR'
  const shown = value == null ? t('cnnDash.missing', 'Indisponible') : display ?? Math.round(animated).toLocaleString(locale)
  const body = (
    <>
      <div className="flex items-center gap-2">
        <IconTile tone={tone} size="sm">
          {icon}
        </IconTile>
        <p className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.01em] text-ink-2">{label}</p>
      </div>
      <p
        className={cn(
          'mt-auto pt-4 font-bold leading-none tracking-[-0.04em] tabular-nums',
          value == null ? 'text-[17px] text-ink-3' : 'text-[32px] text-ink',
        )}
      >
        {shown}
      </p>
      <p className="mt-2 truncate text-[12.5px] text-ink-3">{sub}</p>
    </>
  )
  const cls = 'clay flex min-h-[132px] flex-col rounded-[var(--radius-ma)] p-[18px]'
  return to ? (
    <Link to={to} className={cn(cls, 'press transition-transform hover:-translate-y-0.5')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function Line({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <DetailList items={items} />
}

export function CnnDashboard() {
  const { t } = useTranslation()
  const f = useFmt()
  const relay = useCnnRelay()
  const q = useQuery({ queryKey: ['cnn-synthese'], queryFn: fetchCnnSynthese, refetchInterval: 30_000 })
  // Statistiques préparées en arrière-plan : la page s'ouvre ensuite sans attente.
  const client = useQueryClient()
  useEffect(() => {
    client.prefetchQuery({ queryKey: ['cnn-stats', '30'], queryFn: () => fetchCnnStatistiques(30), staleTime: 60_000 })
  }, [client])
  const d: CnnSynthese | undefined = q.data
  const longDate = new Date().toLocaleDateString(f.locale, { weekday: 'long', day: 'numeric', month: 'long' })
  const live = Boolean(d?.disponible)
  // Liens vers les pages Colis na Nga existantes, seulement si l'agent peut les voir.
  const link = (path: string, scope: Parameters<typeof relay.can>[0]) => (relay.can(scope, 'VIEW') ? path : undefined)

  const statusSlices = (d?.parStatut ?? []).map((row) => ({
    label: t(`cnnAdmin.orderStatus.${row.statut}`, { defaultValue: row.statut }),
    valeur: Number(row.volume ?? 0),
    couleur: '',
  }))
  const volume = (d?.volume30j ?? []).map((row) => ({
    jour: new Date(`${row.jour}T12:00:00`).toLocaleDateString(f.locale, { day: 'numeric', month: 'short' }),
    volume: row.volume,
  }))

  return (
    <div className="space-y-8">
      <PageHeader
        kicker={longDate}
        title={
          <span className="flex items-center gap-3">
            <ProjectLogo code="CNN" size="md" />
            <span>Colis na Nga</span>
          </span>
        }
        subtitle={
          <span className="mt-1 flex flex-wrap items-center gap-2">
            {q.isLoading ? null : live ? (
              <Badge tone="success" dot>
                {t('cnnDash.live', 'Données réelles Colis na Nga, actualisées à {{time}}', { time: f.time(d?.calculeLe) })}
              </Badge>
            ) : (
              <Badge tone="warning" dot>
                {t('cnnDash.offline', 'Base Colis na Nga non connectée')}
              </Badge>
            )}
            {d?.tauxChange && (
              <>
                <Badge tone="muted" className="gap-1.5">
                  <CurrencyFlag code="USD" />1 USD = <CurrencyFlag code="CDF" />
                  {Math.round(d.tauxChange.usdCdf).toLocaleString(f.locale)} FC
                </Badge>
              </>
            )}
          </span>
        }
      />

      {q.isError && <Feedback tone="danger">{t('cnnDash.error', 'Impossible de charger les données Colis na Nga.')}</Feedback>}
      {d && !d.disponible && <Feedback tone="warning">{d.message ?? t('cnnDash.offline', 'Base Colis na Nga non connectée')}</Feedback>}

      {q.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-[var(--radius-ma)]" />
          ))}
        </div>
      ) : live && d ? (
        <>
          <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
            <StaggerItem>
              <Kpi label={t('cnnDash.pending', 'En attente')} sub={t('cnnDash.pendingSub', 'À prendre en charge')} value={d.commandes?.enAttente} icon={<Clock3 />} tone="gold" to={link('/colis-na-nga/commandes', 'MANAGE_CNN_ORDERS')} />
            </StaggerItem>
            <StaggerItem>
              <Kpi label={t('cnnDash.inProgress', 'En cours')} sub={t('cnnDash.inProgressSub', 'Livraisons actives')} value={d.commandes?.enCours} icon={<Bike />} tone="sky" to={link('/colis-na-nga/commandes', 'MANAGE_CNN_ORDERS')} />
            </StaggerItem>
            <StaggerItem>
              <Kpi label={t('cnnDash.deliveredToday', 'Livrées')} sub={t('cnnDash.today', 'Aujourd’hui')} value={d.commandes?.livreesAujourdhui} icon={<PackageCheck />} tone="teal" to={link('/colis-na-nga/commandes', 'MANAGE_CNN_ORDERS')} />
            </StaggerItem>
            <StaggerItem>
              <Kpi label={t('cnnDash.availableCouriers', 'Livreurs disponibles')} sub={t('cnnDash.availableSub', 'En service maintenant')} value={d.livreurs?.enService} icon={<Motorbike />} tone="coral" to={link('/colis-na-nga/livreurs', 'MANAGE_CNN_AGENTS')} />
            </StaggerItem>
            <StaggerItem>
              <Kpi
                label={t('cnnDash.revenueToday', 'Revenu du jour')}
                sub={t('cnnDash.payments', '{{n}} paiement(s)', { n: d.revenus?.paiementsJour ?? 0 })}
                value={d.revenus?.jour}
                display={f.fc(d.revenus?.jour)}
                icon={<Wallet />}
                tone="violet"
              />
            </StaggerItem>
            <StaggerItem>
              <Kpi
                label={t('cnnDash.successRate', 'Taux de réussite')}
                sub={t('cnnDash.successSub', 'Commandes livrées / créées')}
                value={d.commandes?.tauxReussite}
                display={d.commandes?.tauxReussite != null ? `${d.commandes.tauxReussite.toLocaleString(f.locale)} %` : undefined}
                icon={<Gauge />}
                tone="indigo"
              />
            </StaggerItem>
            <StaggerItem>
              <Kpi label={t('cnnDash.clients', 'Clients')} sub={t('cnnDash.registered', 'Inscrits')} value={d.clients?.total} icon={<Users />} tone="violet" />
            </StaggerItem>
            <StaggerItem>
              <Kpi label={t('cnnDash.subscriptions', 'Abonnements')} sub={t('cnnDash.activePlural', 'Actifs')} value={d.abonnements?.actifs} icon={<CreditCard />} tone="gold" />
            </StaggerItem>
            <StaggerItem>
              <Kpi label={t('cnnDash.associations', 'Associations')} sub={t('cnnDash.partners', 'Partenaires')} value={d.associations?.total} icon={<Building2 />} tone="coral" to={link('/colis-na-nga/associations', 'MANAGE_CNN_ASSOCIATIONS')} />
            </StaggerItem>
            <StaggerItem>
              <Kpi label={t('cnnDash.admins', 'Administrateurs')} sub={t('cnnDash.activePlural', 'Actifs')} value={d.adminsActifs} icon={<ShieldCheck />} tone="sky" />
            </StaggerItem>
          </Stagger>

          <section className="space-y-4">
            <SectionHeader title={t('cnnDash.activity', 'Activité')} subtitle={t('cnnDash.activitySub', 'Commandes créées sur 30 jours et répartition de toutes les commandes par statut.')} />
            <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="h-[400px] min-w-0">
                <DashboardBarChart
                  className="h-full"
                  title={t('cnnDash.ordersCreated', 'Commandes créées, 30 derniers jours')}
                  data={volume}
                  dataKey="volume"
                  xAxisKey="jour"
                  unit={t('cnnDash.ordersUnit', 'commandes')}
                  zeroAsData
                  showTotal
                />
              </div>
              <div className="h-[400px] min-w-0">
                <DashboardDonutChart className="h-full" title={t('cnnDash.byStatus', 'Toutes les commandes par statut')} data={statusSlices} centerLabel={t('cnnDash.total', 'Total')} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <SectionHeader title={t('cnnDash.synthesis', 'Synthèse complète')} subtitle={t('cnnDash.synthesisSub', 'Toutes les données disponibles dans Colis na Nga.')} />
            <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              <SectionCard title={t('cnnDash.orders', 'Commandes')} icon={<Package />} tone="gold">
                <Line
                  items={[
                    { label: t('cnnDash.total', 'Total'), value: f.n(d.commandes?.total) },
                    { label: t('cnnDash.delivered', 'Livrées'), value: f.n(d.commandes?.livrees) },
                    { label: t('cnnDash.cancelled', 'Annulées'), value: f.n(d.commandes?.annulees) },
                    { label: t('cnnDash.active', 'En cours ou en attente'), value: f.n(d.commandes?.actives) },
                    { label: t('cnnDash.createdToday', 'Créées aujourd’hui'), value: f.n(d.commandes?.creeesAujourdhui) },
                    { label: t('cnnDash.createdMonth', 'Créées ce mois'), value: f.n(d.commandes?.creeesCeMois) },
                    { label: t('cnnDash.byCourier', 'Par livreur / par motard'), value: `${f.n(d.commandes?.parLivreur)} / ${f.n(d.commandes?.parMotard)}` },
                    { label: t('cnnDash.secretSensitive', 'Secrètes / sensibles'), value: `${f.n(d.commandes?.secretes)} / ${f.n(d.commandes?.sensibles)}` },
                    { label: t('cnnDash.archived', 'Archivées'), value: f.n(d.commandes?.archivees) },
                    { label: t('cnnDash.deliveredValue', 'Valeur des commandes livrées'), value: f.fc(d.commandes?.chiffreLivre) },
                  ]}
                />
              </SectionCard>

              <SectionCard title={t('cnnDash.fleet', 'Flotte')} icon={<Motorbike />} tone="sky">
                <Line
                  items={[
                    { label: t('cnnDash.couriersTotal', 'Livreurs'), value: f.n(d.livreurs?.total) },
                    { label: t('cnnDash.couriersOnDuty', 'Livreurs en service'), value: f.n(d.livreurs?.enService) },
                    { label: t('cnnDash.couriersOff', 'Livreurs désactivés'), value: f.n(d.livreurs?.desactives) },
                    { label: t('cnnDash.ridersTotal', 'Motards'), value: f.n(d.motards?.total) },
                    { label: t('cnnDash.ridersOnDuty', 'Motards en service'), value: f.n(d.motards?.enService) },
                    { label: t('cnnDash.ridersToApprove', 'Motards à valider (admin)'), value: f.n(d.motards?.aValider) },
                    { label: t('cnnDash.ridersWaitingAsso', 'En attente de leur association'), value: f.n(d.motards?.attenteAssociation) },
                    { label: t('cnnDash.ridersApprovedRejected', 'Approuvés / refusés'), value: `${f.n(d.motards?.approuves)} / ${f.n(d.motards?.refuses)}` },
                    { label: t('cnnDash.creditsBalance', 'Crédits détenus par les motards'), value: f.n(d.motards?.creditsEnCirculation) },
                  ]}
                />
              </SectionCard>

              <SectionCard title={t('cnnDash.clientsSubs', 'Clients et abonnements')} icon={<Users />} tone="violet">
                <Line
                  items={[
                    { label: t('cnnDash.clients', 'Clients'), value: f.n(d.clients?.total) },
                    { label: t('cnnDash.newClientsMonth', 'Nouveaux ce mois'), value: f.n(d.clients?.nouveauxCeMois) },
                    { label: t('cnnDash.clientsOff', 'Comptes désactivés'), value: f.n(d.clients?.desactives) },
                    { label: t('cnnDash.companies', 'Clients entreprises'), value: f.n(d.clients?.entreprises) },
                    { label: t('cnnDash.companiesPending', 'Entreprises à valider'), value: f.n(d.clients?.entreprisesEnAttente) },
                    { label: t('cnnDash.subsActiveTotal', 'Formules actives / total'), value: `${f.n(d.abonnements?.actifs)} / ${f.n(d.abonnements?.total)}` },
                    { label: t('cnnDash.subsExpiring', 'Expirent dans 30 jours'), value: f.n(d.abonnements?.expirant30j) },
                    ...(d.abonnements?.facturesParStatut ?? []).map((row) => ({
                      label: t('cnnDash.invoices', 'Factures {{status}}', { status: t(`cnnDash.invoiceStatus.${row.statut}`, { defaultValue: row.statut }) }),
                      value: `${f.n(row.nombre)} · ${f.money(row.montant, row.devise)}`,
                    })),
                  ]}
                />
              </SectionCard>

              <SectionCard title={t('cnnDash.finance', 'Finances')} icon={<Wallet />} tone="teal">
                <Line
                  items={[
                    { label: t('cnnDash.revenueTotal', 'Revenu total encaissé'), value: f.fc(d.revenus?.total) },
                    { label: t('cnnDash.revenueMonth', 'Ce mois'), value: `${f.fc(d.revenus?.mois)} · ${t('cnnDash.payments', '{{n}} paiement(s)', { n: d.revenus?.paiementsMois ?? 0 })}` },
                    { label: t('cnnDash.revenueTodayShort', 'Aujourd’hui'), value: `${f.fc(d.revenus?.jour)} · ${t('cnnDash.payments', '{{n}} paiement(s)', { n: d.revenus?.paiementsJour ?? 0 })}` },
                    { label: t('cnnDash.paymentsPending', 'Paiements en attente'), value: f.n(d.revenus?.enAttente) },
                    ...(d.revenus?.parMode ?? []).map((row) => ({
                      label: t('cnnDash.byMode', 'Encaissé en {{mode}}', { mode: t(`cnnDash.mode.${row.mode}`, { defaultValue: row.mode }) }),
                      value: f.fc(row.montant),
                    })),
                    ...(d.mobileMoney?.reussies ?? []).map((row) => ({
                      label: t('cnnDash.mobileMoneyOk', 'Mobile Money réussi ({{n}})', { n: row.nombre }),
                      value: f.money(row.montant, row.devise),
                    })),
                    { label: t('cnnDash.mobileMoneyPendingFailed', 'Mobile Money en cours / échoué'), value: `${f.n(d.mobileMoney?.enCours)} / ${f.n(d.mobileMoney?.echouees)}` },
                    { label: t('cnnDash.creditsSold', 'Crédits motards vendus'), value: `${f.n(d.creditsMotards?.creditsVendus)} · ${f.fc(d.creditsMotards?.montant)}` },
                    { label: t('cnnDash.creditsAssoShare', 'Part reversée aux associations'), value: f.fc(d.creditsMotards?.partAssociations) },
                    { label: t('cnnDash.creditsFree', 'Crédits offerts au démarrage'), value: f.n(d.creditsMotards?.creditsOfferts) },
                  ]}
                />
              </SectionCard>

              <SectionCard title={t('cnnDash.support', 'Support et sécurité')} icon={<LifeBuoy />} tone="coral">
                <Line
                  items={[
                    { label: t('cnnDash.refundsPending', 'Remboursements à traiter'), value: f.n(d.support?.remboursementsEnAttente) },
                    ...(d.support?.remboursements ?? [])
                      .filter((row) => row.statut !== 'PENDING')
                      .map((row) => ({
                        label: t('cnnDash.refunds', 'Remboursements {{status}}', { status: t(`cnnDash.refundStatus.${row.statut}`, { defaultValue: row.statut }) }),
                        value: f.n(row.nombre),
                      })),
                    { label: t('cnnDash.emergency', 'Appels d’urgence (aujourd’hui)'), value: `${f.n(d.support?.appelsUrgence)} (${f.n(d.support?.appelsUrgenceAujourdhui)})` },
                    { label: t('cnnDash.reportsOpen', 'Signalements de motards ouverts'), value: f.n(d.support?.signalementsOuverts) },
                    { label: t('cnnDash.deletionPending', 'Suppressions de motard en attente'), value: f.n(d.support?.suppressionsMotardEnAttente) },
                    {
                      label: t('cnnDash.ratings', 'Note moyenne'),
                      value:
                        d.notes?.moyenne != null
                          ? t('cnnDash.ratingValue', '{{avg}} / 5 sur {{n}} avis', { avg: Number(d.notes.moyenne).toLocaleString(f.locale), n: d.notes.nombre ?? 0 })
                          : d.notes?.nombre === 0
                            ? t('cnnDash.noRatings', 'Aucun avis')
                            : f.missing,
                    },
                  ]}
                />
              </SectionCard>

              <SectionCard title={t('cnnDash.associations', 'Associations')} icon={<Building2 />} tone="indigo">
                <Line
                  items={[
                    { label: t('cnnDash.assoActiveTotal', 'Actives / total'), value: `${f.n(d.associations?.actives)} / ${f.n(d.associations?.total)}` },
                    { label: t('cnnDash.assoRevenue', 'Revenus cumulés'), value: f.fc(d.associations?.revenusCumules) },
                    ...(d.associations?.top ?? []).map((row) => ({
                      label: row.nom,
                      value: `${f.fc(row.revenus)} · ${t('cnnDash.ridersCount', '{{n}} motard(s)', { n: row.motards })}`,
                    })),
                  ]}
                />
              </SectionCard>
            </div>
          </section>

          <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <section className="space-y-4">
              <SectionHeader title={t('cnnDash.onDutyNow', 'En service maintenant')} subtitle={t('cnnDash.onDutySub', '{{n}} coursier(s) en service', { n: (d.enService ?? []).length })} />
              <div className="clay rounded-[var(--radius-ma)] p-2">
                {(d.enService ?? []).length === 0 ? (
                  <EmptyState icon={<Motorbike />} title={t('cnnDash.nobodyOnDuty', 'Aucun coursier en service')} />
                ) : (
                  <ul className="grid gap-x-2 sm:grid-cols-2 2xl:grid-cols-1">
                    {(d.enService ?? []).map((c, i) => (
                      <li key={`${c.telephone}-${i}`} className="flex items-center justify-between gap-3 border-b border-hairline px-3 py-2.5">
                        <CellStack title={c.nom} meta={c.telephone} />
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Badge tone={c.type === 'MOTARD' ? 'teal' : 'info'}>
                            {c.type === 'MOTARD' ? t('cnnAdmin.orders.motard', 'Motard') : t('cnnAdmin.orders.agent', 'Livreur')}
                          </Badge>
                          <span className="text-[11.5px] text-ink-3">
                            {c.dernierePosition ? t('cnnDash.lastSeen', 'Position {{time}}', { time: f.dateTime(c.dernierePosition) }) : t('cnnDash.noPosition', 'Aucune position')}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeader
                title={t('cnnDash.recentOrders', 'Dernières commandes')}
                actions={
                  relay.can('MANAGE_CNN_ORDERS', 'VIEW') ? (
                    <Link to="/colis-na-nga/commandes" className="text-[13px] font-semibold text-accent-ink hover:underline">
                      {t('cnnDash.seeAll', 'Tout voir')}
                    </Link>
                  ) : undefined
                }
              />
              <TableCard empty={(d.dernieresCommandes ?? []).length === 0 ? <EmptyState icon={<Package />} title={t('cnnAdmin.orders.empty', 'Aucune commande')} /> : undefined}>
                <Table minWidth={640}>
                  <THead>
                    <tr>
                      <Th>{t('cnnAdmin.orders.ref', 'Réf.')}</Th>
                      <Th>{t('cnnAdmin.orders.client', 'Client')}</Th>
                      <Th>{t('cnnAdmin.orders.route', 'Trajet')}</Th>
                      <Th>{t('cnnAdmin.common.status', 'Statut')}</Th>
                      <Th>{t('cnnAdmin.orders.created', 'Créée')}</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {(d.dernieresCommandes ?? []).map((o) => (
                      <Tr key={o.id}>
                        <Td>
                          <Mono className="whitespace-nowrap">{o.id.slice(0, 8).toUpperCase()}</Mono>
                        </Td>
                        <Td>
                          <CellStack title={o.client || '–'} meta={o.clientTelephone ?? undefined} />
                        </Td>
                        <Td className="max-w-[260px]">
                          <CellStack title={<span className="block truncate">{o.depart || '–'}</span>} meta={<span className="block truncate">→ {o.arrivee || '–'}</span>} />
                        </Td>
                        <Td>
                          <OrderStatusBadge status={o.statut} />
                        </Td>
                        <Td className="whitespace-nowrap text-ink-3">{f.dateTime(o.creeLe)}</Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </TableCard>
            </section>
          </div>

          <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {t(
              'cnnDash.footnote',
              'Chiffres lus en direct dans la base Colis na Nga (lecture seule), avec les mêmes règles que l’application d’administration. Un chiffre marqué « Indisponible » n’a pas pu être lu : aucune valeur n’est jamais estimée.',
            )}
          </p>
        </>
      ) : null}
    </div>
  )
}
