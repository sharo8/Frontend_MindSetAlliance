import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type Props = {
  tone: 'success' | 'danger' | 'warning'
  children: ReactNode
}

export function Feedback({ tone, children }: Props) {
  return (
    <p
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl px-3 py-2 text-sm',
        tone === 'success' && 'bg-status-success/12 text-status-success',
        tone === 'danger' && 'bg-status-danger/12 text-status-danger',
        tone === 'warning' && 'bg-status-warning/12 text-status-warning',
      )}
    >
      {children}
    </p>
  )
}
