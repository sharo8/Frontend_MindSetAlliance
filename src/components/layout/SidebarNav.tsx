import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { NAV_ICONS } from './nav-icons'
import { resolveActiveNavId } from './nav-active'
import type { NavSection } from '../../lib/rbac/rbac'
import { cn } from '../../lib/utils'
import { spring } from '../motion/springs'

export function SidebarNav({
  sections,
  compact,
  storageKey,
}: {
  sections: NavSection[]
  compact: boolean
  storageKey: string
}) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const pillId = useId()
  const activeId = resolveActiveNavId(
    pathname,
    sections.flatMap((section) => section.items),
  )
  const [open, setOpen] = useState<Record<string, boolean>>({})

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (raw) setOpen(JSON.parse(raw) as Record<string, boolean>)
    } catch {
      /* ignore */
    }
  }, [storageKey])

  function toggle(id: string) {
    setOpen((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? true) }
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  return (
    <nav className={cn('ma-scroll flex-1 overflow-y-auto overflow-x-hidden pb-3', compact ? 'px-2' : 'px-3')} aria-label={t('nav.main')}>
      {sections.map((section, sectionIndex) => {
        const expanded = open[section.id] ?? true
        const showHeader = Boolean(section.label) && !compact
        const sectionHasActive = section.items.some((item) => item.id === activeId)
        return (
          <div key={section.id} className={cn(sectionIndex > 0 && (compact ? 'mt-2 border-t border-hairline pt-2' : 'mt-4'))}>
            {showHeader && (
              <button
                type="button"
                onClick={() => toggle(section.id)}
                className="group mb-1 flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1 text-left"
                aria-expanded={expanded}
              >
                <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold tracking-[-0.005em] text-ink-3 transition-colors group-hover:text-ink-2">
                  <span className="truncate">{t(`nav.section.${section.id}`, { defaultValue: section.label })}</span>
                  {section.projectTag && (
                    <span className="rounded-full bg-ma-gold-500/14 px-1.5 py-px text-[10px] font-semibold text-accent-ink">
                      {section.projectTag}
                    </span>
                  )}
                  {!expanded && sectionHasActive && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ma-gold-500" aria-hidden="true" />
                  )}
                </span>
                <ChevronDown
                  size={13}
                  strokeWidth={2.4}
                  className={cn('shrink-0 text-ink-3 transition-transform duration-300 ease-[var(--ease-ma)]', !expanded && '-rotate-90')}
                />
              </button>
            )}
            <AnimatePresence initial={false}>
              {(compact || expanded) && (
                <motion.div
                  key="items"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ height: spring.snappy, opacity: { duration: 0.18 } }}
                  className="space-y-0.5 overflow-hidden"
                >
                  {section.items.map((item) => {
                    const Icon = NAV_ICONS[item.id] ?? NAV_ICONS.accueil
                    const active = item.id === activeId
                    const label = t(`nav.${item.id}`, { defaultValue: item.label })
                    return (
                      <Link
                        key={item.id}
                        to={item.to}
                        aria-current={active ? 'page' : undefined}
                        title={compact ? label : undefined}
                        className={cn(
                          'press group relative flex h-10 items-center gap-2.5 rounded-full px-3 text-[14.5px] tracking-[-0.012em] outline-none',
                          'focus-visible:[box-shadow:var(--ring-focus)]',
                          active ? 'font-semibold text-ink' : 'font-medium text-ink-2 hover:bg-ink/[0.05] hover:text-ink dark:hover:bg-white/[0.07]',
                          compact && 'justify-center px-0',
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId={`nav-pill-${pillId}`}
                            transition={spring.liquid}
                            className="absolute inset-0 rounded-full bg-ma-gold-500/[0.16] shadow-[inset_0_0_0_0.5px_rgb(214_162_30/0.28),inset_0_1px_0_rgb(255_255_255/0.5)] dark:bg-ma-gold-400/[0.17] dark:shadow-[inset_0_0_0_0.5px_rgb(232_183_62/0.25),inset_0_1px_0_rgb(255_255_255/0.08)]"
                          />
                        )}
                        <span
                          className={cn(
                            'relative flex h-6 w-6 shrink-0 items-center justify-center transition-[color,transform] duration-300',
                            active ? 'scale-105 text-accent-ink' : 'text-ink-3 group-hover:text-ink-2',
                          )}
                        >
                          <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                        </span>
                        {!compact && <span className="relative truncate">{label}</span>}
                      </Link>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </nav>
  )
}
