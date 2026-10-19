import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Database,
  Lightbulb,
  MessagesSquare,
  MoreHorizontal,
  PanelLeft,
  PanelLeftClose,
  Pencil,
  RefreshCw,
  RotateCcw,
  SearchX,
  Shield,
  Sparkles,
  SquarePen,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, auditActionTone, sentence } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { IconTile } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { Modal } from '../../components/ui/modal'
import { PageHeader } from '../../components/ui/page-header'
import { EmptyState } from '../../components/ui/scope-empty'
import { Skeleton } from '../../components/ui/skeleton'
import { Table, TBody, THead, Td, Th, Tr } from '../../components/ui/table'
import { SearchField } from '../../components/ui/toolbar'
import { spring } from '../../components/motion/springs'
import { AssistantMarkdown } from './assistant-markdown'
import {
  askAssistant,
  feedbackAssistant,
  fetchAssistantConversation,
  fetchAssistantConversations,
  fetchAssistantStatus,
  renameAssistantConversation,
  archiveAssistantConversation,
  type AssistantFact,
  type AssistantFactColumn,
  type AssistantKpiTone,
  type AssistantStoredMessage,
} from '../../lib/api/assistant'
import { fetchMe } from '../../lib/api/auth'
import { ApiError } from '../../lib/api/client'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { cn } from '../../lib/utils'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  at?: string
  facts?: AssistantFact[]
  unavailable?: boolean
  language?: string | null
  intent?: string | null
  tools?: string[] | null
  feedback?: 'up' | 'down' | null
  persisted?: boolean
  error?: boolean
  retryText?: string
}

const SUGGESTIONS = [
  { group: 'users', icon: Users, keys: ['q1', 'q3'] },
  { group: 'access', icon: Shield, keys: ['q2', 'q4', 'q5'] },
  { group: 'recommendations', icon: Lightbulb, keys: ['q6'] },
] as const

const PAGE_SIZE = 20
const MAX_CHARS = 4000
const ZONE = 'Africa/Kinshasa'

function visibleFacts(facts: AssistantFact[] | undefined, intent: string | null | undefined): AssistantFact[] {
  if (!facts?.length) return []
  const kind = (intent ?? 'other').toLowerCase()
  if (kind === 'count') return []
  if (kind === 'list' || kind === 'detail') return facts
  return facts.filter((fact) => (fact.rows?.length ?? 0) > 0)
}

