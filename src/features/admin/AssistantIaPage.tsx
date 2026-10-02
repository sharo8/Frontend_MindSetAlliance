import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, History, PanelRight, Search, Send, Sparkles, SquarePen, Trash2, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge, auditActionTone } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { PageHeader } from '../../components/ui/page-header'
import {
  archiveAssistantConversation,
  askAssistant,
  fetchAssistantConversation,
  fetchAssistantConversations,
  fetchAssistantStatus,
  type AssistantFact,
  type AssistantFactColumn,
  type AssistantKpiTone,
  type AssistantStoredMessage,
} from '../../lib/api/assistant'
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
}

/** Cartes / tableaux : list & detail toujours ; other seulement si le fait a des lignes. */
function visibleFacts(facts: AssistantFact[] | undefined, intent: string | null | undefined): AssistantFact[] {
  if (!facts?.length) return []
  const i = (intent ?? 'other').toLowerCase()
  if (i === 'count') return []
  if (i === 'list' || i === 'detail') return facts
  return facts.filter((f) => (f.rows?.length ?? 0) > 0)
}

const SUGGEST_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const
const PAGE_SIZE = 20

function cell(value: unknown) {
  if (value == null) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Le modèle met les chiffres clés en **gras** Markdown ; le reste reste du texte brut. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*\n]+\*\*)/g)
  return (
    <p className="whitespace-pre-wrap leading-relaxed">
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
          <strong key={i} className="font-semibold text-ma-navy-950 dark:text-ma-gold-300">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        ),
      )}
    </p>
  )
}

function formatWhen(iso: string | undefined, lang: string) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const locale = lang === 'en' ? 'en-GB' : lang === 'sw' ? 'sw-CD' : lang === 'ln' ? 'fr-CD' : 'fr-CD'
  return date.toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const KPI_TONES: Record<AssistantKpiTone, { card: string; bar: string; label: string; value: string }> = {
  total: {
    card: 'border-ma-navy-800/15 bg-ma-navy-800/[0.04] dark:border-white/12 dark:bg-white/[0.05]',
    bar: 'bg-ma-navy-700 dark:bg-ma-gray-300',
    label: 'text-ma-navy-700 dark:text-ma-gray-300',
    value: 'text-ma-navy-900 dark:text-white',
  },
  positive: {
    card: 'border-status-success/25 bg-status-success/[0.06] dark:border-status-success/30 dark:bg-status-success/10',
    bar: 'bg-status-success/80',
    label: 'text-status-success',
    value: 'text-ma-navy-900 dark:text-white',
  },
  negative: {
    card: 'border-status-danger/20 bg-slate-500/[0.05] dark:border-status-danger/25 dark:bg-white/[0.03]',
    bar: 'bg-status-danger/60',
    label: 'text-ma-muted dark:text-ma-gray-300',
    value: 'text-ma-navy-900/75 dark:text-ma-gray-300',
  },
  filter: {
    card: 'border-ma-gold-500/35 bg-ma-gold-400/10 dark:border-ma-gold-500/30 dark:bg-ma-gold-400/10',
    bar: 'bg-ma-gold-500',
    label: 'text-ma-gold-600 dark:text-ma-gold-400',
    value: 'text-ma-navy-900 dark:text-ma-gold-300',
  },
  neutral: {
    card: 'border-ma-line/90 bg-white dark:border-white/10 dark:bg-white/5',
    bar: 'bg-ma-line dark:bg-white/15',
    label: 'text-ma-muted',
    value: 'text-ma-navy-900 dark:text-ma-gold-300',
  },
}

/** Conversations enregistrées avant l'ajout de `tone` : déduit le sens depuis le libellé. */
function legacyTone(label: string): AssistantKpiTone {
  const l = label.toLowerCase()
  if (/inacti/.test(l)) return 'negative'
  if (/acti/.test(l)) return 'positive'
  if (/total/.test(l)) return 'total'
  if (/filt|rôle|role/.test(l)) return 'filter'
  return 'neutral'
}

