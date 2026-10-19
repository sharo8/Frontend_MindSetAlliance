import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, ArrowRight, Check, CircleSlash, Clock3, Hourglass, ShieldCheck } from 'lucide-react'
import type { Ticket, TicketStatutEvent } from '../../lib/api/tickets'
import { Avatar } from '../../components/ui/avatar'
import { spring } from '../../components/motion/springs'
import { cn } from '../../lib/utils'

const STATUS_LABELS: Record<string, string> = {
  OUVERT: 'Ouvert',
  EN_COURS: 'En cours',
  EN_ATTENTE: 'En attente',
  RESOLU: 'Résolu',
  CLOTURE: 'Clôturé',
  ANNULE: 'Annulé',
}

const STATUS_MEANING: Record<string, string> = {
  OUVERT: 'Ticket créé et visible dans la file, en attente de prise en charge.',
  EN_COURS: 'Un agent a pris le ticket et le traite activement.',
  EN_ATTENTE: 'Traitement suspendu, en attente d’une information ou d’une action tierce.',
  RESOLU: 'Une solution a été apportée ; le ticket reste ouvert jusqu’à clôture.',
  CLOTURE: 'Ticket fermé. Plus de modification, sauf réouverture par un responsable.',
  ANNULE: 'Ticket abandonné ou sans objet ; fin de parcours.',
}

/** Pastille de couleur par statut (jetons de statut uniquement). */
const STATUS_DOT: Record<string, string> = {
  OUVERT: 'bg-status-info',
  EN_COURS: 'bg-status-warning',
  EN_ATTENTE: 'bg-ink-3',
  RESOLU: 'bg-status-success',
  CLOTURE: 'bg-status-success',
  ANNULE: 'bg-status-danger',
}

/** Parcours principal affiché sur la frise. « En attente » est une étape facultative. */
const TRACK = ['OUVERT', 'EN_COURS', 'EN_ATTENTE', 'RESOLU', 'CLOTURE'] as const
const OPTIONAL = new Set(['EN_ATTENTE'])

const EDGES: [string, string][] = [
  ['OUVERT', 'EN_COURS'],
  ['OUVERT', 'EN_ATTENTE'],
  ['OUVERT', 'ANNULE'],
  ['EN_COURS', 'EN_ATTENTE'],
  ['EN_COURS', 'RESOLU'],
  ['EN_COURS', 'ANNULE'],
  ['EN_ATTENTE', 'EN_COURS'],
  ['EN_ATTENTE', 'ANNULE'],
  ['RESOLU', 'CLOTURE'],
  ['RESOLU', 'EN_COURS'],
]

