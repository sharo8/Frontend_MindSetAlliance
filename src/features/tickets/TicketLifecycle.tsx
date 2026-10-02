import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import type { Ticket, TicketStatutEvent } from '../../lib/api/tickets'
import { cn } from '../../lib/utils'

const STATUSES = ['OUVERT', 'EN_COURS', 'EN_ATTENTE', 'RESOLU', 'CLOTURE', 'ANNULE'] as const

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

const STATUS_COLOR: Record<string, string> = {
  OUVERT: '#2563eb',
  EN_COURS: '#d97706',
  EN_ATTENTE: '#94a3b8',
  RESOLU: '#16a34a',
  CLOTURE: '#065f46',
  ANNULE: '#dc2626',
}

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

function minutesLabel(value?: number) {
  if (value == null) return '—'
  if (value < 60) return `${value} min`
  const h = Math.floor(value / 60)
  const m = value % 60
  return m ? `${h} h ${m} min` : `${h} h`
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

function SectionTitle({ children }: { children: string }) {
  return (
    <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-ma-muted">{children}</p>
  )
}

export function TicketLifecycle({ ticket }: { ticket: Ticket }) {
  const events = useMemo(() => realEvents(ticket), [ticket])
  const visited = useMemo(() => new Set(events.map((e) => e.statutApres)), [events])
  const overdue = ticket.sla?.echeanceDepassee || ticket.sla?.depassement || ticket.sla?.respecte === false

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle>Cycle de vie</SectionTitle>
        <StatusWheel current={ticket.statut} visited={visited} />
        <p className="mb-3 mt-6 text-[10px] font-medium uppercase tracking-[0.16em] text-ma-muted">Parcours réel</p>
        <RealTimeline events={events} />
      </section>
      <section>
        <SectionTitle>Performance SLA</SectionTitle>
        <SlaBars ticket={ticket} overdue={Boolean(overdue)} />
      </section>
    </div>
  )
}

function StatusWheel({ current, visited }: { current: string; visited: Set<string> }) {
  const [hover, setHover] = useState<string | null>(null)
  const size = 360
  const cx = size / 2
  const cy = size / 2
  const radius = 118
  const nodeR = 26

  const nodes = STATUSES.map((status, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / STATUSES.length
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const labelR = radius + 44
    return {
      status,
      angle,
      x: cx + radius * cos,
      y: cy + radius * sin,
      lx: cx + labelR * cos,
      ly: cy + labelR * sin,
      anchor: Math.abs(cos) < 0.4 ? 'middle' : cos > 0 ? 'start' : 'end',
    }
  })
  const byStatus = Object.fromEntries(nodes.map((n) => [n.status, n]))

  return (
    <div className="relative mx-auto max-w-[360px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-auto w-full overflow-visible" role="img" aria-label="Diagramme des états du ticket">
            <defs>
              <marker id="ma-edge-arrow" markerWidth="7" markerHeight="7" refX="5.2" refY="3.5" orient="auto">
                <path d="M0 0 L7 3.5 L0 7 Z" fill="#94a3b8" />
              </marker>
              <marker id="ma-edge-arrow-gold" markerWidth="7" markerHeight="7" refX="5.2" refY="3.5" orient="auto">
                <path d="M0 0 L7 3.5 L0 7 Z" fill="#c9a227" />
              </marker>
            </defs>
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" className="text-ma-line dark:text-white/10" strokeWidth="1" strokeDasharray="3 6" />
            {EDGES.map(([from, to]) => {
              const a = byStatus[from]
              const b = byStatus[to]
              if (!a || !b) return null
              const active = current === from
              return (
                <path
                  key={`${from}-${to}`}
                  d={curvePath(a, b, cx, cy, radius, nodeR + 6)}
                  fill="none"
                  stroke={active ? '#c9a227' : '#94a3b8'}
                  strokeWidth={active ? 1.8 : 1.15}
                  strokeOpacity={active ? 0.95 : 0.45}
                  markerEnd={active ? 'url(#ma-edge-arrow-gold)' : 'url(#ma-edge-arrow)'}
                />
              )
            })}
            {nodes.map((node) => {
              const color = STATUS_COLOR[node.status]
              const isCurrent = node.status === current
              const seen = visited.has(node.status)
              const opacity = seen || isCurrent ? 1 : 0.4
              return (
                <g
                  key={node.status}
                  opacity={opacity}
                  className="cursor-pointer"
                  onMouseEnter={() => setHover(node.status)}
                  onMouseLeave={() => setHover(null)}
                >
                  {isCurrent && (
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={nodeR + 8}
                      fill="none"
                      stroke={color}
                      strokeWidth="2"
                      className="ma-status-halo"
                      style={{ transformOrigin: `${node.x}px ${node.y}px` }}
                    />
                  )}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={nodeR}
                    fill={color}
                    stroke={isCurrent ? '#f6d06a' : 'white'}
                    strokeWidth={isCurrent ? 3 : 2}
                  />
                  {seen && (
                    <path
                      d={`M ${node.x - 7} ${node.y + 1} l 5 5 l 10 -11`}
                      fill="none"
                      stroke="white"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  <text
                    x={node.lx}
                    y={node.ly}
                    textAnchor={node.anchor}
                    dominantBaseline="middle"
                    className="fill-ma-navy-900 dark:fill-ma-gold-300"
                    fontSize="10"
                    fontWeight={isCurrent ? 700 : 500}
                    letterSpacing="0.08em"
                  >
                    {STATUS_LABELS[node.status].toUpperCase()}
                  </text>
                  <title>{`${STATUS_LABELS[node.status]} — ${STATUS_MEANING[node.status]}`}</title>
                </g>
              )
            })}
          </svg>
          {hover && (
            <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 w-[min(100%,18rem)] -translate-x-1/2 rounded-xl border border-ma-line bg-white/95 px-3 py-2 text-center text-xs text-ma-navy-800 shadow-lg backdrop-blur dark:border-white/10 dark:bg-ma-navy-900/95 dark:text-ma-gray-200">
              <p className="mb-1 font-semibold uppercase tracking-[0.12em] text-[10px] text-ma-muted">{STATUS_LABELS[hover]}</p>
              {STATUS_MEANING[hover]}
            </div>
          )}
    </div>
  )
}

function curvePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  cx: number,
  cy: number,
  radius: number,
  pad: number,
) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.hypot(dx, dy) || 1
  const sx = from.x + (dx / dist) * pad
  const sy = from.y + (dy / dist) * pad
  const ex = to.x - (dx / dist) * pad
  const ey = to.y - (dy / dist) * pad
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  const vx = mx - cx
  const vy = my - cy
  const vlen = Math.hypot(vx, vy) || 1
  const adjacent = dist < radius * 1.35
  const bulge = adjacent ? 1.22 : 0.52
  const qx = cx + (vx / vlen) * radius * bulge
  const qy = cy + (vy / vlen) * radius * bulge
  return `M ${sx} ${sy} Q ${qx} ${qy} ${ex} ${ey}`
}

