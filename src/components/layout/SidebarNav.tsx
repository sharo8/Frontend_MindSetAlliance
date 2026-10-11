import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { NAV_ICONS } from './nav-icons'
import { resolveActiveNavId } from './nav-active'
import type { NavSection } from '../../lib/rbac/rbac'
import { cn } from '../../lib/utils'

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
    <nav className="flex-1 space-y-2 overflow-y-auto p-2" aria-label={t('nav.main')}>
      {sections.map((section) => {
        const expanded = open[section.id] ?? true
        const showHeader = Boolean(section.label) && !compact
        const sectionHasActive = section.items.some((item) => item.id === activeId)
        return (
          <div key={section.id}>
            {showHeader && (
              <button
                type="button"
                onClick={() => toggle(section.id)}
                className="mb-1 flex w-full items-center justify-between gap-2 px-2.5 py-1 text-left"
                aria-expanded={expanded}
              >
                <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ma-gold-500/85">
                  {!expanded && sectionHasActive && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ma-gold-400" aria-hidden="true" />
                  )}
                  <span className="truncate">{t(`nav.section.${section.id}`, { defaultValue: section.label })}</span>
                  {section.projectTag && (
                    <span className="rounded bg-ma-gold-500/15 px-1 py-px text-[8px] tracking-wider text-ma-gold-400">
                      {section.projectTag}
                    </span>
                  )}
                </span>
                <ChevronDown size={12} className={cn('shrink-0 text-ma-gray-300 transition-transform duration-150', !expanded && '-rotate-90')} />
              </button>
            )}
            {(compact || expanded) &&
              section.items.map((item) => {
                const Icon = NAV_ICONS[item.id] ?? NAV_ICONS.accueil
                const active = item.id === activeId
                return (
                  <Link
                    key={item.id}
                    to={item.to}
                    aria-current={active ? 'page' : undefined}
                    title={compact ? t(`nav.${item.id}`, { defaultValue: item.label }) : undefined}
                    className={cn(
                      'group relative mb-0.5 flex items-center gap-2.5 overflow-hidden rounded-xl px-2.5 py-2 text-sm text-ma-gray-300 transition-colors duration-150',
                      'hover:bg-white/5 hover:text-ma-white',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ma-gold-300',
                      active && 'bg-white/8 text-ma-gold-400 hover:bg-white/10 hover:text-ma-gold-300',
                      compact && 'justify-center px-0',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-gradient-to-b from-ma-gold-300 to-ma-gold-600 transition-opacity duration-150',
                        active ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    <Icon size={16} className={cn('shrink-0', active ? 'text-ma-gold-400' : 'text-ma-gray-300 group-hover:text-ma-white')} />
                    {!compact && (
                      <span className="truncate">{t(`nav.${item.id}`, { defaultValue: item.label })}</span>
                    )}
                  </Link>
                )
              })}
          </div>
        )
      })}
    </nav>
  )
}
