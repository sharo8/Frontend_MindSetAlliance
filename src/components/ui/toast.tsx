import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, XCircle } from 'lucide-react'
import { spring } from '../motion/springs'

/** Notification en capsule de verre qui descend du haut (style « Dynamic Island »). */
export function Toast({
  message,
  tone = 'success',
  onDismiss,
}: {
  message: string | null
  tone?: 'success' | 'danger'
  onDismiss: () => void
}) {
  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(onDismiss, 4200)
    return () => window.clearTimeout(t)
  }, [message, onDismiss])

  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {message && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[120] flex justify-center px-4">
          <motion.div
            key={message}
            role={tone === 'danger' ? 'alert' : 'status'}
            initial={{ opacity: 0, y: -12, scaleX: 0.32, scaleY: 0.7 }}
            animate={{ opacity: 1, y: 0, scaleX: 1, scaleY: 1 }}
            exit={{ opacity: 0, y: -10, scaleX: 0.3, scaleY: 0.7, transition: { duration: 0.28, ease: [0.32, 0.72, 0, 1] } }}
            transition={{ type: 'spring', stiffness: 380, damping: 26, mass: 0.9 }}
            onClick={onDismiss}
            className="pointer-events-auto flex max-w-[min(28rem,calc(100vw-2rem))] origin-top cursor-pointer items-center gap-3 rounded-full bg-black py-2.5 pl-3 pr-5 text-[14px] font-medium text-white shadow-[0_12px_32px_-8px_rgb(0_0_0/0.45)] ring-[0.5px] ring-white/10"
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ ...spring.liquid, delay: 0.1 }}
              className="inline-flex"
            >
              {tone === 'danger' ? (
                <XCircle className="h-5 w-5 shrink-0 text-[#ff453a]" />
              ) : (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[#30d158]" />
              )}
            </motion.span>
            <motion.span initial={{ opacity: 0, filter: 'blur(4px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ delay: 0.12, duration: 0.25 }} className="leading-snug">
              {message}
            </motion.span>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
