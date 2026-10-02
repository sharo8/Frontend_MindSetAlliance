import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from './button'
import { cn } from '../../lib/utils'

export function Modal({
  open,
  onClose,
  title,
  kicker,
  subtitle,
  children,
  footer,
  wide,
  size = 'md',
  nested = false,
  dirty = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  kicker?: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  size?: 'md' | 'lg' | 'xl'
  /** Conservé pour compatibilité : tous les modals s’ancrent en haut. */
  anchor?: 'center' | 'top'
  nested?: boolean
  dirty?: boolean
}) {
  function requestClose() {
    if (dirty && !window.confirm('Des modifications ne sont pas enregistrées. Fermer quand même ?')) {
      return
    }
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, dirty, onClose])

  if (!open || typeof document === 'undefined') return null

  const maxWidth = wide || size === 'xl' ? 'max-w-[56rem]' : size === 'lg' ? 'max-w-[42rem]' : 'max-w-xl'

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 flex items-start justify-center overflow-hidden bg-ma-navy-950/55 px-3 pb-4 pt-[max(1.25rem,6vh)] backdrop-blur-sm sm:px-6',
        nested ? 'z-[80]' : 'z-[70]',
      )}
      onClick={requestClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ma-modal-title"
        className={cn(
          'ma-modal-top flex w-full max-h-[85vh] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-ma-navy-950 shadow-[var(--shadow-ma-lg)] dark:border-ma-gold-600/20 dark:bg-ma-navy-800 dark:text-ma-white',
          maxWidth,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10 sm:px-6">
          <div className="min-w-0">
            {kicker && (
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-ma-gold-600 dark:text-ma-gold-400">
                {kicker}
              </p>
            )}
            <h2 id="ma-modal-title" className="font-display text-xl text-ma-navy-900 dark:text-ma-gold-400">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 truncate text-sm text-ma-muted dark:text-ma-gray-300">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ma-muted transition hover:bg-slate-100 hover:text-ma-navy-900 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-3 dark:border-white/10 dark:bg-ma-navy-900/50 sm:px-6">
          {footer ?? (
            <Button variant="outline" onClick={requestClose}>
              Fermer
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
