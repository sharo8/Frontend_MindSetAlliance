import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

type Props = {
  tone: 'success' | 'danger' | 'warning'
  children: ReactNode
  className?: string
}

const icons = { success: CheckCircle2, danger: XCircle, warning: AlertTriangle }

export function Feedback({ tone, children, className }: Props) {
  const Icon = icons[tone]
  return (
    <p
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'ma-fact-in flex items-start gap-2.5 rounded-[14px] px-3.5 py-2.5 text-[13px] leading-snug ring-1 ring-inset',
        tone === 'success' && 'bg-status-success/10 text-[#0f7a37] ring-status-success/20 dark:text-[#4ade80]',
        tone === 'danger' && 'bg-status-danger/10 text-[#b91c1c] ring-status-danger/20 dark:text-[#f87171]',
        tone === 'warning' && 'bg-status-warning/10 text-[#a85a04] ring-status-warning/20 dark:text-[#fbbf24]',
        className,
      )}
    >
      <Icon className="mt-px h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}
