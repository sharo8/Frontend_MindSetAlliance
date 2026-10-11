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

function CodeBlock({ children }: { children?: ReactNode }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const source = textOf(children)
  return (
    <div className="relative my-3">
      <button
        type="button"
        className="absolute right-2 top-2 rounded-lg border border-white/15 bg-ma-navy-800 px-2 py-1 text-[11px] font-semibold text-ma-gold-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ma-gold-400"
        aria-label={t('assistant.copyCode')}
        onClick={() => {
          void navigator.clipboard.writeText(source).then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1400)
          }).catch(() => undefined)
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      </button>
      <pre className="overflow-x-auto rounded-xl bg-ma-navy-900 px-3 py-3 pr-16 text-[13px] leading-relaxed text-ma-gold-300">
        {children}
      </pre>
    </div>
  )
}

export function AssistantMarkdown({ text }: { text: string }) {
  return (
    <div className="assistant-md space-y-2 text-[15px] leading-[1.65] text-ma-ink dark:text-ma-white">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h3 className="font-display text-lg text-ma-navy-900 dark:text-ma-gold-300">{children}</h3>,
          h2: ({ children }) => <h3 className="font-display text-base text-ma-navy-900 dark:text-ma-gold-300">{children}</h3>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-ma-navy-900 dark:text-ma-gold-300">{children}</h3>,
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          strong: ({ children }) => <strong className="font-semibold text-ma-navy-900 dark:text-ma-gold-300">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-[3px] border-ma-gold-500 pl-3 text-ma-muted dark:text-ma-gray-300">{children}</blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-ma-navy-700 underline decoration-ma-gold-500 underline-offset-2 dark:text-ma-gold-300">
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            if (className) {
              return <code className={cn('font-mono', className)}>{children}</code>
            }
            return <code className="rounded-md bg-ma-navy-800/8 px-1 py-0.5 font-mono text-[0.9em] text-ma-navy-800 dark:bg-white/10 dark:text-ma-gold-300">{children}</code>
          },
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          table: ({ children }) => (
            <div className="my-3 max-w-full overflow-x-auto rounded-xl border border-ma-line dark:border-white/10">
              <table className="w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-ma-navy-900 text-[11px] uppercase tracking-wider text-ma-gold-300">{children}</thead>,
          th: ({ children }) => <th className="whitespace-nowrap px-3 py-2 font-semibold">{children}</th>,
          tr: ({ children }) => <tr className="border-t border-ma-line even:bg-ma-navy-800/[0.04] dark:border-white/10 dark:even:bg-white/[0.04]">{children}</tr>,
          td: ({ children }) => {
            const value = textOf(children).trim()
            const numeric = /^-?\d[\d\s.,%]*$/.test(value)
            return <td className={cn('px-3 py-2 align-top', numeric && 'text-right tabular-nums')}>{children}</td>
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