function factColumns(fact: AssistantFact, rows: Array<Record<string, unknown>>): AssistantFactColumn[] {
  if (fact.columns && fact.columns.length > 0) return fact.columns
  if (rows.length === 0) return []
  return Object.keys(rows[0]).map((key) => ({ key, label: key, kind: key === 'action' || key === 'type' ? 'action' : null }))
}

function FactBlock({ fact, index }: { fact: AssistantFact; index: number }) {
  const kpis = fact.kpis ?? []
  const rows = fact.rows ?? []
  const columns = factColumns(fact, rows)
  const zebra = rows.length > 1
  const base = index * 90
  return (
    <div className="ma-fact-in mt-3 min-w-0 space-y-2" style={{ animationDelay: `${base}ms` }}>
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ma-gold-600 dark:text-ma-gold-400">
        <span className="h-px w-4 bg-ma-gold-500/70" aria-hidden />
        {fact.title}
      </p>
      {kpis.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-2">
          {kpis.map((kpi, i) => {
            const tone = KPI_TONES[kpi.tone ?? legacyTone(kpi.label)] ?? KPI_TONES.neutral
            return (
              <div
                key={`${kpi.label}-${i}`}
                className={cn('ma-fact-in relative min-w-0 overflow-hidden rounded-xl border py-2 pl-3.5 pr-2.5', tone.card)}
                style={{ animationDelay: `${base + 60 + i * 60}ms` }}
              >
                <span className={cn('absolute inset-y-0 left-0 w-[3px]', tone.bar)} aria-hidden />
                <p className={cn('truncate text-[10px] font-semibold uppercase tracking-wider', tone.label)} title={kpi.label}>
                  {kpi.label}
                </p>
                <p className={cn('font-display text-lg leading-tight tabular-nums', tone.value)}>{cell(kpi.value)}</p>
              </div>
            )
          })}
        </div>
      )}
      {rows.length > 0 && columns.length > 0 && (
        <div
          className="ma-fact-in max-w-full overflow-x-auto rounded-xl border border-ma-navy-800/15 dark:border-white/10"
          style={{ animationDelay: `${base + 80 + kpis.length * 60}ms` }}
        >
          <table className="w-full text-left text-xs">
            <thead className="bg-ma-navy-900 text-[10px] uppercase tracking-wider text-ma-gold-300 dark:bg-ma-navy-950">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} scope="col" className="whitespace-nowrap px-2 py-2 font-semibold sm:px-2.5">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={cn(
                    'border-t border-ma-line/70 transition-colors hover:bg-ma-gold-400/10 dark:border-white/8',
                    zebra && 'even:bg-ma-navy-800/[0.035] dark:even:bg-white/[0.035]',
                  )}
                >
                  {columns.map((col) => {
                    const value = row[col.key]
                    return (
                      <td key={col.key} className="px-2 py-1.5 align-middle sm:px-2.5">
                        {col.kind === 'action' && typeof value === 'string' && value ? (
                          <Badge tone={auditActionTone(value)} className="whitespace-nowrap px-2 font-mono text-[10px] normal-case tracking-normal">
                            {value}
                          </Badge>
                        ) : (
                          <span className="break-words">{cell(value)}</span>
                        )}
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

function TypingDots({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-ma-muted" role="status" aria-live="polite">
      <div className="ma-typing flex items-center gap-1 px-1 py-1" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <span className="text-xs">{label}</span>
    </div>
  )
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

function fromStored(msg: AssistantStoredMessage): ChatMessage {
  return {
    id: msg.id,
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content,
    at: msg.at,
    facts: msg.facts,
    unavailable: msg.unavailable,
  }
}

export function AssistantIaPage() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<number | null>(null)
  const conversationIdRef = useRef<number | null>(null)
  const [paneKey, setPaneKey] = useState('new')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)

  const status = useQuery({
    queryKey: ['assistant-status'],
    queryFn: fetchAssistantStatus,
    retry: false,
  })
  const historyQuery = useQuery({
    queryKey: ['assistant-conversations', search, limit],
    queryFn: () => fetchAssistantConversations(search, 0, limit),
    retry: false,
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchDraft)
      setLimit(PAGE_SIZE)
    }, 280)
    return () => window.clearTimeout(timer)
  }, [searchDraft])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`
  }, [input])

  function assignConversation(id: number | null) {
    conversationIdRef.current = id
    setConversationId(id)
  }

  function startNewChat() {
    assignConversation(null)
    setMessages([])
    setInput('')
    setPaneKey(`new-${Date.now()}`)
  }

  async function openConversation(id: number) {
    const detail = await fetchAssistantConversation(id)
    assignConversation(detail.id)
    setMessages(detail.messages.map(fromStored))
    setPaneKey(`c-${detail.id}`)
    setHistoryOpen(false)
  }

  async function copyAnswer(msg: ChatMessage) {
    try {
      await navigator.clipboard.writeText(msg.content)
      setCopiedId(msg.id)
      window.setTimeout(() => setCopiedId((current) => (current === msg.id ? null : current)), 1600)
    } catch {
      /* ignore */
    }
  }

  const send = useMutation({
    mutationFn: async (text: string) => {
      const history = messages
        .filter((m) => !m.unavailable && m.id !== 'pending')
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }))
      return askAssistant(text, history, conversationIdRef.current)
    },
    onSuccess: (result) => {
      if (result.conversationId) assignConversation(result.conversationId)
      const tAnswer = result.language ? i18n.getFixedT(result.language) : t
      setMessages((current) => [
        ...current.filter((m) => m.id !== 'pending'),
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.unavailable ? unavailableLabel(result.unavailableReason, result.answer, tAnswer) : result.answer,
          at: new Date().toISOString(),
          facts: result.facts,
          unavailable: result.unavailable,
          language: result.language,
          intent: result.intent,
        },
      ])
      void queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] })
    },
    onError: (err) => {
      const unavailable = err instanceof ApiError && (err.status === 503 || err.status >= 500)
      setMessages((current) => [
        ...current.filter((m) => m.id !== 'pending'),
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: unavailable ? t('assistant.unavailable') : err instanceof ApiError ? err.message : t('assistant.unavailable'),
          at: new Date().toISOString(),
          unavailable: true,
        },
      ])
    },
  })

  function submit(text: string) {
    const trimmed = text.trim()
    if (!trimmed || send.isPending) return
    setInput('')
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content: trimmed, at: new Date().toISOString() },
      { id: 'pending', role: 'assistant', content: '' },
    ])
    send.mutate(trimmed)
  }

  async function removeConversation(id: number) {
    if (!window.confirm(t('assistant.deleteConfirm'))) return
    await archiveAssistantConversation(id)
    if (conversationId === id) startNewChat()
    await queryClient.invalidateQueries({ queryKey: ['assistant-conversations'] })
  }

  const items = historyQuery.data?.items ?? []
  const hasMore = historyQuery.data?.hasMore ?? false

  const historyPanel = (
    <aside className="ma-enter flex w-full shrink-0 flex-col lg:w-[270px]">
      <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ma-gold-600 dark:text-ma-gold-400">
        <History className="h-3.5 w-3.5" />
        {t('assistant.history')}
      </p>
      <label className="relative mb-3 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ma-muted" />
        <input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder={t('assistant.searchHistory')}
          className="w-full rounded-2xl border border-ma-line bg-white py-2 pl-9 pr-3 text-sm outline-none ring-ma-gold-400/40 focus:ring-2 dark:border-white/10 dark:bg-ma-navy-800 dark:text-white"
        />
      </label>
      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
        {items.length === 0 && (
          <p className="px-1 py-6 text-center text-xs text-ma-muted">{t('assistant.emptyHistory')}</p>
        )}
        {items.map((item) => {
          const active = conversationId === item.id
          return (
            <div
              key={item.id}
              className={cn(
                'group relative rounded-2xl border pl-3 pr-2 py-2.5 transition',
                active
                  ? 'border-ma-gold-500/50 bg-ma-gold-400/20 shadow-[inset_3px_0_0_#c9a227] dark:bg-ma-gold-400/10'
                  : 'border-transparent bg-white/70 hover:border-ma-gold-500/25 hover:bg-white dark:bg-ma-navy-800/50 dark:hover:bg-ma-navy-800',
              )}
            >
              <button type="button" className="block w-full pr-7 text-left" onClick={() => void openConversation(item.id)}>
                <p className="truncate text-sm font-medium text-ma-navy-900 dark:text-ma-white">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-ma-muted">{formatWhen(item.lastActivityAt, i18n.language)}</p>
              </button>
              <button
                type="button"
                className="absolute right-2 top-2 rounded-lg p-1 text-ma-muted opacity-0 transition hover:bg-red-50 hover:text-red-700 group-hover:opacity-100 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                aria-label={t('assistant.deleteConfirm')}
                onClick={(e) => {
                  e.stopPropagation()
                  void removeConversation(item.id)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
        {hasMore && (
          <button
            type="button"
            className="mt-1 rounded-xl py-2 text-center text-xs font-semibold uppercase tracking-wider text-ma-gold-700 hover:underline dark:text-ma-gold-400"
            onClick={() => setLimit((n) => n + PAGE_SIZE)}
          >
            {t('assistant.seeMore')}
          </button>
        )}
      </div>
    </aside>
  )

  const suggestPanel = (
    <aside className="w-full shrink-0 lg:w-[300px]">
      <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ma-gold-600 dark:text-ma-gold-400">
        <Sparkles className="h-3.5 w-3.5" />
        {t('assistant.suggested')}
      </p>
      <div className="flex flex-col gap-2">
        {SUGGEST_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => submit(t(`assistant.suggestions.${key}`))}
            className="rounded-2xl border border-ma-gold-500/30 bg-white px-3 py-2.5 text-left text-sm text-ma-navy-900 transition hover:-translate-y-px hover:border-ma-gold-500/60 hover:shadow-sm dark:border-ma-gold-500/20 dark:bg-ma-navy-800 dark:text-ma-white"
          >
            {t(`assistant.suggestions.${key}`)}
          </button>
        ))}
      </div>
    </aside>
  )

  return (
    <RequirePermission anyOf={['ADMIN_SYSTEME', 'DIRECTION']}>
      <div className="flex min-h-[calc(100vh-8rem)] flex-col">
        <PageHeader
          kicker={t('assistant.kicker')}
          title={t('assistant.title')}
          subtitle={t('assistant.subtitle')}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="lg:hidden" onClick={() => setHistoryOpen((v) => !v)}>
                <History className="h-4 w-4" />
                {historyOpen ? t('assistant.hideHistory') : t('assistant.showHistory')}
              </Button>
              <Button variant="outline" className="lg:hidden" onClick={() => setSuggestOpen((v) => !v)}>
                <PanelRight className="h-4 w-4" />
                {suggestOpen ? t('assistant.hideSuggested') : t('assistant.showSuggested')}
              </Button>
              <Button variant="outline" onClick={startNewChat}>
                <SquarePen className="h-4 w-4" />
                {t('assistant.newChat')}
              </Button>
            </div>
          }
        />
          {status.data && !(status.data.available ?? status.data.configured) && (
            <Feedback tone="warning">
              {status.data.reason === 'missing_key' ? t('assistant.notConfigured') : status.data.reason || t('assistant.unconfigured')}
            </Feedback>
          )}

        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          <div className={cn('lg:flex', historyOpen ? 'flex' : 'hidden')}>{historyPanel}</div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div
              key={paneKey}
              className="ma-enter relative mt-0 flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-3xl border border-ma-navy-800/15 bg-[linear-gradient(180deg,rgb(246_208_106/0.08),transparent_120px)] shadow-[0_20px_50px_rgb(11_31_59/0.08)] dark:border-ma-gold-500/15 dark:bg-[linear-gradient(180deg,rgb(246_208_106/0.06),transparent_140px)] dark:shadow-none"
            >
              <div className="pointer-events-none absolute inset-y-6 left-0 w-[3px] bg-gradient-to-b from-ma-gold-400 via-ma-gold-500/40 to-transparent" />
              <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
                {messages.length === 0 && (
                  <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-ma-navy-900 text-ma-gold-400 shadow-[0_8px_24px_rgb(11_31_59/0.25)]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <p className="max-w-md text-sm text-ma-muted">{t('assistant.empty')}</p>
                  </div>
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                    style={{ animation: 'ma-enter 200ms ease both' }}
                  >
                    {msg.role === 'assistant' && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ma-navy-900 text-ma-gold-400">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'min-w-0 max-w-[min(100%,36rem)]',
                        msg.role === 'user' ? 'items-end' : 'items-start',
                        visibleFacts(msg.facts, msg.intent).length > 0 && 'w-full',
                      )}
                    >
                      <div
                        lang={msg.language ?? undefined}
                        className={cn(
                          'group/bubble relative rounded-2xl px-4 py-3 text-sm shadow-sm',
                          msg.role === 'user'
                            ? 'rounded-br-md bg-ma-gold-400/85 text-ma-navy-950'
                            : 'rounded-bl-md border border-ma-line/80 bg-white text-ma-navy-900 dark:border-white/10 dark:bg-ma-navy-800 dark:text-ma-white',
                        )}
                      >
                        {msg.id === 'pending' ? (
                          <TypingDots label={t('assistant.typing')} />
                        ) : (
                          <>
                            <RichText text={msg.content} />
                            {visibleFacts(msg.facts, msg.intent).map((fact, i) => (
                              <FactBlock key={`${msg.id}-${i}`} fact={fact} index={i} />
                            ))}
                            {msg.role === 'assistant' && (
                              <button
                                type="button"
                                className="absolute -right-1 -top-2 rounded-full border border-ma-line bg-white p-1 text-ma-muted opacity-0 shadow-sm transition hover:text-ma-navy-900 group-hover/bubble:opacity-100 dark:border-white/15 dark:bg-ma-navy-700 dark:hover:text-ma-gold-300"
                                onClick={() => void copyAnswer(msg)}
                                aria-label={t('assistant.copy')}
                              >
                                {copiedId === msg.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      {msg.id !== 'pending' && msg.at && (
                        <p className={cn('mt-1 text-[10px] text-ma-muted/80', msg.role === 'user' ? 'text-right' : 'text-left')}>
                          {formatWhen(msg.at, i18n.language)}
                        </p>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ma-gold-400 text-ma-navy-950">
                        <UserRound className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={bottom} />
              </div>
              <form
                className="flex items-end gap-2 border-t border-ma-line/80 bg-white/80 p-3 dark:border-white/10 dark:bg-ma-navy-900/80"
                onSubmit={(e) => {
                  e.preventDefault()
                  submit(input)
                }}
              >
                <textarea
                  ref={area}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      submit(input)
                    }
                  }}
                  placeholder={t('assistant.placeholder')}
                  className="max-h-40 min-h-[42px] min-w-0 flex-1 resize-none rounded-2xl border border-ma-line bg-white px-3 py-2.5 text-sm outline-none ring-ma-gold-400/40 focus:ring-2 dark:border-white/10 dark:bg-ma-navy-800 dark:text-white"
                  maxLength={2000}
                />
                <Button type="submit" disabled={send.isPending || !input.trim()}>
                  <Send className="h-4 w-4" />
                  {t('assistant.send')}
                </Button>
              </form>
            </div>
          </div>

          <div className={cn('lg:block', suggestOpen ? 'block' : 'hidden')}>{suggestPanel}</div>
        </div>
      </div>
    </RequirePermission>
  )
}
