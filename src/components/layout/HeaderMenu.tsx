import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/utils'

type Align = 'left' | 'right'

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
    const pad = 8
    const maxWidth = Math.min(panelRef.current?.offsetWidth || 288, window.innerWidth - pad * 2)
    let left = align === 'right' ? rect.right - maxWidth : rect.left
    left = Math.min(Math.max(pad, left), window.innerWidth - maxWidth - pad)
    setCoords({ top: rect.bottom + 8, left, width: maxWidth })
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
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="menu"
            aria-labelledby={labelledBy}
            className={cn(
              'ma-pop fixed z-[200] max-h-[min(24rem,calc(100vh-5rem))] overflow-y-auto rounded-xl border border-white/10 bg-ma-navy-800 py-1 text-ma-white shadow-2xl',
              panelClassName,
            )}
            style={{
              top: coords.top,
              left: coords.left,
              maxWidth: `min(${coords.width}px, calc(100vw - 16px))`,
            }}
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  )
}
