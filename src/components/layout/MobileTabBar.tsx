import { House, LayoutGrid, Search, type LucideIcon } from 'lucide-react'
import { useId } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { cn } from '../../lib/utils'
import { spring } from '../motion/springs'

/**
 * Barre d'onglets flottante (téléphone), façon iOS 27 :
 * capsule en verre liquide + bouton de recherche rond séparé.
 * En descendant, elle se réduit à l'onglet actif ; en remontant, elle se déploie.
 */
export function MobileTabBar({
  minimized,
  onMenu,
  onSearch,
  labels,
  second,
}: {
  minimized: boolean
  onMenu: () => void
  onSearch: () => void
  labels: { home: string; search: string; menu: string }
  /** Deuxième onglet : il dépend de l'espace choisi (Tickets, Commandes Colis na Nga…). */
  second?: { to: string; label: string; Icon: LucideIcon }
}) {
  const { pathname } = useLocation()
  const pillId = useId()
  const tabs = [
    { key: 'home', to: '/', label: labels.home, Icon: House, active: pathname === '/' },
    ...(second ? [{ key: 'second', to: second.to, label: second.label, Icon: second.Icon, active: pathname.startsWith(second.to) }] : []),
  ]
  const anyActive = tabs.some((tab) => tab.active)
  const visible = minimized ? tabs.filter((tab) => tab.active) : tabs

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] px-3 pb-[max(12px,env(safe-area-inset-bottom))] md:hidden">
      <div aria-hidden className="lg-scroll-edge-bottom absolute inset-x-0 bottom-0 h-28" />
      <LayoutGroup>
        <div className="relative flex items-end justify-between gap-2.5">
          <motion.nav
            layout
            transition={spring.liquid}
            aria-label="Navigation rapide"
            className="glass lg-lens pointer-events-auto flex h-[62px] items-center gap-0.5 rounded-full p-1 [--spec-size:200px]"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {visible.map(({ key, to, label, Icon, active }) => (
                <motion.div
                  key={key}
                  layout
                  initial={{ opacity: 0, scale: 0.6, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.6, filter: 'blur(6px)' }}
                  transition={spring.liquid}
                >
                  <Link
                    to={to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex h-[54px] min-w-[74px] flex-col items-center justify-center gap-0.5 rounded-full px-3 text-[10.5px] font-semibold tracking-[-0.01em] transition-colors',
                      active ? 'text-accent-ink' : 'text-ink-2',
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId={`tab-pill-${pillId}`}
                        transition={spring.liquid}
                        className="absolute inset-0 rounded-full bg-ink/[0.07] dark:bg-white/[0.12]"
                      />
                    )}
                    <Icon className="relative h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.9} />
                    <span className="relative">{label}</span>
                  </Link>
                </motion.div>
              ))}
              {(!minimized || !anyActive) && (
                <motion.div
                  key="menu"
                  layout
                  initial={{ opacity: 0, scale: 0.6, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, scale: 0.6, filter: 'blur(6px)' }}
                  transition={spring.liquid}
                >
                  <button
                    type="button"
                    onClick={onMenu}
                    className="relative flex h-[54px] min-w-[74px] flex-col items-center justify-center gap-0.5 rounded-full px-3 text-[10.5px] font-semibold tracking-[-0.01em] text-ink-2"
                  >
                    <LayoutGrid className="h-[22px] w-[22px]" strokeWidth={1.9} />
                    <span>{labels.menu}</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.nav>

          <motion.button
            layout
            type="button"
            onClick={onSearch}
            aria-label={labels.search}
            transition={spring.liquid}
            whileTap={{ scale: 1.12 }}
            className="glass lg-lens pointer-events-auto flex h-[62px] w-[62px] items-center justify-center rounded-full text-ink [--spec-size:120px]"
          >
            <Search className="h-[22px] w-[22px]" strokeWidth={2} />
          </motion.button>
        </div>
      </LayoutGroup>
    </div>
  )
}