function RealTimeline({ events }: { events: TicketStatutEvent[] }) {
  return (
    <ol className="flex flex-col gap-4 overflow-x-auto pb-2 sm:flex-row sm:items-start sm:gap-0">
      {events.map((event, i) => {
        const last = i === events.length - 1
        const color = STATUS_COLOR[event.statutApres] ?? '#94a3b8'
        return (
          <li
            key={event.id || i}
            className="ma-timeline-step flex items-start sm:min-w-[10.5rem]"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <span className="relative mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center">
              {last && (
                <span className="ma-status-halo absolute h-4 w-4 rounded-full" style={{ background: color, opacity: 0.35 }} />
              )}
              <span
                className="relative z-[1] block rounded-full ring-2 ring-white dark:ring-ma-navy-900"
                style={{ width: last ? 14 : 10, height: last ? 14 : 10, background: color }}
              />
            </span>
            {!last && (
              <span
                className="mx-2 mt-2 hidden h-0.5 w-6 shrink-0 rounded-full sm:block"
                style={{ background: color, opacity: 0.55 }}
              />
            )}
            <div className="ml-3 min-w-0 sm:ml-0 sm:mt-5 sm:w-[8.5rem]">
              {!last && <span className="absolute left-[0.7rem] top-5 h-full w-px bg-ma-line sm:hidden dark:bg-white/10" />}
              <p className="text-sm font-medium">{STATUS_LABELS[event.statutApres] ?? event.statutApres}</p>
              <p className="mt-0.5 text-[11px] text-ma-muted">
                {event.createdAt ? new Date(event.createdAt).toLocaleString() : '—'}
              </p>
              <p className="truncate text-[11px] text-ma-muted">{agentLabel(event)}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function SlaBars({ ticket, overdue }: { ticket: Ticket; overdue: boolean }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const slaMinutes = (ticket.sla?.engagementHeures ?? 0) * 60
  const pec = ticket.sla?.priseEnChargeMinutes ?? 0
  const res = ticket.sla?.resolutionMinutes ?? 0
  const slaOk = !overdue && ticket.sla?.respecte !== false

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1',
          slaOk ? 'bg-status-success/12 text-status-success ring-status-success/25' : 'bg-status-danger/12 text-status-danger ring-status-danger/25',
        )}
      >
        {slaOk ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
        {slaOk ? 'SLA respecté' : 'SLA dépassé'}
        <span className="font-normal opacity-80">· engagement {ticket.sla?.engagementHeures ?? '—'} h</span>
      </div>
      <SlaRow label="Prise en charge" real={pec} sla={slaMinutes} ready={ready} />
      <SlaRow label="Résolution" real={res} sla={slaMinutes} ready={ready} />
    </div>
  )
}

function SlaRow({ label, real, sla, ready }: { label: string; real: number; sla: number; ready: boolean }) {
  const max = Math.max(real, sla, 1)
  const ok = sla <= 0 ? true : real <= sla
  const realPct = ready ? (real / max) * 100 : 0
  const slaPct = ready ? (sla / max) * 100 : 0
  return (
    <div>
      <p className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-ma-muted">{label}</p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/8">
            <div
              className="ma-sla-fill h-full rounded-full"
              style={{ width: `${realPct}%`, background: ok ? '#16a34a' : '#dc2626' }}
            />
          </div>
          <span className={cn('w-24 shrink-0 text-right text-xs font-medium', ok ? 'text-status-success' : 'text-status-danger')}>
            {minutesLabel(real)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/8">
            <div className="ma-sla-fill h-full rounded-full bg-ma-navy-700/70 dark:bg-ma-gold-500/45" style={{ width: `${slaPct}%` }} />
          </div>
          <span className="w-24 shrink-0 text-right text-[11px] text-ma-muted">SLA {minutesLabel(sla)}</span>
        </div>
      </div>
    </div>
  )
}
