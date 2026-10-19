import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Clock3, Flag, MapPin, Package, Pause, Play, Route, Search, UserRound } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { Skeleton } from '../../components/ui/skeleton'
import { fetchCnnTraceSearch, type CnnItineraire, type OrderStatus } from '../../lib/api/cnnAdmin'
import { cn } from '../../lib/utils'
import { ORDER_STATUSES, OrderStatusBadge, fmtDateTime, fmtMoney, fullName, isFinalOrder, relayErrorMessage, useLocaleTag } from './shared'
import { useDebounced } from './useDebounced'

export type TracePoint = { lat: number; lng: number; at: string | null }

/** Distance en kilomètres entre deux points GPS (formule de haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(h))
}

export function traceLength(points: TracePoint[]) {
  let km = 0
  for (let i = 1; i < points.length; i++) km += distanceKm(points[i - 1], points[i])
  return km
}

function durationLabel(fromIso: string | null | undefined, toIso: string | null | undefined, t: (k: string, d: string, o?: Record<string, unknown>) => string) {
  if (!fromIso || !toIso) return null
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return null
  const min = Math.round(ms / 60000)
  if (min < 60) return t('cnnTrace.minutes', '{{n}} min', { n: min })
  const h = Math.floor(min / 60)
  return t('cnnTrace.hoursMinutes', '{{h}} h {{m}} min', { h, m: String(min % 60).padStart(2, '0') })
}

/** Recherche d'une commande à retracer : en cours ou déjà passée. */
export function TraceFinder({ onPick }: { onPick: (id: string) => void }) {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const q = useDebounced(search.trim(), 350)
  const results = useQuery({
    queryKey: ['cnn-trace-search', q, status],
    queryFn: () => fetchCnnTraceSearch(q || undefined, status || undefined),
    staleTime: 15_000,
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2 border-b border-hairline px-4 pb-3">
        <label className="clay-field flex h-10 items-center gap-2 rounded-[12px] px-3">
          <Search className="h-4 w-4 shrink-0 text-ink-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('cnnTrace.searchPlaceholder', 'N° de commande, client, coursier, adresse…')}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
          />
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label={t('cnnAdmin.orders.status', 'Statut')}
          className="clay-field h-9 w-full rounded-[12px] bg-transparent px-3 text-[12.5px] text-ink outline-none"
        >
          <option value="">{t('cnnTrace.allStatuses', 'Tous les statuts')}</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`cnnAdmin.orderStatus.${s}`, { defaultValue: s })}
            </option>
          ))}
        </select>
      </div>
      <ul className="ma-scroll min-h-0 flex-1 divide-y divide-hairline overflow-y-auto">
        {results.isLoading &&
          [0, 1, 2, 3].map((i) => (
            <li key={i} className="px-4 py-3">
              <Skeleton className="h-11 w-full rounded-[10px]" />
            </li>
          ))}
        {results.isError && (
          <li className="p-4">
            <Feedback tone="danger">{relayErrorMessage(results.error, (k, v) => t(k, v))}</Feedback>
          </li>
        )}
        {(results.data ?? []).map((o) => (
          <li key={o.id}>
            <button type="button" onClick={() => onPick(o.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-ink/[0.03] dark:hover:bg-white/[0.04]">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink-2 dark:bg-white/[0.08]">
                <Route className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[12px] font-semibold text-ink">{o.id.slice(0, 8).toUpperCase()}</span>
                  <OrderStatusBadge status={o.status} />
                </span>
                <span className="block truncate text-[12.5px] font-medium text-ink-2">
                  {fullName(o.clientFirstName, o.clientLastName, o.clientPhone)}
                  {o.courierFirstName || o.courierLastName ? ` · ${fullName(o.courierFirstName, o.courierLastName)}` : ''}
                </span>
                <span className="block truncate text-[12px] text-ink-3">→ {o.deliveryAddress || '–'}</span>
              </span>
              <span className="shrink-0 text-right text-[11.5px] tabular-nums text-ink-3">{fmtDateTime(o.createdAt, locale)}</span>
            </button>
          </li>
        ))}
        {!results.isLoading && !results.isError && (results.data ?? []).length === 0 && (
          <li className="px-4 py-10 text-center text-[13px] text-ink-3">{t('cnnTrace.noResult', 'Aucune commande ne correspond.')}</li>
        )}
      </ul>
    </div>
  )
}

const ROLE_LABEL: Record<string, string> = {
  CLIENT: 'Client',
  DELIVERY_AGENT: 'Livreur',
  PARTNER_MOTARD: 'Motard',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Admin',
  ASSOCIATION: 'Association',
  SYSTEM: 'Système',
}

