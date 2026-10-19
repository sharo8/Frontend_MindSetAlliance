import { Check, Copy } from 'lucide-react'
import { isValidElement, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils'

function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

function languageOf(node: ReactNode): string {
  const child = Array.isArray(node) ? node[0] : node
  if (!isValidElement<{ className?: string }>(child)) return ''
  const match = /language-([\w-]+)/.exec(child.props.className ?? '')
  return match ? match[1] : ''
}

/** Bloc de code : panneau bleu nuit, langue à gauche, copie à droite. */
function CodeBlock({ children }: { children?: ReactNode }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const source = textOf(children)
  const language = languageOf(children)
  return (
    <div className="my-3 overflow-hidden rounded-[16px] bg-[#1c1c1e] ring-1 ring-white/[0.06] dark:bg-[#2c2c2e]">
      <div className="flex h-9 items-center justify-between border-b border-white/[0.07] pl-3.5 pr-1.5">
        <span className="font-mono text-[11.5px] font-medium lowercase text-ma-gray-300">{language || 'code'}</span>
        <button
          type="button"
          className={cn(
            'press inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-[12px] font-medium text-ma-gray-300 hover:bg-white/[0.08] hover:text-ma-white',
            'focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]',
          )}
          aria-label={t('assistant.copyCode')}
          onClick={() => {
            void navigator.clipboard
              .writeText(source)
              .then(() => {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 1400)
              })
              .catch(() => undefined)
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-ma-gold-300" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? t('assistant.copied') : null}
        </button>
      </div>
      <pre className="ma-scroll overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-[1.7] text-ma-white">{children}</pre>
    </div>
  )
}

/** Rendu markdown des réponses : titres nets, puces dorées, tableaux légers, code lisible. */
export function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="assistant-md min-w-0 space-y-3 text-[14.5px] leading-[1.65] text-ink-2 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h3 className="mt-5 text-[18px] font-semibold leading-snug tracking-[-0.02em] text-ink">{children}</h3>,
          h2: ({ children }) => <h3 className="mt-5 text-[16.5px] font-semibold leading-snug tracking-[-0.018em] text-ink">{children}</h3>,
          h3: ({ children }) => <h4 className="mt-4 text-[14.5px] font-semibold leading-snug tracking-[-0.01em] text-ink">{children}</h4>,
          h4: ({ children }) => <h4 className="mt-3 text-[13.5px] font-semibold text-ink">{children}</h4>,
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => <ul className="space-y-1.5 pl-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-none space-y-1.5 pl-1 [counter-reset:md-ol]">{children}</ol>,
          li: ({ children }) => {
            return (
              <li
                className={cn(
                  'relative pl-6',
                  'before:absolute before:left-1 before:top-[0.68em]',
                  'before:h-1.5 before:w-1.5 before:rounded-full before:bg-ma-gold-500',
                  '[ol>&]:[counter-increment:md-ol] [ol>&]:before:top-[0.2em] [ol>&]:before:h-auto [ol>&]:before:w-auto [ol>&]:before:left-0 [ol>&]:before:bg-transparent',
                  '[ol>&]:before:text-[12.5px] [ol>&]:before:font-semibold [ol>&]:before:tabular-nums [ol>&]:before:text-accent-ink [ol>&]:before:content-[counter(md-ol)_"."]',
                )}
              >
                {children}
              </li>
            )
          },
          strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
          em: ({ children }) => <em className="italic text-ink">{children}</em>,
          hr: () => <hr className="my-4 border-0 border-t border-hairline" />,
          blockquote: ({ children }) => (
            <blockquote className="relative rounded-[12px] bg-ma-gold-500/[0.07] py-2.5 pl-4 pr-3 text-[13.5px] text-ink-2 before:absolute before:inset-y-2.5 before:left-1.5 before:w-[3px] before:rounded-full before:bg-ma-gold-500 dark:bg-ma-gold-400/[0.07] [&_p]:m-0">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-accent-ink underline decoration-ma-gold-500/45 underline-offset-[3px] transition-colors hover:decoration-ma-gold-500"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            if (className) return <code className={cn('font-mono', className)}>{children}</code>
            const short = textOf(children).length <= 28
            return (
              <code
                className={cn(
                  'rounded-[6px] bg-ink/[0.06] px-1.5 py-[1px] font-mono text-[0.86em] font-medium text-ink dark:bg-white/[0.09]',
                  short ? 'whitespace-nowrap' : 'break-words',
                )}
              >
                {children}
              </code>
            )
          },
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          table: ({ children }) => (
            <div className="ma-scroll my-3 max-w-full overflow-x-auto rounded-[14px] bg-surface ring-1 ring-hairline">
              <table className="w-full border-separate border-spacing-0 text-left text-[13px] text-ink">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          th: ({ children, style }) => (
            <th
              style={style}
              className="whitespace-nowrap border-b border-hairline bg-surface-2 px-3.5 py-2 text-[12px] font-medium text-ink-3 first:pl-4 last:pr-4 dark:bg-white/[0.025]"
            >
              {children}
            </th>
          ),
          tr: ({ children }) => (
            <tr className="transition-colors hover:bg-ink/[0.025] dark:hover:bg-white/[0.03] [tbody>&:last-child>td]:border-b-0">
              {children}
            </tr>
          ),
          td: ({ children, style }) => {
            const value = textOf(children).trim()
            const numeric = /^-?\d[\d\s.,%]*$/.test(value)
            return (
              <td
                style={style}
                className={cn('border-b border-hairline px-3.5 py-2 align-top first:pl-4 last:pr-4', numeric && 'text-right tabular-nums')}
              >
                {children}
              </td>
            )
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
