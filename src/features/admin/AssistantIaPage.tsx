import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  Check,
  Copy,
  History,
  Lightbulb,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Shield,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, auditActionTone } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { PageHeader } from '../../components/ui/page-header'
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
  if (value == null) return '—'
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
  }).format(date)
}

function displayTitle(raw: string) {
  const text = raw.replace(/\s+/g, ' ').trim().replace(/^(hey|hello|salut|bonjour)(?:[,!.\s]+|$)/i, '').trim()
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
      <mark className="rounded-sm bg-ma-gold-400/45 text-inherit">{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  )
}

function useWide() {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 1280px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)')
    const sync = () => setWide(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])
  return wide
}

const KPI_TONES: Record<AssistantKpiTone, string> = {
  total: 'border-ma-navy-800/15 bg-ma-navy-800/[0.04] dark:border-white/12 dark:bg-white/[0.05]',
  positive: 'border-status-success/25 bg-status-success/[0.06]',
  negative: 'border-status-danger/20 bg-ma-navy-800/[0.04] dark:bg-white/[0.03]',
  filter: 'border-ma-gold-500/35 bg-ma-gold-400/10',
  neutral: 'border-ma-line bg-white dark:border-white/10 dark:bg-white/5',
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
    <div className="mt-3 min-w-0 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ma-gold-600 dark:text-ma-gold-400">{fact.title}</p>
      {kpis.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-2">
          {kpis.map((kpi, index) => (
            <div key={`${kpi.label}-${index}`} className={cn('rounded-xl border px-3 py-2', KPI_TONES[kpi.tone ?? legacyTone(kpi.label)])}>
              <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-ma-muted">{kpi.label}</p>
              <p className="font-display text-lg tabular-nums text-ma-navy-900 dark:text-ma-white">{cell(kpi.value)}</p>
            </div>
          ))}
        </div>
      )}
      {rows.length > 0 && columns.length > 0 && (
        <div className="max-w-full overflow-x-auto rounded-xl border border-ma-line dark:border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-ma-navy-900 text-[10px] uppercase tracking-wider text-ma-gold-300">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className="whitespace-nowrap px-2.5 py-2 font-semibold">{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-ma-line even:bg-ma-navy-800/[0.04] dark:border-white/10 dark:even:bg-white/[0.04]">
                  {columns.map((column) => {
                    const value = row[column.key]
                    const numeric = typeof value === 'number' || (typeof value === 'string' && /^-?\d[\d\s.,%]*$/.test(value.trim()))
                    return (
                      <td key={column.key} className={cn('px-2.5 py-1.5', numeric && 'text-right tabular-nums')}>
                        {column.kind === 'action' && typeof value === 'string' && value ? (
                          <Badge tone={auditActionTone(value)}>{value}</Badge>
                        ) : cell(value)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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

export function AssistantIaPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const wide = useWide()
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
  const stick = useRef(true)
  const scroller = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)
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

  useEffect(() => {
    if (!stick.current) return
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

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
      setMessages((current) => current.map((message) => (
        message.id === variables.messageId ? { ...message, feedback: variables.value || null } : message
      )))
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

  const lastAssistantId = [...messages].reverse().find((message) => message.role === 'assistant' && message.id !== 'pending' && !message.error)?.id
  const showRail = wide ? !railCollapsed : historyOpen
  const counter = input.length >= MAX_CHARS * 0.8

  const suggestionCards = (compact = false) => (
    <div className={cn(compact ? 'flex flex-col gap-1' : 'grid gap-3 md:grid-cols-2 xl:grid-cols-3')}>
      {SUGGESTIONS.map((group) => {
        const Icon = group.icon
        return (
          <section key={group.group} className={cn(!compact && 'space-y-2')}>
            {!compact && (
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ma-gold-600 dark:text-ma-gold-400">
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {t(`assistant.categories.${group.group}`)}
              </p>
            )}
            {group.keys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => submit(t(`assistant.suggestions.${key}`))}
                className={cn(
                  'w-full rounded-2xl border border-ma-line bg-white px-3 py-2.5 text-left text-sm text-ma-navy-900 transition duration-200',
                  'hover:-translate-y-0.5 hover:border-ma-gold-500 hover:shadow-ma-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ma-gold-400',
                  'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                  'dark:border-white/10 dark:bg-ma-navy-900 dark:text-ma-white',
                  compact && 'rounded-xl py-2',
                )}
              >
                {t(`assistant.suggestions.${key}`)}
              </button>
            ))}
          </section>
        )
      })}
    </div>
  )

  return (
    <RequirePermission anyOf={['ADMIN_SYSTEME', 'DIRECTION']}>
      <div className="flex h-[calc(100dvh-3.5rem-2rem)] max-h-[calc(100dvh-3.5rem-2rem)] min-h-0 flex-col overflow-hidden md:h-[calc(100dvh-3.5rem-3rem)] md:max-h-[calc(100dvh-3.5rem-3rem)]">
        <PageHeader className="shrink-0" kicker={t('assistant.kicker')} title={t('assistant.title')} subtitle={t('assistant.subtitle')} />
        <div className="relative mt-3 min-h-0 flex-1">
          {showRail && (
            <aside className={cn(
              'absolute inset-y-0 left-0 z-30 flex min-h-0 w-[300px] flex-col overflow-hidden rounded-2xl border border-ma-line bg-white shadow-ma-sm dark:border-white/10 dark:bg-ma-navy-800',
              !wide && 'inset-0 w-auto',
            )}>
              <div className="flex items-center justify-between gap-2 border-b border-ma-line px-3 py-3 dark:border-white/10">
                <Button className="w-full" onClick={startNewChat}>
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {t('assistant.newChat')}
                </Button>
                {!wide && (
                  <button type="button" className="rounded-xl p-2 text-ma-muted focus-visible:ring-2 focus-visible:ring-ma-gold-400" aria-label={t('assistant.close')} onClick={() => setHistoryOpen(false)}>
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <label className="relative mx-3 mt-3 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ma-muted" aria-hidden />
                <input
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder={t('assistant.searchHistory')}
                  aria-label={t('assistant.searchHistory')}
                  className="w-full rounded-xl border border-ma-line bg-white py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ma-gold-400 dark:border-white/10 dark:bg-ma-navy-900 dark:text-ma-white"
                />
              </label>
              <div className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto px-2 pb-3">
                {historyQuery.isLoading && (
                  <div className="space-y-2 px-1" aria-hidden>
                    {[0, 1, 2, 3].map((item) => <div key={item} className="h-12 animate-pulse rounded-xl bg-ma-navy-800/10 dark:bg-white/10" />)}
                  </div>
                )}
                {historyQuery.isError && (
                  <div className="px-1">
                    <p className="text-sm text-status-danger">{t('assistant.historyError')}</p>
                    <button type="button" className="mt-2 text-sm font-semibold text-ma-gold-600 underline" onClick={() => void historyQuery.refetch()}>
                      {t('assistant.retry')}
                    </button>
                  </div>
                )}
                {!historyQuery.isLoading && items.length === 0 && !search && (
                  <p className="px-2 py-8 text-center text-sm text-ma-muted">{t('assistant.emptyHistory')}</p>
                )}
                {!historyQuery.isLoading && items.length === 0 && search && (
                  <p className="px-2 py-8 text-center text-sm text-ma-muted">{t('assistant.noResults', { query: search })}</p>
                )}
                {grouped.map((group) => (
                  <section key={group.key}>
                    <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ma-muted">{t(`assistant.groups.${group.key}`)}</p>
                    <ul className="space-y-1">
                      {group.items.map((item) => {
                        const label = displayTitle(item.title) || t('assistant.untitled')
                        const active = conversationId === item.id
                        return (
                          <li key={item.id}>
                            <div className={cn(
                              'group relative rounded-xl border py-2 pl-3 pr-2',
                              active
                                ? 'border-ma-gold-500/40 bg-ma-gold-400/15 shadow-[inset_3px_0_0_var(--ma-gold-500)]'
                                : 'border-transparent hover:bg-ma-paper dark:hover:bg-white/5',
                            )}>
                              {renamingId === item.id ? (
                                <form
                                  onSubmit={(event) => {
                                    event.preventDefault()
                                    rename.mutate({ id: item.id, next: titleDraft })
                                  }}
                                >
                                  <input
                                    value={titleDraft}
                                    onChange={(event) => setTitleDraft(event.target.value)}
                                    aria-label={t('assistant.renameTitle')}
                                    className="w-full rounded-lg border border-ma-line bg-white px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ma-gold-400 dark:border-white/10 dark:bg-ma-navy-900"
                                    autoFocus
                                  />
                                </form>
                              ) : (
                                <button type="button" className="block w-full pr-14 text-left" title={item.title} onClick={() => void openConversation(item.id)}>
                                  <p className="break-words text-sm font-medium leading-5 text-ma-navy-900 dark:text-ma-white">
                                    <Highlight text={label} query={search} />
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-ma-muted">{relativeTime(item.lastActivityAt, i18n.language)}</p>
                                </button>
                              )}
                              <div className="absolute right-1 top-1.5 flex opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                                <button
                                  type="button"
                                  className="rounded-lg p-1 text-ma-muted hover:text-ma-navy-900 focus-visible:ring-2 focus-visible:ring-ma-gold-400 dark:hover:text-ma-gold-300"
                                  aria-label={t('assistant.rename')}
                                  onClick={() => {
                                    setRenamingId(item.id)
                                    setTitleDraft(item.title)
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg p-1 text-ma-muted hover:text-status-danger focus-visible:ring-2 focus-visible:ring-ma-gold-400"
                                  aria-label={t('assistant.delete')}
                                  onClick={() => setDeleteId(item.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              {deleteId === item.id && (
                                <div className="mt-2 flex items-center gap-2 text-xs">
                                  <span className="text-ma-muted">{t('assistant.deleteConfirm')}</span>
                                  <button type="button" className="font-semibold text-status-danger" onClick={() => remove.mutate(item.id)}>{t('assistant.delete')}</button>
                                  <button type="button" className="text-ma-muted" onClick={() => setDeleteId(null)}>{t('assistant.cancel')}</button>
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
                  <button type="button" className="w-full py-2 text-center text-xs font-semibold uppercase tracking-wider text-ma-gold-700 dark:text-ma-gold-400" onClick={() => setLimit((value) => value + PAGE_SIZE)}>
                    {t('assistant.seeMore')}
                  </button>
                )}
              </div>
            </aside>
          )}

          <section className={cn(
            'absolute inset-y-0 right-0 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-ma-line bg-white shadow-ma-sm dark:border-white/10 dark:bg-ma-navy-800',
            wide && showRail ? 'left-[312px]' : 'left-0',
          )}>
            <header className="flex shrink-0 items-center gap-2 border-b border-ma-line px-3 py-2.5 dark:border-white/10">
              <button
                type="button"
                className="rounded-xl p-2 text-ma-muted focus-visible:ring-2 focus-visible:ring-ma-gold-400 xl:hidden"
                aria-label={t('assistant.history')}
                onClick={() => setHistoryOpen(true)}
              >
                <History className="h-4 w-4" />
              </button>
              {wide && (
                <button
                  type="button"
                  className="hidden rounded-xl p-2 text-ma-muted focus-visible:ring-2 focus-visible:ring-ma-gold-400 xl:inline-flex"
                  aria-label={railCollapsed ? t('assistant.expandRail') : t('assistant.collapseRail')}
                  onClick={() => setRailCollapsed((value) => !value)}
                >
                  <History className="h-4 w-4" />
                </button>
              )}
              {deleteId === conversationId && conversationId && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-ma-muted">{t('assistant.deleteConfirm')}</span>
                  <button type="button" className="font-semibold text-status-danger" onClick={() => remove.mutate(conversationId)}>{t('assistant.delete')}</button>
                  <button type="button" className="text-ma-muted" onClick={() => setDeleteId(null)}>{t('assistant.cancel')}</button>
                </div>
              )}
              {editingTitle && conversationId ? (
                <form
                  className="min-w-0 flex-1"
                  onSubmit={(event) => {
                    event.preventDefault()
                    rename.mutate({ id: conversationId, next: titleDraft })
                  }}
                >
                  <input
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    aria-label={t('assistant.renameTitle')}
                    className="w-full rounded-lg border border-ma-line bg-white px-2 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ma-gold-400 dark:border-white/10 dark:bg-ma-navy-900"
                    autoFocus
                  />
                </form>
              ) : (
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ma-navy-900 dark:text-ma-white" title={title || t('assistant.newChat')}>
                  {title ? (displayTitle(title) || t('assistant.untitled')) : t('assistant.newChat')}
                </p>
              )}
              <div className="relative">
                <button
                  type="button"
                  className="rounded-xl p-2 text-ma-muted focus-visible:ring-2 focus-visible:ring-ma-gold-400"
                  aria-label={t('assistant.menu')}
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((value) => !value)}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-ma-line bg-white p-1 shadow-ma-md dark:border-white/10 dark:bg-ma-navy-900">
                    <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-ma-paper dark:hover:bg-white/5" onClick={() => { setMenuOpen(false); startNewChat() }}>{t('assistant.newChat')}</button>
                    <button
                      type="button"
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-ma-paper disabled:opacity-40 dark:hover:bg-white/5"
                      disabled={!conversationId}
                      onClick={() => {
                        setTitleDraft(title)
                        setEditingTitle(true)
                        setMenuOpen(false)
                      }}
                    >
                      {t('assistant.rename')}
                    </button>
                    <button
                      type="button"
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-status-danger hover:bg-ma-paper disabled:opacity-40 dark:hover:bg-white/5"
                      disabled={!conversationId}
                      onClick={() => {
                        if (conversationId) setDeleteId(conversationId)
                        setMenuOpen(false)
                      }}
                    >
                      {t('assistant.delete')}
                    </button>
                  </div>
                )}
              </div>
            </header>

            {(blocked || status.isError) && (
              <div className="shrink-0 border-b border-ma-line px-4 py-3 dark:border-white/10">
                <Feedback tone="warning">
                  {status.isError ? t('assistant.unavailable') : status.data?.reason === 'missing_key' ? t('assistant.notConfigured') : status.data?.reason === 'invalid_key' ? t('assistant.invalidKey') : t('assistant.transient')}
                </Feedback>
                {status.isError && (
                  <button type="button" className="mt-2 text-sm font-semibold text-ma-gold-600 underline" onClick={() => void status.refetch()}>{t('assistant.retry')}</button>
                )}
              </div>
            )}

            <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center px-2 py-6 text-center">
                    <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-ma-navy-900 text-ma-gold-400 shadow-ma-md">
                      <span className="pointer-events-none absolute -inset-3 rounded-full bg-[radial-gradient(circle,var(--ma-gold-400)_0%,transparent_70%)] opacity-40" aria-hidden />
                      <Sparkles className="relative h-6 w-6" aria-hidden />
                    </div>
                    <h2 className="font-display text-2xl text-ma-navy-900 dark:text-ma-gold-300">
                      {firstName ? t('assistant.greeting', { name: firstName }) : t('assistant.greetingPlain')}
                    </h2>
                    <p className="mt-2 max-w-md text-sm text-ma-muted">{t('assistant.capability')}</p>
                    <div className="mt-6 w-full text-left">{suggestionCards()}</div>
                  </div>
                )}
                {messages.map((message) => (
                  <article key={message.id} className={cn('flex gap-2', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {message.role === 'assistant' && (
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ma-navy-900 text-ma-gold-400" aria-hidden>
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div className={cn('min-w-0', message.role === 'user' ? 'max-w-[75%]' : 'max-w-[720px] flex-1')}>
                      {message.id === 'pending' ? (
                        <div className="ma-typing flex items-center gap-1 py-2" role="status" aria-live="off">
                          <span /><span /><span />
                          <span className="sr-only">{t('assistant.typing')}</span>
                        </div>
                      ) : message.role === 'user' ? (
                        <div className="rounded-[16px_16px_4px_16px] bg-ma-navy-800 px-4 py-3 text-sm leading-relaxed text-ma-white">
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        </div>
                      ) : (
                        <div lang={message.language ?? undefined}>
                          {message.error ? (
                            <p className="text-sm text-status-danger">{message.content}</p>
                          ) : (
                            <AssistantMarkdown text={message.content} />
                          )}
                          {visibleFacts(message.facts, message.intent).map((fact, index) => (
                            <FactBlock key={`${message.id}-${index}`} fact={fact} />
                          ))}
                          {message.tools && message.tools.length > 0 && (
                            <ul className="mt-3 flex flex-wrap gap-1.5">
                              {message.tools.map((tool) => (
                                <li key={tool} className="rounded-full border border-ma-gold-500/40 bg-ma-gold-400/15 px-2.5 py-1 text-[11px] font-semibold text-ma-navy-800 dark:text-ma-gold-300">
                                  {t(`assistant.tools.${tool}`, { defaultValue: tool })}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      {message.id !== 'pending' && message.role === 'assistant' && (
                        <div className="mt-2 flex flex-wrap items-center gap-1 text-ma-muted">
                          <button type="button" className="rounded-lg p-1 focus-visible:ring-2 focus-visible:ring-ma-gold-400" aria-label={t('assistant.copy')} onClick={() => void copyAnswer(message)}>
                            {copiedId === message.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                          {message.id === lastAssistantId && message.retryText == null && (
                            <button
                              type="button"
                              className="rounded-lg p-1 focus-visible:ring-2 focus-visible:ring-ma-gold-400"
                              aria-label={t('assistant.regenerate')}
                              onClick={() => {
                                const previous = [...messages].reverse().find((item) => item.role === 'user')
                                if (previous) submit(previous.content)
                              }}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {message.error && message.retryText && (
                            <button type="button" className="rounded-lg px-2 py-1 text-xs font-semibold text-ma-gold-600" onClick={() => submit(message.retryText || '')}>
                              {t('assistant.retry')}
                            </button>
                          )}
                          {message.persisted && conversationId && !message.error && (
                            <>
                              <button type="button" className={cn('rounded-lg p-1 focus-visible:ring-2 focus-visible:ring-ma-gold-400', message.feedback === 'up' && 'text-ma-gold-600')} aria-label={t('assistant.thumbUp')} aria-pressed={message.feedback === 'up'} onClick={() => thumb.mutate({ messageId: message.id, value: message.feedback === 'up' ? '' : 'up' })}>
                                <ThumbsUp className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" className={cn('rounded-lg p-1 focus-visible:ring-2 focus-visible:ring-ma-gold-400', message.feedback === 'down' && 'text-status-danger')} aria-label={t('assistant.thumbDown')} aria-pressed={message.feedback === 'down'} onClick={() => thumb.mutate({ messageId: message.id, value: message.feedback === 'down' ? '' : 'down' })}>
                                <ThumbsDown className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          {message.at && <time className="ml-1 text-[11px]" dateTime={message.at}>{clock(message.at, i18n.language)}</time>}
                        </div>
                      )}
                      {message.role === 'user' && message.at && (
                        <p className="mt-1 text-right text-[11px] text-ma-muted"><time dateTime={message.at}>{clock(message.at, i18n.language)}</time></p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {showJump && (
                <button
                  type="button"
                  className="sticky bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-ma-line bg-ma-white px-3 py-1.5 text-xs font-semibold text-ma-navy-900 shadow-ma-sm focus-visible:ring-2 focus-visible:ring-ma-gold-400 dark:border-white/10 dark:bg-ma-navy-900 dark:text-ma-white"
                  onClick={() => {
                    stick.current = true
                    const el = scroller.current
                    if (el) el.scrollTop = el.scrollHeight
                    setShowJump(false)
                  }}
                >
                  <ArrowDown className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                  {t('assistant.jump')}
                </button>
              )}
            </div>

            <form
              className="shrink-0 border-t border-ma-line bg-white px-3 py-3 dark:border-white/10 dark:bg-ma-navy-900/40"
              onSubmit={(event) => {
                event.preventDefault()
                if (send.isPending) stop()
                else submit(input)
              }}
            >
              <div className="mx-auto w-full max-w-[760px]">
                <div className="rounded-2xl border border-ma-line bg-white p-2 shadow-ma-sm dark:border-white/10 dark:bg-ma-navy-900">
                  <textarea
                    ref={area}
                    rows={1}
                    value={input}
                    disabled={blocked || status.isError}
                    maxLength={MAX_CHARS}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        submit(input)
                      }
                    }}
                    placeholder={blocked ? t('assistant.notConfigured') : t('assistant.placeholder')}
                    className="max-h-36 min-h-[42px] w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ma-gold-400 disabled:opacity-60 dark:text-ma-white"
                  />
                  <div className="flex items-center justify-between gap-2 px-1">
                    <div className="relative">
                      <button
                        type="button"
                        className="rounded-xl px-2 py-1 text-xs font-semibold text-ma-gold-700 focus-visible:ring-2 focus-visible:ring-ma-gold-400 dark:text-ma-gold-400"
                        aria-expanded={suggestOpen}
                        onClick={() => setSuggestOpen((value) => !value)}
                      >
                        {t('assistant.suggested')}
                      </button>
                      {suggestOpen && (
                        <div className="absolute bottom-9 left-0 z-20 w-[min(100vw-3rem,22rem)] rounded-2xl border border-ma-line bg-white p-2 shadow-ma-md dark:border-white/10 dark:bg-ma-navy-900">
                          {suggestionCards(true)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {counter && <span className="text-[11px] tabular-nums text-ma-muted">{input.length}/{MAX_CHARS}</span>}
                      {send.isPending ? (
                        <Button type="button" aria-label={t('assistant.stop')} onClick={stop}>
                          <Square className="h-4 w-4" aria-hidden />
                          {t('assistant.stop')}
                        </Button>
                      ) : (
                        <Button type="submit" disabled={blocked || status.isError || !input.trim()} aria-label={t('assistant.send')}>
                          <Send className="h-4 w-4" aria-hidden />
                          {t('assistant.send')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-center text-[11px] text-ma-muted">{t('assistant.disclaimer')}</p>
              </div>
            </form>
          </section>
        </div>
        <p className="sr-only" aria-live="polite">{announcement}</p>
      </div>
    </RequirePermission>
  )
}
