import { useEffect } from 'react'

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

  if (!message) return null

  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`ma-pop fixed right-4 top-16 z-50 max-w-sm rounded-xl border px-4 py-3 text-sm shadow-[var(--shadow-ma-md)] ${
        tone === 'danger'
          ? 'border-status-danger/30 bg-white text-status-danger dark:bg-ma-navy-800'
          : 'border-status-success/30 bg-white text-status-success dark:bg-ma-navy-800'
      }`}
    >
      {message}
    </div>
  )
}
