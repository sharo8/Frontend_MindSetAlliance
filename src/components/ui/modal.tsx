import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import { Button } from './button'
import { cn } from '../../lib/utils'
import { spring } from '../motion/springs'

function useIsMobile() {
  const query = '(max-width: 639px)'
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const sync = () => setMobile(mq.matches)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return mobile
}

/**
 * Fenêtre en verre. Ordinateur : apparaît au centre avec un ressort (échelle + flou).
 * Téléphone : feuille qui monte du bas, comme sur iOS, et se ferme en la glissant vers le bas.
 */
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
  /** Conservé pour compatibilité. */
  anchor?: 'center' | 'top'
  nested?: boolean
  dirty?: boolean
}) {
  const mobile = useIsMobile()
  const reduce = useReducedMotion()
  const titleId = useId()
  const dragControls = useDragControls()

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dirty, onClose])

  if (typeof document === 'undefined') return null

  const maxWidth = wide || size === 'xl' ? 'sm:max-w-[58rem]' : size === 'lg' ? 'sm:max-w-[44rem]' : 'sm:max-w-[34rem]'

  const panelMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : mobile
      ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }
      : {
          initial: { opacity: 0, scale: 0.94, y: 18, filter: 'blur(8px)' },
          animate: { opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } },
          exit: { opacity: 0, scale: 0.97, y: 10, filter: 'blur(6px)' },
        }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className={cn('fixed inset-0 flex items-end justify-center sm:items-center sm:p-6', nested ? 'z-[80]' : 'z-[70]')}
          role="presentation"
        >
          <motion.div
            className="absolute inset-0 bg-black/25 backdrop-blur-[3px] dark:bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            onClick={requestClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              'glass-strong relative flex w-full min-h-0 flex-col overflow-hidden text-ink',
              'max-h-[92svh] rounded-t-[30px] sm:max-h-[86vh] sm:rounded-[30px]',
              maxWidth,
            )}
            {...panelMotion}
            transition={mobile ? spring.sheet : spring.modal}
            drag={mobile && !reduce ? 'y' : false}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) requestClose()
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Poignée + en-tête : zone de glissement pour fermer sur téléphone */}
            <div className="shrink-0 touch-none sm:touch-auto" onPointerDown={(e) => mobile && dragControls.start(e)}>
            {mobile && <div className="mx-auto mt-2.5 h-[5px] w-10 shrink-0 rounded-full bg-ink/20" aria-hidden />}
            <div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-3 pt-5 sm:px-7 sm:pt-6">
              <div className="min-w-0">
                {kicker && (
                  <p className="mb-1 text-[12.5px] font-semibold uppercase tracking-[0.04em] text-ink-3">{kicker}</p>
                )}
                <h2 id={titleId} className="text-[21px] font-semibold leading-tight tracking-[-0.025em] text-ink">
                  {title}
                </h2>
                {subtitle && <p className="mt-1 text-sm leading-snug text-ink-3">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={requestClose}
                className="press inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink-2 hover:bg-ink/[0.1] hover:text-ink dark:bg-white/[0.08] dark:hover:bg-white/[0.14]"
                aria-label="Fermer"
              >
                <X className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </button>
            </div>
            </div>
            <div className="ma-scroll min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-1 sm:px-7">{children}</div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-hairline px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
              {footer ?? (
                <Button variant="outline" onClick={requestClose}>
                  Fermer
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