function cell(value: unknown) {
  if (value == null || value === '') return '–'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function localeOf(lang: string) {
  if (lang.startsWith('en')) return 'en-GB'
  if (lang.startsWith('sw')) return 'sw-CD'
  return 'fr-CD'
}

function kinshasaDay(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

function dayGroup(iso: string) {
  const today = kinshasaDay(new Date().toISOString())
  const yesterday = kinshasaDay(new Date(Date.now() - 86400000).toISOString())
  const week = kinshasaDay(new Date(Date.now() - 6 * 86400000).toISOString())
  const day = kinshasaDay(iso)
  if (day === today) return 'today'
  if (day === yesterday) return 'yesterday'
  if (day >= week) return 'week'
  return 'older'
}

function relativeTime(iso: string, lang: string) {
  const diff = new Date(iso).getTime() - Date.now()
  const minutes = Math.round(diff / 60000)
  const format = new Intl.RelativeTimeFormat(localeOf(lang), { numeric: 'auto' })
  if (Math.abs(minutes) < 60) return format.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return format.format(hours, 'hour')
  return format.format(Math.round(hours / 24), 'day')
}

function clock(iso: string | undefined, lang: string) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(localeOf(lang), {
    timeZone: ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

function displayTitle(raw: string) {
  const text = raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(hey|hello|salut|bonjour)(?:[,!.\s]+|$)/i, '')
    .trim()
  if (!text || /^(hey|hello|salut|bonjour)$/i.test(text)) return ''
  const titled = text.charAt(0).toUpperCase() + text.slice(1)
  if (titled.length <= 48) return titled
  const cut = titled.lastIndexOf(' ', 48)
  return (cut > 16 ? titled.slice(0, cut) : titled.slice(0, 48)).trim()
}

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim()
  if (!needle) return <>{text}</>
  const at = text.toLowerCase().indexOf(needle.toLowerCase())
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[4px] bg-ma-gold-400/40 px-px text-inherit">{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  )
}

/** Espace insécable avant « ? ! : » pour éviter un signe seul en début de ligne. */
function frenchSpacing(text: string) {
  return text.replace(/ ([?!:;»])/g, '\u202f$1').replace(/« /g, '«\u202f')
}

function useMedia(query: string) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const sync = () => setMatch(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [query])
  return match
}

/** Pastille de couleur des indicateurs : le ton porte le sens, le texte reste neutre. */
const KPI_DOT: Record<AssistantKpiTone, string> = {
  total: 'bg-ma-navy-500 dark:bg-ma-gray-300',
  positive: 'bg-status-success',
  negative: 'bg-status-danger',
  filter: 'bg-ma-gold-500',
  neutral: 'bg-ink-3',
}

function legacyTone(label: string): AssistantKpiTone {
  const value = label.toLowerCase()
  if (/inacti/.test(value)) return 'negative'
  if (/acti/.test(value)) return 'positive'
  if (/total/.test(value)) return 'total'
  if (/filt|rôle|role/.test(value)) return 'filter'
  return 'neutral'
}

function factColumns(fact: AssistantFact, rows: Array<Record<string, unknown>>): AssistantFactColumn[] {
  if (fact.columns && fact.columns.length > 0) return fact.columns
  if (rows.length === 0) return []
  return Object.keys(rows[0]).map((key) => ({ key, label: key, kind: key === 'action' || key === 'type' ? 'action' : null }))
}

function FactBlock({ fact }: { fact: AssistantFact }) {
  const kpis = fact.kpis ?? []
  const rows = fact.rows ?? []
  const columns = factColumns(fact, rows)
  return (
    <section className="ma-fact-in min-w-0 space-y-2.5">
      <p className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-2">
        <Database className="h-3.5 w-3.5 text-accent-ink" aria-hidden />
        {fact.title}
      </p>
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))]">
          {kpis.map((kpi, index) => (
            <div key={`${kpi.label}-${index}`} className="clay-field min-w-0 rounded-[14px] px-3 py-2.5">
              <p className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-ink-3">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', KPI_DOT[kpi.tone ?? legacyTone(kpi.label)])} aria-hidden />
                <span className="truncate">{kpi.label}</span>
              </p>
              <p className="mt-1 text-[20px] font-semibold leading-none tracking-[-0.03em] text-ink">{cell(kpi.value)}</p>
            </div>
          ))}
        </div>
      )}
      {rows.length > 0 && columns.length > 0 && (
        <div className="ma-scroll max-w-full overflow-x-auto rounded-[14px] bg-surface ring-1 ring-hairline">
          <Table minWidth={Math.max(360, columns.length * 120)} className="text-[13px]">
            <THead>
              <tr>
                {columns.map((column) => (
                  <Th key={column.key} className="py-2">
                    {column.label}
                  </Th>
                ))}
              </tr>
            </THead>
            <TBody>
              {rows.map((row, index) => (
                <Tr key={index}>
                  {columns.map((column) => {
                    const value = row[column.key]
                    const numeric = typeof value === 'number' || (typeof value === 'string' && /^-?\d[\d\s.,%]*$/.test(value.trim()))
                    return (
                      <Td
                        key={column.key}
                        align={numeric ? 'right' : 'left'}
                        className={cn('py-2', numeric && 'tabular-nums', value == null && 'text-ink-3')}
                      >
                        {column.kind === 'action' && typeof value === 'string' && value ? (
                          <Badge tone={auditActionTone(value)} dot>
                            {sentence(value.replaceAll('_', ' '))}
                          </Badge>
                        ) : (
                          cell(value)
                        )}
                      </Td>
                    )
                  })}
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </section>
  )
}

function fromStored(message: AssistantStoredMessage): ChatMessage {
  const feedback = message.feedback === 'up' || message.feedback === 'down' ? message.feedback : null
  return {
    id: message.id,
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content,
    at: message.at,
    facts: message.facts,
    unavailable: message.unavailable,
    tools: message.tools,
    feedback,
    persisted: true,
  }
}

function unavailableLabel(reason: string | null | undefined, fallback: string, t: (key: string) => string) {
  switch (reason) {
    case 'missing_key':
      return t('assistant.notConfigured')
    case 'invalid_key':
      return t('assistant.invalidKey')
    case 'rate_limited':
    case 'network':
    case 'groq_error':
    case 'internal':
      return t('assistant.transient')
    default:
      return fallback || t('assistant.unavailable')
  }
}

/** Petit bouton icône rond (barres d'outils de la conversation). */
function RoundIcon({
  label,
  onClick,
  children,
  active,
  tone = 'default',
  className,
  expanded,
}: {
  label: string
  onClick?: () => void
  children: ReactNode
  active?: boolean
  tone?: 'default' | 'gold' | 'danger'
  className?: string
  expanded?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      aria-expanded={expanded}
      onClick={onClick}
      className={cn(
        'press inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-3 [&_svg]:h-[17px] [&_svg]:w-[17px]',
        'hover:bg-ink/[0.06] hover:text-ink dark:hover:bg-white/[0.08]',
        'focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]',
        active && tone === 'gold' && 'text-accent-ink',
        active && tone === 'danger' && 'text-status-danger',
        expanded && 'bg-ink/[0.06] text-ink dark:bg-white/[0.08]',
        className,
      )}
    >
      {children}
    </button>
  )
}

/** Mini bouton sous une réponse (copier, régénérer, avis). */
function MiniAction({
  label,
  onClick,
  children,
  pressed,
  tone,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  pressed?: boolean
  tone?: 'gold' | 'danger'
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'press inline-flex h-7 w-7 items-center justify-center rounded-[9px] text-ink-3 [&_svg]:h-[15px] [&_svg]:w-[15px]',
        'hover:bg-ink/[0.06] hover:text-ink dark:hover:bg-white/[0.08]',
        'focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]',
        pressed && tone === 'gold' && 'bg-ma-gold-500/12 text-accent-ink',
        pressed && tone === 'danger' && 'bg-status-danger/10 text-status-danger',
      )}
    >
      {children}
    </button>
  )
}

function AssistantAvatar({ className }: { className?: string }) {
  return (
    <IconTile tone="navy" size="sm" className={cn('rounded-full', className)}>
      <Sparkles />
    </IconTile>
  )
}

export function AssistantIaPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const reduce = useReducedMotion()
  const wide = useMedia('(min-width: 1280px)')
  const roomy = useMedia('(min-width: 640px)')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const conversationIdRef = useRef<number | null>(null)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showJump, setShowJump] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [composerHeight, setComposerHeight] = useState(112)
  const stick = useRef(true)
  const scroller = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const composer = useRef<HTMLFormElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const me = useQuery({ queryKey: ['agents-me'], queryFn: fetchMe })
  const status = useQuery({ queryKey: ['assistant-status'], queryFn: fetchAssistantStatus, retry: false })
  const historyQuery = useQuery({
    queryKey: ['assistant-conversations', search, limit],
    queryFn: () => fetchAssistantConversations(search, 0, limit),
    retry: false,
  })

  const blocked = Boolean(status.data && !(status.data.available ?? status.data.configured))
  const firstName = me.data?.prenom?.trim()

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchDraft)
      setLimit(PAGE_SIZE)
    }, 280)
    return () => window.clearTimeout(timer)
  }, [searchDraft])

  useEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`
  }, [input])

  // Hauteur du compositeur flottant : la liste garde toujours le dernier message visible au-dessus.
  useLayoutEffect(() => {
    const el = composer.current
    if (!el) return
    const observer = new ResizeObserver(() => setComposerHeight(el.offsetHeight))
    observer.observe(el)
    setComposerHeight(el.offsetHeight)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    if (messages.length === 0) {
      el.scrollTop = 0
      return
    }
    if (stick.current) el.scrollTop = el.scrollHeight
  }, [messages, composerHeight])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (event.key === 'Escape') {
        if (abortRef.current) {
          abortRef.current.abort()
          return
        }
        setSuggestOpen(false)
        setMenuOpen(false)
        setHistoryOpen(false)
      }
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        area.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function assignConversation(id: number | null, nextTitle = '') {
    conversationIdRef.current = id
    setConversationId(id)
    setTitle(nextTitle)
  }

  function startNewChat() {
    assignConversation(null, '')
    setMessages([])
    setInput('')
    setEditingTitle(false)
    setMenuOpen(false)
    setHistoryOpen(false)
    window.setTimeout(() => area.current?.focus(), 0)
  }

  async function openConversation(id: number) {
    const detail = await fetchAssistantConversation(id)
    assignConversation(detail.id, detail.title)
    setMessages(detail.messages.map(fromStored))
    setHistoryOpen(false)
    setEditingTitle(false)
    stick.current = true
  }

  function onScroll() {
    const el = scroller.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    stick.current = near
    setShowJump(!near)
  }

  const send = useMutation({
    mutationFn: async (text: string) => {
      const history = messages
        .filter((message) => !message.unavailable && !message.error && message.id !== 'pending')
        .slice(-6)
        .map((message) => ({ role: message.role, content: message.content }))
      const controller = new AbortController()
      abortRef.current = controller
      return askAssistant(text, history, conversationIdRef.current, controller.signal)
    },
    onSuccess: (result, text) => {
      abortRef.current = null
      if (result.conversationId) assignConversation(result.conversationId, title || displayTitle(text))
      const translate = result.language ? i18n.getFixedT(result.language) : t
      setMessages((current) => [
        ...current.filter((message) => message.id !== 'pending'),
        {
          id: result.messageId || crypto.randomUUID(),
          role: 'assistant',
          content: result.unavailable ? unavailableLabel(result.unavailableReason, result.answer, translate) : result.answer,
          at: new Date().toISOString(),
          facts: result.facts,
          unavailable: result.unavailable,
          language: result.language,
          intent: result.intent,
          tools: result.tools,
          persisted: Boolean(result.messageId),
          error: result.unavailable,
          retryText: result.unavailable ? text : undefined,
        },
      ])
      setAnnouncement(t('assistant.answered'))
      void queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] })
      area.current?.focus()
    },
    onError: (err, text) => {
      abortRef.current = null
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      if (aborted) {
        setMessages((current) => current.filter((message) => message.id !== 'pending'))
        area.current?.focus()
        return
      }
      setMessages((current) => [
        ...current.filter((message) => message.id !== 'pending'),
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: err instanceof ApiError ? err.message : t('assistant.unavailable'),
          at: new Date().toISOString(),
          error: true,
          retryText: text,
        },
      ])
      setAnnouncement(t('assistant.unavailable'))
    },
  })

  function stop() {
    abortRef.current?.abort()
  }

  function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed || send.isPending || blocked || trimmed.length > MAX_CHARS) return
    setInput('')
    setSuggestOpen(false)
    stick.current = true
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content: trimmed, at: new Date().toISOString() },
      { id: 'pending', role: 'assistant', content: '' },
    ])
    send.mutate(trimmed)
    window.setTimeout(() => area.current?.focus(), 0)
  }

  const rename = useMutation({
    mutationFn: ({ id, next }: { id: number; next: string }) => renameAssistantConversation(id, next),
    onSuccess: (item) => {
      if (item.id === conversationId) setTitle(item.title)
      setEditingTitle(false)
      setRenamingId(null)
      void queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] })
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => archiveAssistantConversation(id),
    onSuccess: (_void, id) => {
      if (conversationId === id) startNewChat()
      setDeleteId(null)
      void queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] })
    },
  })

  const thumb = useMutation({
    mutationFn: ({ messageId, value }: { messageId: string; value: 'up' | 'down' | '' }) => {
      if (!conversationId) throw new Error('missing')
      return feedbackAssistant(conversationId, messageId, value)
    },
    onSuccess: (_void, variables) => {
      setMessages((current) =>
        current.map((message) => (message.id === variables.messageId ? { ...message, feedback: variables.value || null } : message)),
      )
    },
  })

  async function copyAnswer(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopiedId(message.id)
      window.setTimeout(() => setCopiedId((current) => (current === message.id ? null : current)), 1400)
    } catch {
      /* presse-papiers refusé */
    }
  }

  const items = historyQuery.data?.items ?? []
  const grouped = useMemo(() => {
    const order = ['today', 'yesterday', 'week', 'older'] as const
    const buckets = new Map<string, typeof items>()
    for (const item of items) {
      const key = dayGroup(item.lastActivityAt)
      buckets.set(key, [...(buckets.get(key) ?? []), item])
    }
    return order.filter((key) => buckets.has(key)).map((key) => ({ key, items: buckets.get(key) ?? [] }))
  }, [items])

  const lastAssistantId = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.id !== 'pending' && !message.error)?.id
  const showRail = wide ? !railCollapsed : historyOpen
  const counter = input.length >= MAX_CHARS * 0.8
  const offline = blocked || status.isError
  const statusText = status.isLoading
    ? t('assistantUi.status.checking', 'Vérification du service…')
    : offline
      ? t('assistantUi.status.offline', 'Service indisponible')
      : t('assistantUi.status.online', 'Service disponible')
  const deleteTarget = items.find((item) => item.id === deleteId)
  const headerTitle = title ? displayTitle(title) || t('assistant.untitled') : t('assistant.newChat')

  const statusDot = (
    <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
      {!offline && !status.isLoading && <span className="ma-pulse absolute inline-flex h-full w-full rounded-full bg-status-success/60" />}
      <span
        className={cn(
          'relative inline-flex h-2 w-2 rounded-full',
          status.isLoading ? 'bg-ink-3' : offline ? 'bg-status-danger' : 'bg-status-success',
        )}
      />
    </span>
  )

  const suggestionPills = (compact = false) => (
    <div className={cn('flex flex-wrap gap-2', compact ? 'justify-start' : 'justify-center')}>
      {SUGGESTIONS.flatMap((group) =>
        group.keys.map((key) => {
          const Icon = group.icon
          return (
            <button
              key={key}
              type="button"
              disabled={offline}
              onClick={() => submit(t(`assistant.suggestions.${key}`))}
              className={cn(
                'press group/pill inline-flex max-w-full items-center gap-2 rounded-full text-left font-medium text-ink-2',
                'hover:text-ink focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)] disabled:pointer-events-none disabled:opacity-45',
                compact
                  ? 'min-h-9 bg-ink/[0.04] px-3 py-1.5 text-[13px] hover:bg-ink/[0.07] dark:bg-white/[0.05] dark:hover:bg-white/[0.09]'
                  : 'glass-strong min-h-10 px-3.5 py-2 text-[13px] hover:-translate-y-px sm:text-[13.5px]',
              )}
            >
              <Icon className="h-[15px] w-[15px] shrink-0 text-accent-ink" aria-hidden />
              <span className="min-w-0">{frenchSpacing(t(`assistant.suggestions.${key}`))}</span>
            </button>
          )
        }),
      )}
    </div>
  )

  const rail = (strong = false) => (
    <aside
      className={cn(strong ? 'glass-strong' : 'glass', 'flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[var(--radius-ma)]')}
      aria-label={t('assistant.history')}
    >
      <div className="flex shrink-0 items-center gap-1 px-4 pb-2 pt-4">
        <h2 className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-[-0.02em] text-ink">{t('assistant.history')}</h2>
        <RoundIcon label={t('assistant.newChat')} onClick={startNewChat}>
          <SquarePen />
        </RoundIcon>
        {wide ? (
          <RoundIcon label={t('assistant.collapseRail')} onClick={() => setRailCollapsed(true)}>
            <PanelLeftClose />
          </RoundIcon>
        ) : (
          <RoundIcon label={t('assistant.close')} onClick={() => setHistoryOpen(false)}>
            <X />
          </RoundIcon>
        )}
      </div>
      <div className="shrink-0 px-3 pb-2">
        <SearchField
          value={searchDraft}
          onChange={setSearchDraft}
          placeholder={t('assistant.searchHistory')}
          className="min-w-0 sm:max-w-none"
        />
      </div>
      <div className="ma-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {historyQuery.isLoading && (
          <div className="space-y-1 px-1 pt-2" aria-hidden>
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="space-y-2 rounded-[14px] px-3 py-2.5" style={{ opacity: 1 - item * 0.15 }}>
                <Skeleton className="h-3.5 w-4/5" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            ))}
          </div>
        )}
        {historyQuery.isError && (
          <div className="space-y-2 px-1 pt-2">
            <Feedback tone="danger">{t('assistant.historyError')}</Feedback>
            <Button variant="outline" size="sm" onClick={() => void historyQuery.refetch()}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {t('assistant.retry')}
            </Button>
          </div>
        )}
        {!historyQuery.isLoading && !historyQuery.isError && items.length === 0 && !search && (
          <EmptyState icon={<MessagesSquare />} title={t('assistant.emptyHistory')} />
        )}
        {!historyQuery.isLoading && !historyQuery.isError && items.length === 0 && search && (
          <EmptyState icon={<SearchX />} title={t('assistant.noResults', { query: search })} />
        )}
        {grouped.map((group) => (
          <section key={group.key} className="pt-2">
            <p className="px-3 pb-1 pt-1 text-[12px] font-semibold text-ink-3">{t(`assistant.groups.${group.key}`)}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const label = displayTitle(item.title) || t('assistant.untitled')
                const active = conversationId === item.id
                return (
                  <li key={item.id}>
                    <div
                      className={cn(
                        'group relative rounded-[14px] transition-[background-color,box-shadow] duration-200',
                        active ? 'clay ring-1 ring-hairline' : 'hover:bg-ink/[0.04] dark:hover:bg-white/[0.05]',
                      )}
                    >
                      {active && <span className="absolute inset-y-3 left-1 w-[3px] rounded-full bg-ma-gold-500" aria-hidden />}
                      {renamingId === item.id ? (
                        <form
                          className="p-1.5"
                          onSubmit={(event) => {
                            event.preventDefault()
                            rename.mutate({ id: item.id, next: titleDraft })
                          }}
                        >
                          <input
                            value={titleDraft}
                            onChange={(event) => setTitleDraft(event.target.value)}
                            onBlur={() => setRenamingId(null)}
                            aria-label={t('assistant.renameTitle')}
                            className="clay-field h-9 w-full rounded-[11px] border-0 px-3 text-[13.5px] text-ink outline-none"
                            autoFocus
                          />
                        </form>
                      ) : (
                        <button
                          type="button"
                          className="block w-full rounded-[14px] py-2.5 pl-4 pr-16 text-left focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]"
                          title={item.title}
                          aria-current={active ? 'true' : undefined}
                          onClick={() => void openConversation(item.id)}
                        >
                          <p
                            className={cn(
                              'line-clamp-2 text-[13.5px] leading-[1.35]',
                              active ? 'font-semibold text-ink' : 'font-medium text-ink-2',
                            )}
                          >
                            <Highlight text={label} query={search} />
                          </p>
                          <p className="mt-1 text-[11.5px] text-ink-3">{relativeTime(item.lastActivityAt, i18n.language)}</p>
                        </button>
                      )}
                      {renamingId !== item.id && (
                        <div className="absolute right-1.5 top-1.5 flex gap-0.5 transition-opacity duration-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
                          <MiniAction
                            label={t('assistant.rename')}
                            onClick={() => {
                              setRenamingId(item.id)
                              setTitleDraft(item.title)
                            }}
                          >
                            <Pencil />
                          </MiniAction>
                          <MiniAction label={t('assistant.delete')} onClick={() => setDeleteId(item.id)}>
                            <Trash2 />
                          </MiniAction>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        {historyQuery.data?.hasMore && (
          <div className="px-2 pt-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setLimit((value) => value + PAGE_SIZE)}>
              {t('assistant.seeMore')}
            </Button>
          </div>
        )}
      </div>
    </aside>
  )

  return (
    <RequirePermission anyOf={['ADMIN_SYSTEME', 'DIRECTION']}>
      <div className="-mb-12 flex h-[calc(100dvh-108px)] min-h-[520px] flex-col sm:h-[calc(100dvh-112px)] md:h-[calc(100dvh-120px)]">
        <PageHeader
          className="shrink-0"
          kicker={t('assistant.kicker')}
          title={t('assistant.title')}
          subtitle={wide ? t('assistant.subtitle') : undefined}
          actions={
            roomy ? (
              <>
                <span className="glass-strong inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium text-ink-2">
                  {statusDot}
                  {statusText}
                </span>
                <Button variant="outline" onClick={startNewChat}>
                  <SquarePen className="h-4 w-4" aria-hidden />
                  {t('assistant.newChat')}
                </Button>
              </>
            ) : undefined
          }
        />

        <div className="relative mt-4 flex min-h-0 flex-1 sm:mt-5">
          {/* Historique : colonne en verre sur grand écran, panneau glissant ailleurs */}
          {wide ? (
            <AnimatePresence initial={false}>
              {showRail && (
                <motion.div
                  key="rail"
                  className="h-full shrink-0 overflow-hidden"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 316, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={reduce ? { duration: 0 } : spring.page}
                >
                  <div className="h-full w-[300px]">{rail()}</div>
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            <AnimatePresence>
              {showRail && (
                <>
                  <motion.button
                    key="scrim"
                    type="button"
                    aria-label={t('assistant.close')}
                    className="absolute inset-0 z-30 rounded-[var(--radius-ma)] bg-ma-navy-950/25 backdrop-blur-[2px]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setHistoryOpen(false)}
                  />
                  <motion.div
                    key="sheet"
                    className="absolute inset-y-0 left-0 z-40 w-[min(320px,calc(100%-2.5rem))]"
                    initial={reduce ? { opacity: 0 } : { x: -28, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { x: -28, opacity: 0 }}
                    transition={spring.popover}
                  >
                    <div className="h-full">{rail(true)}</div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          )}

          <section className="clay relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-ma)] ring-1 ring-hairline">
            {/* Barre de conversation en verre */}
            <header className="glass-strong absolute inset-x-0 top-0 z-20 flex h-[60px] items-center gap-1 px-2 [--glass-bg-strong:color-mix(in_srgb,var(--ma-surface)_93%,transparent)] [--glass-shadow:0_1px_0_var(--ma-hairline)] sm:px-3">
              {(!wide || railCollapsed) && (
                <RoundIcon
                  label={wide ? t('assistant.expandRail') : t('assistant.history')}
                  onClick={() => (wide ? setRailCollapsed(false) : setHistoryOpen(true))}
                >
                  <PanelLeft />
                </RoundIcon>
              )}
              <AssistantAvatar className="ml-1 hidden sm:inline-flex" />
              <div className="ml-1.5 min-w-0 flex-1">
                {editingTitle && conversationId ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      rename.mutate({ id: conversationId, next: titleDraft })
                    }}
                  >
                    <input
                      value={titleDraft}
                      onChange={(event) => setTitleDraft(event.target.value)}
                      onBlur={() => setEditingTitle(false)}
                      aria-label={t('assistant.renameTitle')}
                      className="clay-field h-9 w-full max-w-md rounded-[11px] border-0 px-3 text-[14px] font-semibold text-ink outline-none"
                      autoFocus
                    />
                  </form>
                ) : (
                  <>
                    <p
                      className="truncate text-[14.5px] font-semibold leading-tight tracking-[-0.01em] text-ink"
                      title={title || t('assistant.newChat')}
                    >
                      {headerTitle}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-3">
                      {statusDot}
                      <span className="truncate">{statusText}</span>
                    </p>
                  </>
                )}
              </div>
              {!roomy && (
                <RoundIcon label={t('assistant.newChat')} onClick={startNewChat}>
                  <SquarePen />
                </RoundIcon>
              )}
              <div className="relative">
                <RoundIcon label={t('assistant.menu')} expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
                  <MoreHorizontal />
                </RoundIcon>
                <AnimatePresence>
                  {menuOpen && (
                    <>
                      <button
                        type="button"
                        aria-hidden
                        tabIndex={-1}
                        className="fixed inset-0 z-30 cursor-default"
                        onClick={() => setMenuOpen(false)}
                      />
                      <motion.div
                        role="menu"
                        className="glass-strong absolute right-0 top-11 z-40 w-56 origin-top-right rounded-[16px] p-1.5"
                        initial={{ opacity: 0, scale: 0.94, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -4 }}
                        transition={spring.popover}
                      >
                        <MenuButton
                          icon={<SquarePen />}
                          onClick={() => {
                            setMenuOpen(false)
                            startNewChat()
                          }}
                        >
                          {t('assistant.newChat')}
                        </MenuButton>
                        <MenuButton
                          icon={<Pencil />}
                          disabled={!conversationId}
                          onClick={() => {
                            setTitleDraft(title)
                            setEditingTitle(true)
                            setMenuOpen(false)
                          }}
                        >
                          {t('assistant.rename')}
                        </MenuButton>
                        <div className="mx-2 my-1 h-px bg-hairline" />
                        <MenuButton
                          icon={<Trash2 />}
                          danger
                          disabled={!conversationId}
                          onClick={() => {
                            if (conversationId) setDeleteId(conversationId)
                            setMenuOpen(false)
                          }}
                        >
                          {t('assistant.delete')}
                        </MenuButton>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </header>

            <div
              ref={scroller}
              onScroll={onScroll}
              className="ma-scroll relative min-h-0 flex-1 overflow-y-auto bg-surface-2/50 px-3 pt-[76px] sm:px-6"
              style={{ paddingBottom: composerHeight + 20 }}
            >
              <div className="mx-auto flex min-h-full w-full max-w-[780px] flex-col gap-5">
                {(blocked || status.isError) && (
                  <div className="ma-fact-in space-y-2">
                    <Feedback tone={status.isError ? 'danger' : 'warning'}>
                      {status.isError
                        ? t('assistant.unavailable')
                        : status.data?.reason === 'missing_key'
                          ? t('assistant.notConfigured')
                          : status.data?.reason === 'invalid_key'
                            ? t('assistant.invalidKey')
                            : t('assistant.transient')}
                    </Feedback>
                    {status.isError && (
                      <Button variant="outline" size="sm" onClick={() => void status.refetch()}>
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        {t('assistant.retry')}
                      </Button>
                    )}
                  </div>
                )}

                {messages.length === 0 && (
                  <motion.div
                    className="m-auto flex w-full flex-col items-center px-1 py-4 text-center sm:py-6"
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={spring.page}
                  >
                    <div className="relative mb-4 sm:mb-5">
                      <IconTile tone="navy" size="lg" className="relative sm:h-14 sm:w-14 sm:rounded-[18px] sm:[&_svg]:h-7 sm:[&_svg]:w-7">
                        <Sparkles />
                      </IconTile>
                    </div>
                    <h2 className="text-[24px] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[28px]">
                      {firstName ? t('assistant.greeting', { name: firstName }) : t('assistant.greetingPlain')}
                    </h2>
                    <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-3 sm:text-[14px]">{t('assistant.capability')}</p>
                    <div className="mt-6 w-full max-w-[640px] sm:mt-7">
                      <p className="mb-3 text-[12.5px] font-medium text-ink-3">{t('assistant.suggested')}</p>
                      {suggestionPills()}
                    </div>
                  </motion.div>
                )}

                <AnimatePresence initial={false}>
                  {messages.map((message) => {
                    const mine = message.role === 'user'
                    return (
                      <motion.article
                        key={message.id}
                        layout={reduce ? false : 'position'}
                        initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                        transition={spring.snappy}
                        className={cn('flex min-w-0 gap-2.5', mine ? 'justify-end' : 'justify-start')}
                        style={{ transformOrigin: mine ? 'bottom right' : 'top left' }}
                      >
                        {!mine && <AssistantAvatar className="mt-0.5 hidden h-8 w-8 sm:inline-flex" />}
                        <div className={cn('min-w-0', mine ? 'flex max-w-[86%] flex-col items-end sm:max-w-[72%]' : 'flex-1')}>
                          {message.id === 'pending' ? (
                            <div
                              className="inline-flex items-center rounded-[20px] rounded-tl-[6px] bg-surface px-4 py-3.5 shadow-[var(--clay-1)] ring-1 ring-hairline"
                              role="status"
                            >
                              <span className="ma-typing flex items-center gap-1.5" aria-hidden>
                                <span />
                                <span />
                                <span />
                              </span>
                              <span className="sr-only">{t('assistant.typing')}</span>
                            </div>
                          ) : mine ? (
                            <div className="clay-navy rounded-[20px] rounded-br-[6px] px-4 py-2.5 text-[14.5px] leading-relaxed text-white">
                              <p className="whitespace-pre-wrap break-words">{message.content}</p>
                            </div>
                          ) : message.error ? (
                            <div
                              className="rounded-[20px] rounded-tl-[6px] bg-status-danger/[0.07] px-4 py-3 ring-1 ring-inset ring-status-danger/20"
                              lang={message.language ?? undefined}
                            >
                              <p className="flex items-start gap-2 text-[14px] leading-relaxed text-ink">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-danger" aria-hidden />
                                <span>{message.content}</span>
                              </p>
                              {message.retryText && (
                                <Button variant="outline" size="sm" className="mt-3" onClick={() => submit(message.retryText || '')}>
                                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                                  {t('assistant.retry')}
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div
                              className="min-w-0 rounded-[20px] rounded-tl-[6px] bg-surface px-4 py-3.5 shadow-[var(--clay-1)] ring-1 ring-hairline sm:px-5 sm:py-4"
                              lang={message.language ?? undefined}
                            >
                              <AssistantMarkdown text={message.content} />
                              {visibleFacts(message.facts, message.intent).length > 0 && (
                                <div className="mt-4 space-y-4 border-t border-hairline pt-4">
                                  {visibleFacts(message.facts, message.intent).map((fact, index) => (
                                    <FactBlock key={`${message.id}-${index}`} fact={fact} />
                                  ))}
                                </div>
                              )}
                              {message.tools && message.tools.length > 0 && (
                                <ul className="mt-4 flex flex-wrap gap-1.5">
                                  {message.tools.map((tool) => (
                                    <li
                                      key={tool}
                                      className="inline-flex h-6 items-center gap-1.5 rounded-full bg-ink/[0.045] px-2.5 text-[11.5px] font-medium text-ink-3 dark:bg-white/[0.06]"
                                    >
                                      <Database className="h-3 w-3" aria-hidden />
                                      {t(`assistant.tools.${tool}`, { defaultValue: tool })}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}

                          {message.id !== 'pending' && !mine && !message.error && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-0.5 pl-1">
                              <MiniAction
                                label={copiedId === message.id ? t('assistant.copied') : t('assistant.copy')}
                                onClick={() => void copyAnswer(message)}
                              >
                                {copiedId === message.id ? <Check className="text-status-success" /> : <Copy />}
                              </MiniAction>
                              {message.id === lastAssistantId && message.retryText == null && (
                                <MiniAction
                                  label={t('assistant.regenerate')}
                                  onClick={() => {
                                    const previous = [...messages].reverse().find((item) => item.role === 'user')
                                    if (previous) submit(previous.content)
                                  }}
                                >
                                  <RefreshCw />
                                </MiniAction>
                              )}
                              {message.persisted && conversationId && (
                                <>
                                  <MiniAction
                                    label={t('assistant.thumbUp')}
                                    pressed={message.feedback === 'up'}
                                    tone="gold"
                                    onClick={() => thumb.mutate({ messageId: message.id, value: message.feedback === 'up' ? '' : 'up' })}
                                  >
                                    <ThumbsUp />
                                  </MiniAction>
                                  <MiniAction
                                    label={t('assistant.thumbDown')}
                                    pressed={message.feedback === 'down'}
                                    tone="danger"
                                    onClick={() =>
                                      thumb.mutate({ messageId: message.id, value: message.feedback === 'down' ? '' : 'down' })
                                    }
                                  >
                                    <ThumbsDown />
                                  </MiniAction>
                                </>
                              )}
                              {message.at && (
                                <time className="ml-1.5 text-[11.5px] tabular-nums text-ink-3" dateTime={message.at}>
                                  {clock(message.at, i18n.language)}
                                </time>
                              )}
                            </div>
                          )}
                          {message.error && message.at && (
                            <time className="mt-1.5 block pl-1 text-[11.5px] tabular-nums text-ink-3" dateTime={message.at}>
                              {clock(message.at, i18n.language)}
                            </time>
                          )}
                          {mine && message.at && (
                            <time className="mt-1 pr-1 text-[11.5px] tabular-nums text-ink-3" dateTime={message.at}>
                              {clock(message.at, i18n.language)}
                            </time>
                          )}
                        </div>
                      </motion.article>
                    )
                  })}
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence>
              {showJump && (
                <motion.button
                  type="button"
                  className="glass-strong press absolute left-1/2 z-20 inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold text-ink focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]"
                  style={{ bottom: composerHeight + 8, x: '-50%' }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={spring.snappy}
                  onClick={() => {
                    stick.current = true
                    const el = scroller.current
                    if (el) el.scrollTop = el.scrollHeight
                    setShowJump(false)
                  }}
                >
                  <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                  {t('assistant.jump')}
                </motion.button>
              )}
            </AnimatePresence>

            {/* Zone de saisie flottante en verre */}
            <form
              ref={composer}
              className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-2.5 pb-2.5 pt-6 sm:px-6 sm:pb-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (send.isPending) stop()
                else submit(input)
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-2 from-30% via-surface-2/85 to-transparent"
                aria-hidden
              />
              <div className="pointer-events-auto relative mx-auto w-full max-w-[780px]">
                <AnimatePresence>
                  {suggestOpen && (
                    <motion.div
                      className="glass-strong absolute bottom-full left-0 z-30 mb-2 w-full max-w-[30rem] origin-bottom-left rounded-[20px] p-3"
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={spring.popover}
                    >
                      <p className="mb-2.5 px-1 text-[12.5px] font-semibold text-ink-3">{t('assistant.suggested')}</p>
                      {suggestionPills(true)}
                    </motion.div>
                  )}
                </AnimatePresence>
                <div
                  className={cn(
                    'glass-strong flex items-end gap-1.5 rounded-[26px] p-1.5 transition-[box-shadow] duration-200',
                    'focus-within:[box-shadow:var(--glass-edge),var(--glass-shadow),0_0_0_1.5px_rgb(220_170_40/0.55)]',
                    offline && 'opacity-80',
                  )}
                >
                  <RoundIcon
                    label={suggestOpen ? t('assistant.hideSuggested') : t('assistant.showSuggested')}
                    expanded={suggestOpen}
                    active={suggestOpen}
                    tone="gold"
                    className="mb-px"
                    onClick={() => setSuggestOpen((value) => !value)}
                  >
                    <Lightbulb />
                  </RoundIcon>
                  <textarea
                    ref={area}
                    rows={1}
                    value={input}
                    disabled={offline}
                    maxLength={MAX_CHARS}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        submit(input)
                      }
                    }}
                    aria-label={t('assistant.placeholder')}
                    style={{ outline: 'none' }}
                    placeholder={
                      blocked
                        ? t('assistant.notConfigured')
                        : roomy
                          ? t('assistant.placeholder')
                          : t('assistantUi.placeholderShort', 'Votre question…')
                    }
                    className="ma-scroll max-h-36 min-h-[38px] min-w-0 flex-1 resize-none bg-transparent px-1 py-[9px] text-[14.5px] leading-[1.4] text-ink outline-none placeholder:text-ink-3 focus-visible:outline-none disabled:cursor-not-allowed"
                  />
                  {counter && (
                    <span
                      className={cn(
                        'mb-[11px] shrink-0 text-[11.5px] tabular-nums',
                        input.length >= MAX_CHARS ? 'text-status-danger' : 'text-ink-3',
                      )}
                    >
                      {input.length}/{MAX_CHARS}
                    </span>
                  )}
                  {send.isPending ? (
                    <button
                      type="button"
                      aria-label={t('assistant.stop')}
                      title={t('assistant.stop')}
                      onClick={stop}
                      className="press clay-navy inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]"
                    >
                      <span className="h-3 w-3 rounded-[3px] bg-current" aria-hidden />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={offline || !input.trim()}
                      aria-label={t('assistant.send')}
                      title={t('assistant.send')}
                      className={cn(
                        'press btn-shine clay-gold inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ma-navy-950',
                        'focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]',
                        'disabled:pointer-events-none disabled:opacity-40 disabled:saturate-50',
                      )}
                    >
                      <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.6} aria-hidden />
                    </button>
                  )}
                </div>
                <p className="mt-2 px-2 text-center text-[11.5px] leading-snug text-ink-3">{t('assistant.disclaimer')}</p>
              </div>
            </form>
          </section>
        </div>
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
      </div>

      <Modal
        open={deleteId != null}
        onClose={() => setDeleteId(null)}
        title={t('assistant.delete')}
        subtitle={
          deleteTarget ? displayTitle(deleteTarget.title) || t('assistant.untitled') : deleteId === conversationId ? headerTitle : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              {t('assistant.cancel')}
            </Button>
            <Button variant="danger" disabled={remove.isPending} onClick={() => deleteId != null && remove.mutate(deleteId)}>
              <Trash2 className="h-4 w-4" aria-hidden />
              {t('assistant.delete')}
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-ink-2">{t('assistant.deleteConfirm')}</p>
      </Modal>
    </RequirePermission>
  )
}

function MenuButton({
  icon,
  children,
  onClick,
  disabled,
  danger,
}: {
  icon: ReactNode
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-10 w-full items-center gap-2.5 rounded-[11px] px-3 text-left text-[13.5px] font-medium transition-colors [&_svg]:h-4 [&_svg]:w-4',
        'focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)] disabled:pointer-events-none disabled:opacity-40',
        danger ? 'text-status-danger hover:bg-status-danger/10' : 'text-ink hover:bg-ink/[0.05] dark:hover:bg-white/[0.07]',
      )}
    >
      <span className={cn('shrink-0', danger ? 'text-status-danger' : 'text-ink-3')}>{icon}</span>
      {children}
    </button>
  )
}