/** Détail d'un itinéraire : résumé, relecture du tracé, étapes et chronologie. */
export function TraceDetail({
  data,
  loading,
  error,
  onBack,
  replay,
  onReplay,
  playing,
  onPlaying,
  colors,
}: {
  data: CnnItineraire | undefined
  loading: boolean
  error: unknown
  onBack: () => void
  replay: number
  onReplay: (index: number) => void
  playing: boolean
  onPlaying: (playing: boolean) => void
  colors: { pickup: string; stop: string; delivery: string; trace: string }
}) {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const o = data?.commande
  const trace = useMemo(() => data?.trace ?? [], [data])
  const recorded = trace.length >= 2
  const km = useMemo(() => (recorded ? traceLength(trace) : 0), [trace, recorded])
  const current = trace[Math.min(replay, Math.max(0, trace.length - 1))]
  const active = o ? !isFinalOrder(o.status) : false
  const duration = recorded ? durationLabel(trace[0].at, trace[trace.length - 1].at, (k, d, x) => t(k, d, x)) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-hairline px-4 pb-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          {t('cnnTrace.back', 'Retour')}
        </Button>
        {o && <span className="ml-auto font-mono text-[12.5px] font-semibold text-ink">{o.id.slice(0, 8).toUpperCase()}</span>}
      </div>
      <div className="ma-scroll min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <div className="space-y-3 p-4">
            <Skeleton className="h-20 w-full rounded-[14px]" />
            <Skeleton className="h-32 w-full rounded-[14px]" />
          </div>
        )}
        {Boolean(error) && (
          <div className="p-4">
            <Feedback tone="danger">{relayErrorMessage(error, (k, v) => t(k, v))}</Feedback>
          </div>
        )}
        {o && (
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <OrderStatusBadge status={o.status as OrderStatus} />
                {active && <Badge tone="teal" dot>{t('cnnTrace.live', 'Suivi en direct')}</Badge>}
                <span className="ml-auto text-[13px] font-semibold tabular-nums text-ink">{fmtMoney(o.price, locale)}</span>
              </div>
              <p className="text-[12.5px] text-ink-3">
                {t('cnnTrace.created', 'Créée le {{date}}', { date: fmtDateTime(o.createdAt, locale) })}
                {o.distanceKm != null && ` · ${t('cnnTrace.estimated', '{{km}} km estimés', { km: Number(o.distanceKm).toLocaleString(locale, { maximumFractionDigits: 1 }) })}`}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-2 text-[12.5px]">
              <Info label={t('cnnAdmin.orders.client', 'Client')} value={fullName(o.clientFirstName, o.clientLastName, o.clientPhone)} sub={o.clientPhone} />
              <Info
                label={t('cnnTrace.courier', 'Coursier')}
                value={data?.coursier ? fullName(data.coursier.firstName, data.coursier.lastName, data.coursier.phone) : t('cnnTrace.noCourier', 'Non attribué')}
                sub={data?.coursier ? (data.coursier.type === 'LIVREUR' ? t('cnnMap.livreurCnn', 'Livreur Colis na Nga') : t('cnnTrace.partner', 'Motard partenaire')) : null}
              />
            </dl>

            {/* Tracé enregistré */}
            <section className="clay-field space-y-3 rounded-[14px] p-3.5">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colors.trace }} />
                {t('cnnTrace.recordedTitle', 'Itinéraire emprunté')}
              </p>
              {data?.trace == null ? (
                <p className="text-[12.5px] leading-relaxed text-ink-3">
                  {t('cnnTrace.notDeployed', 'L’enregistrement du tracé GPS n’est pas encore actif sur le backend Colis na Nga. Le trajet prévu est affiché en pointillés.')}
                </p>
              ) : !recorded ? (
                <p className="text-[12.5px] leading-relaxed text-ink-3">
                  {active && !data?.coursier
                    ? t('cnnTrace.waitingCourier', 'Le tracé commencera dès qu’un coursier prendra la course. En attendant, le trajet prévu est affiché en pointillés.')
                    : active
                      ? t('cnnTrace.waitingPoints', 'Enregistrement en cours : le tracé apparaît dès les premiers déplacements du coursier (mise à jour toutes les 10 s).')
                      : t('cnnTrace.noTrace', 'Aucun point GPS enregistré pour cette commande (course antérieure à l’enregistrement ou coursier sans position). Le trajet prévu est affiché en pointillés.')}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Mini label={t('cnnTrace.distance', 'Distance')} value={`${km.toLocaleString(locale, { maximumFractionDigits: 1 })} km`} />
                    <Mini label={t('cnnTrace.duration', 'Durée')} value={duration ?? '–'} />
                    <Mini label={t('cnnTrace.points', 'Points GPS')} value={trace.length.toLocaleString(locale)} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!playing && replay >= trace.length - 1) onReplay(0)
                          onPlaying(!playing)
                        }}
                        aria-label={playing ? t('cnnTrace.pause', 'Pause') : t('cnnTrace.play', 'Rejouer le trajet')}
                        className="glass-strong press inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink"
                      >
                        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={trace.length - 1}
                        value={Math.min(replay, trace.length - 1)}
                        onChange={(e) => {
                          onPlaying(false)
                          onReplay(Number(e.target.value))
                        }}
                        aria-label={t('cnnTrace.timeline', 'Position dans le trajet')}
                        className="w-full accent-[var(--ma-gold-500,#cf9410)]"
                      />
                    </div>
                    <p className="flex items-center gap-1.5 text-[12px] tabular-nums text-ink-3">
                      <Clock3 className="h-3.5 w-3.5" />
                      {current?.at ? fmtDateTime(current.at, locale) : '–'}
                    </p>
                  </div>
                </>
              )}
            </section>

            {/* Étapes */}
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t('cnnTrace.steps', 'Étapes')}</h3>
              <ol className="space-y-2">
                <Step icon={<Package className="h-3.5 w-3.5" />} color={colors.pickup} title={t('cnnTrace.pickup', 'Récupération')} text={o.pickupAddress} sub={[o.pickupContactName, o.pickupContactPhone].filter(Boolean).join(' · ')} />
                {(data?.arrets ?? []).map((s, i, all) => (
                  <Step
                    key={`${s.stopOrder}-${s.trackingNumber}`}
                    icon={i === all.length - 1 ? <Flag className="h-3.5 w-3.5" /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                    color={i === all.length - 1 ? colors.delivery : colors.stop}
                    title={all.length > 1 ? t('cnnTrace.stop', 'Arrêt {{n}}', { n: i + 1 }) : t('cnnTrace.delivery', 'Livraison')}
                    text={s.address}
                    sub={[s.recipientName, s.recipientPhone, s.deliveryStatus ? t(`cnnTrace.parcelStatus.${s.deliveryStatus}`, { defaultValue: s.deliveryStatus }) : null].filter(Boolean).join(' · ')}
                  />
                ))}
                {(data?.arrets ?? []).length === 0 && (
                  <Step icon={<Flag className="h-3.5 w-3.5" />} color={colors.delivery} title={t('cnnTrace.delivery', 'Livraison')} text={o.deliveryAddress} sub={[o.recipientName, o.recipientPhone].filter(Boolean).join(' · ')} />
                )}
              </ol>
            </section>

            {/* Chronologie */}
            <section>
              <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t('cnnTrace.timelineTitle', 'Chronologie')}</h3>
              {(data?.chronologie ?? []).length === 0 ? (
                <p className="text-[12.5px] text-ink-3">{t('cnnTrace.noHistory', 'Aucun changement de statut enregistré.')}</p>
              ) : (
                <ol className="relative space-y-3 border-l border-hairline pl-4">
                  {(data?.chronologie ?? []).map((h, i) => (
                    <li key={`${h.status}-${h.at}-${i}`} className="relative">
                      <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-ma-gold-500 ring-4 ring-[var(--ma-surface)]" />
                      <p className="text-[12.5px] font-semibold text-ink">
                        {t(`cnnAdmin.orderStatus.${h.status}`, { defaultValue: t(`cnnTrace.parcelStatus.${h.status}`, { defaultValue: h.status }) })}
                      </p>
                      <p className="text-[11.5px] tabular-nums text-ink-3">
                        {fmtDateTime(h.at, locale)}
                        {h.role ? ` · ${t(`cnnTrace.role.${h.role}`, { defaultValue: ROLE_LABEL[h.role] ?? h.role })}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

function Info({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="clay-field min-w-0 rounded-[12px] px-3 py-2">
      <dt className="flex items-center gap-1 text-[11px] text-ink-3">
        <UserRound className="h-3 w-3" />
        {label}
      </dt>
      <dd className="truncate font-semibold text-ink">{value}</dd>
      {sub && <dd className="truncate text-[11.5px] text-ink-3">{sub}</dd>}
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] text-ink-3">{label}</p>
      <p className="truncate text-[14px] font-semibold tabular-nums text-ink">{value}</p>
    </div>
  )
}

function Step({ icon, color, title, text, sub }: { icon: ReactNode; color: string; title: string; text: string | null; sub?: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={cn('mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white')} style={{ background: color }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold text-ink">{title}</span>
        <span className="flex items-start gap-1 text-[12px] text-ink-2">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-ink-3" />
          {text || '–'}
        </span>
        {sub && <span className="block truncate text-[11.5px] text-ink-3">{sub}</span>}
      </span>
    </li>
  )
}