function statusLabel(status?: string) {
  if (!status) return '–'
  return STATUS_LABELS[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replaceAll('_', ' ')
}

function minutesLabel(value?: number) {
  if (value == null) return '–'
  if (value < 60) return `${value} min`
  const h = Math.floor(value / 60)
  const m = value % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

function durationLabel(ms: number) {
  const minutes = Math.round(Math.abs(ms) / 60000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours} h`
  return `${Math.round(hours / 24)} j`
}

function fmtDate(iso?: string) {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '–'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function fmtDateTime(iso?: string) {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '–'
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`
}

function agentLabel(event: TicketStatutEvent) {
  if (!event.agent) return 'Système'
  return `${event.agent.prenom ?? ''} ${event.agent.nom ?? ''}`.trim() || event.agent.emailPro || 'Système'
}

function realEvents(ticket: Ticket): TicketStatutEvent[] {
  if (ticket.historique && ticket.historique.length > 0) return ticket.historique
  return [
    {
      id: 0,
      statutApres: ticket.statut,
      createdAt: ticket.createdAt ?? new Date().toISOString(),
      agent: ticket.demandeur,
    },
  ]
}

function Heading({ children, hint, icon }: { children: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h3 className="flex items-center gap-2 text-[13.5px] font-semibold tracking-[-0.01em] text-ink [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-ink-3">
        {icon}
        {children}
      </h3>
      {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
    </div>
  )
}

export function TicketLifecycle({ ticket }: { ticket: Ticket }) {
  const { t } = useTranslation()
  const events = useMemo(() => realEvents(ticket), [ticket])
  const overdue = ticket.sla?.echeanceDepassee || ticket.sla?.depassement || ticket.sla?.respecte === false

  return (
    <div className="@container space-y-7">
      <section>
        <Heading>{t('ticketsUi.lifecycle.steps', 'Étapes du traitement')}</Heading>
        <LifecycleTrack current={ticket.statut} events={events} />
        <NextSteps current={ticket.statut} />
      </section>
      <div className="grid gap-7 @xl:grid-cols-2 @xl:gap-8">
        <section className="min-w-0">
          <Heading icon={<Clock3 />} hint={t('ticketsUi.lifecycle.eventsCount', '{{count}} étape(s)', { count: events.length })}>
            {t('ticketsUi.lifecycle.realPath', 'Parcours réel')}
          </Heading>
          <RealTimeline events={events} />
        </section>
        <section className="min-w-0">
          <Heading icon={<ShieldCheck />}>{t('ticketsUi.lifecycle.sla', 'Performance SLA')}</Heading>
          <SlaPanel ticket={ticket} overdue={Boolean(overdue)} />
        </section>
      </div>
    </div>
  )
}

/** Onde douce autour de l'étape courante (désactivée si l'utilisateur réduit les animations). */
function Halo({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      aria-hidden
      className={cn('absolute rounded-full', className)}
      initial={{ opacity: 0.3, scale: 1 }}
      animate={reduce ? { opacity: 0.18 } : { opacity: [0.32, 0, 0.32], scale: [1, 1.45, 1] }}
      transition={reduce ? undefined : { duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
    />
  )
}

/* ── Frise horizontale ─────────────────────────────────────────────────── */

function LifecycleTrack({ current, events }: { current: string; events: TicketStatutEvent[] }) {
  const reduce = useReducedMotion()
  const cancelled = current === 'ANNULE'
  const firstSeen = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of events) if (!map.has(e.statutApres)) map.set(e.statutApres, e.createdAt)
    return map
  }, [events])
  // Étape atteinte : celle du statut courant, ou la dernière étape franchie avant annulation.
  const reachedStatus = cancelled
    ? [...events].reverse().find((e) => e.statutApres !== 'ANNULE')?.statutApres ?? 'OUVERT'
    : current
  const reached = Math.max(0, TRACK.indexOf(reachedStatus as (typeof TRACK)[number]))

  return (
    <div>
      <ol className="relative grid grid-cols-5" aria-label="Cycle de vie du ticket">
        {TRACK.map((status, i) => {
          const isCurrent = !cancelled && status === current
          const done = i < reached || (i === reached && cancelled)
          const optional = OPTIONAL.has(status)
          const skipped = optional && done && !firstSeen.has(status)
          return (
            <li key={status} className="group/step relative flex flex-col items-center text-center" title={`${statusLabel(status)} : ${STATUS_MEANING[status]}`}>
              {/* Segment vers l'étape suivante */}
              {i < TRACK.length - 1 && (
                <span className="absolute left-1/2 top-[15px] h-[3px] w-full -translate-y-1/2 overflow-hidden rounded-full bg-ink/[0.08] dark:bg-white/[0.08]" aria-hidden>
                  <motion.span
                    className={cn(
                      'absolute inset-0 origin-left rounded-full bg-gradient-to-r',
                      cancelled ? 'from-ink-3/50 to-ink-3/40' : 'from-ma-gold-300 to-ma-gold-500',
                    )}
                    initial={reduce ? false : { scaleX: 0 }}
                    animate={{ scaleX: i < reached ? 1 : 0 }}
                    transition={{ ...spring.page, delay: reduce ? 0 : 0.12 + i * 0.09 }}
                  />
                </span>
              )}
              <motion.span
                className="relative z-[1] flex h-[30px] w-[30px] items-center justify-center"
                initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...spring.snappy, delay: reduce ? 0 : 0.05 + i * 0.07 }}
              >
                {isCurrent && (
                  <Halo className={cn('inset-0', STATUS_DOT[status])} />
                )}
                {done && !skipped ? (
                  <span
                    className={cn(
                      'flex h-[26px] w-[26px] items-center justify-center rounded-full',
                      cancelled ? 'bg-ink-3/70 text-surface' : 'clay-gold text-ma-navy-950',
                    )}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                ) : isCurrent ? (
                  <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-surface shadow-[0_2px_8px_-2px_rgb(17_27_63/0.3)] ring-1 ring-hairline">
                    <span className={cn('h-3 w-3 rounded-full', STATUS_DOT[status])} />
                  </span>
                ) : (
                  <span
                    className={cn(
                      'clay-field flex items-center justify-center rounded-full',
                      optional ? 'h-[20px] w-[20px]' : 'h-[24px] w-[24px]',
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-3/50" />
                  </span>
                )}
              </motion.span>
              <span
                className={cn(
                  'mt-2.5 px-0.5 text-[12px] leading-tight @md:text-[12.5px]',
                  isCurrent ? 'font-semibold text-ink' : done && !skipped ? 'font-medium text-ink-2' : 'text-ink-3',
                )}
              >
                {statusLabel(status)}
              </span>
              <span className="mt-0.5 text-[11px] tabular-nums text-ink-3">
                {firstSeen.has(status) ? fmtDate(firstSeen.get(status)) : optional ? 'Facultatif' : ' '}
              </span>
            </li>
          )
        })}
      </ol>
      {cancelled && (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.page, delay: 0.4 }}
          className="mt-4 flex items-center gap-2 rounded-[14px] bg-status-danger/10 px-3.5 py-2.5 text-[13px] text-status-danger ring-1 ring-inset ring-status-danger/20"
        >
          <CircleSlash className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">Annulé</span>
            {firstSeen.get('ANNULE') ? ` le ${fmtDateTime(firstSeen.get('ANNULE'))}` : ''}. {STATUS_MEANING.ANNULE}
          </span>
        </motion.div>
      )}
    </div>
  )
}

