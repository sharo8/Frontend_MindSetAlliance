import { useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '../../lib/utils'
import { spring } from '../motion/springs'

type Align = 'left' | 'right'

/** Menu flottant en verre : s'ouvre depuis son bouton avec un ressort. */
export function HeaderMenu({
  open,
  onOpenChange,
  align = 'right',
  trigger,
  children,
  panelClassName,
  labelledBy,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  align?: Align
  trigger: ReactNode
  children: ReactNode
  panelClassName?: string
  labelledBy?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ top: 0, left: 8, width: 288 })
  const menuId = useId()

  function place() {
    if (!wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const pad = 10
    const maxWidth = Math.min(panelRef.current?.offsetWidth || 288, window.innerWidth - pad * 2)
    let left = align === 'right' ? rect.right - maxWidth : rect.left
    left = Math.min(Math.max(pad, left), window.innerWidth - maxWidth - pad)
    setCoords({ top: rect.bottom + 10, left, width: maxWidth })
  }

  useLayoutEffect(() => {
    if (!open) return
    place()
    const id = requestAnimationFrame(place)
    window.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('resize', place)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, align])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return
      onOpenChange(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  return (
    <div ref={wrapRef} className="relative shrink-0">
      {trigger}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={panelRef}
                id={menuId}
                role="menu"
                aria-labelledby={labelledBy}
                initial={{ opacity: 0, scale: 0.55, y: -14, filter: 'blur(10px)' }}
                animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
                exit={{ opacity: 0, scale: 0.7, y: -10, filter: 'blur(8px)', transition: { duration: 0.18, ease: [0.32, 0.72, 0, 1] } }}
                transition={{ ...spring.morph, opacity: { duration: 0.16 }, filter: { duration: 0.22 } }}
                className={cn(
                  'glass-strong ma-scroll fixed z-[200] max-h-[min(28rem,calc(100vh-5.5rem))] overflow-y-auto rounded-[26px] p-1.5 text-ink [--spec-size:260px]',
                  panelClassName,
                )}
                style={{
                  top: coords.top,
                  left: coords.left,
                  maxWidth: `min(${coords.width}px, calc(100vw - 20px))`,
                  transformOrigin: align === 'right' ? 'top right' : 'top left',
                }}
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  )
}

/** Ligne de menu standard. */
export function MenuItem({ className, active, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'press flex w-full items-center gap-3 rounded-[18px] px-3 py-2.5 text-left text-[14.5px] tracking-[-0.012em] text-ink transition-colors duration-150',
        'hover:bg-ink/[0.06] focus-visible:bg-ink/[0.06] focus-visible:outline-none dark:hover:bg-white/[0.09]',
        active && 'bg-ma-gold-500/14 dark:bg-ma-gold-400/14',
        className,
      )}
      {...props}
    />
  )
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="px-3 pb-1 pt-2 text-[12.5px] font-semibold text-ink-3">{children}</p>
}

export function MenuSeparator() {
  return <div className="mx-2 my-1.5 h-px bg-hairline" />
}
