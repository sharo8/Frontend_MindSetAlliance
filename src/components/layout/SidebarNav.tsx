import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { NAV_ICONS } from './nav-icons'
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
                      <span className="truncate">{t(`nav.section.${section.id}`, { defaultValue: section.label })}</span>
                  {section.projectTag && (
                    <span className="rounded bg-ma-gold-500/15 px-1 py-px text-[8px] tracking-wider text-ma-gold-400">
                      {section.projectTag}
                    </span>
                  )}
                </span>
                <ChevronDown size={12} className={cn('shrink-0 text-ma-gray-300 transition', !expanded && '-rotate-90')} />
              </button>
            )}
            {(compact || expanded) &&
              section.items.map((item) => {
                const Icon = NAV_ICONS[item.id] ?? NAV_ICONS.accueil
                return (
                  <NavLink
                    key={item.id}
                    to={item.to}
                    end={item.to === '/'}
                    title={compact ? t(`nav.${item.id}`, { defaultValue: item.label }) : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative mb-0.5 flex items-center gap-2.5 overflow-hidden rounded-xl px-2.5 py-2 text-sm text-ma-gray-300 transition duration-200 ease-[var(--ease-ma)]',
                        'hover:translate-x-0.5 hover:bg-white/5 hover:text-ma-white',
                        isActive && 'bg-white/8 text-ma-gold-400',
                        compact && 'justify-center px-0',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={cn(
                            'absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-gradient-to-b from-ma-gold-300 to-ma-gold-600 transition duration-200',
                            isActive ? 'opacity-100' : 'opacity-0',
                          )}
                        />
                        <Icon size={16} className={cn('shrink-0', isActive ? 'text-ma-gold-400' : 'text-ma-gray-300')} />
                        {!compact && (
                          <span className="truncate">{t(`nav.${item.id}`, { defaultValue: item.label })}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                )
              })}
          </div>
        )
      })}
    </nav>
  )
}