function NextSteps({ current }: { current: string }) {
  const { t } = useTranslation()
  const nexts = EDGES.filter(([from]) => from === current).map(([, to]) => to)
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 rounded-[14px] bg-ink/[0.03] px-3.5 py-3 dark:bg-white/[0.03]">
      <span className="mr-1 text-[12.5px] text-ink-3">
        <span className="font-medium text-ink-2">{statusLabel(current)}</span>
        {' · '}
        {nexts.length ? t('ticketsUi.lifecycle.nextSteps', 'Étapes possibles') : STATUS_MEANING[current] ?? ''}
      </span>
      {nexts.map((s) => (
        <span
          key={s}
          title={STATUS_MEANING[s]}
          className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface pl-2 pr-2.5 text-[12px] font-medium text-ink-2 shadow-[0_1px_2px_rgb(17_27_63/0.06)] ring-1 ring-hairline"
        >
          <ArrowRight className="h-3 w-3 text-ink-3" strokeWidth={2.4} />
          <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[s])} />
          {statusLabel(s)}
        </span>
      ))}
    </div>
  )
}

/* ── Parcours réel ─────────────────────────────────────────────────────── */

function RealTimeline({ events }: { events: TicketStatutEvent[] }) {
  const reduce = useReducedMotion()
  const ordered = [...events].reverse()
  return (
    <ol className="relative">
      {ordered.map((event, i) => {
        const latest = i === 0
        const last = i === ordered.length - 1
        const name = agentLabel(event)
        return (
          <motion.li
            key={event.id || i}
            className="relative flex gap-3.5 pb-5 last:pb-0"
            initial={reduce ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...spring.page, delay: reduce ? 0 : 0.1 + i * 0.06 }}
          >
            {!last && <span className="absolute bottom-0 left-[7px] top-5 w-px bg-hairline" aria-hidden />}
            <span className="relative mt-1 flex h-[15px] w-[15px] shrink-0 items-center justify-center">
              {latest && <Halo className={cn('inset-0', STATUS_DOT[event.statutApres] ?? 'bg-ink-3')} />}
              <span
                className={cn(
                  'relative rounded-full ring-[3px] ring-surface',
                  latest ? 'h-[11px] w-[11px]' : 'h-[9px] w-[9px] opacity-80',
                  STATUS_DOT[event.statutApres] ?? 'bg-ink-3',
                )}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-[13.5px] text-ink">
                  <span className="font-semibold">{statusLabel(event.statutApres)}</span>
                  {event.statutAvant && <span className="text-ink-3"> · depuis {statusLabel(event.statutAvant).toLowerCase()}</span>}
                </p>
                <time className="text-[12px] tabular-nums text-ink-3" dateTime={event.createdAt}>
                  {fmtDateTime(event.createdAt)}
                </time>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-ink-3">
                {event.agent ? (
                  <Avatar name={name} agentId={event.agent.id} hasPhoto={event.agent.hasPhoto} className="h-5 w-5 text-[8px] ring-1" />
                ) : null}
                <span className="truncate">{name}</span>
              </p>
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}

/* ── SLA ───────────────────────────────────────────────────────────────── */

function SlaPanel({ ticket, overdue }: { ticket: Ticket; overdue: boolean }) {
  const { t } = useTranslation()
  const slaMinutes = (ticket.sla?.engagementHeures ?? 0) * 60
  const slaOk = !overdue && ticket.sla?.respecte !== false
  const finished = ['RESOLU', 'CLOTURE', 'ANNULE'].includes(ticket.statut)
  const due = ticket.echeance ? new Date(ticket.echeance).getTime() : NaN
  const remaining = Number.isFinite(due) ? due - Date.now() : null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold ring-1 ring-inset',
            slaOk ? 'bg-status-success/12 text-status-success ring-status-success/25' : 'bg-status-danger/10 text-status-danger ring-status-danger/25',
          )}
        >
          {slaOk ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : <AlertTriangle className="h-3.5 w-3.5" />}
          {slaOk ? 'SLA respecté' : 'SLA dépassé'}
        </span>
        <span className="text-[12.5px] text-ink-3">
          {t('ticketsUi.sla.commitment', 'Engagement')} <span className="font-medium tabular-nums text-ink-2">{ticket.sla?.engagementHeures ?? '–'} h</span>
        </span>
        {remaining != null && !finished && (
          <span
            className={cn(
              'ml-auto inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium tabular-nums',
              remaining < 0 ? 'bg-status-danger/10 text-status-danger' : 'bg-ink/[0.05] text-ink-2 dark:bg-white/[0.06]',
            )}
          >
            <Hourglass className="h-3.5 w-3.5" />
            {remaining < 0
              ? t('ticketsUi.sla.overdueBy', 'Échéance dépassée de {{d}}', { d: durationLabel(remaining) })
              : t('ticketsUi.sla.dueIn', 'Échéance dans {{d}}', { d: durationLabel(remaining) })}
          </span>
        )}
      </div>
      <SlaMeter label={t('ticketsUi.sla.pickup', 'Prise en charge')} real={ticket.sla?.priseEnChargeMinutes} sla={slaMinutes} index={0} />
      <SlaMeter label={t('ticketsUi.sla.resolution', 'Résolution')} real={ticket.sla?.resolutionMinutes} sla={slaMinutes} index={1} />
    </div>
  )
}

function SlaMeter({ label, real, sla, index }: { label: string; real?: number; sla: number; index: number }) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const measured = real != null
  const value = real ?? 0
  const scale = Math.max(value, sla, 1) * 1.15
  const ok = sla <= 0 ? true : value <= sla
  const pct = measured ? Math.max(2, (value / scale) * 100) : 0
  const target = sla > 0 ? (sla / scale) * 100 : null

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-ink-2">{label}</span>
        {measured ? (
          <span className={cn('text-[13px] font-semibold tabular-nums', ok ? 'text-status-success' : 'text-status-danger')}>{minutesLabel(value)}</span>
        ) : (
          <span className="text-[12.5px] text-ink-3">{t('ticketsUi.sla.notMeasured', 'Pas encore mesuré')}</span>
        )}
      </div>
      <div className="relative">
        <div className="clay-field h-2.5 overflow-hidden rounded-full">
          <motion.div
            className={cn('h-full rounded-full bg-gradient-to-r', ok ? 'from-status-success/70 to-status-success' : 'from-status-danger/70 to-status-danger')}
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 22, delay: reduce ? 0 : 0.2 + index * 0.12 }}
          />
        </div>
        {target != null && (
          <span className="absolute -top-1 bottom-[-4px] w-[2px] -translate-x-1/2 rounded-full bg-ink/60 dark:bg-white/70" style={{ left: `${target}%` }} aria-hidden />
        )}
      </div>
      {target != null && (
        <div className="relative mt-1.5 h-4">
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap text-[11px] tabular-nums text-ink-3"
            style={{ left: `${Math.min(Math.max(target, 12), 88)}%` }}
          >
            {t('ticketsUi.sla.target', 'Objectif {{v}}', { v: minutesLabel(sla) })}
          </span>
        </div>
      )}
    </div>
  )
}
