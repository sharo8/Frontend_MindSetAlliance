import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  BellOff,
  CalendarDays,
  Clock3,
  Check,
  ChevronDown,
  LogOut,
  Moon,
  Pin,
  Search,
  Sun,
  User,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { HeaderMenu, MenuItem, MenuLabel, MenuSeparator } from './HeaderMenu'
import { LanguagePanel } from './LanguagePanel'
import { MobileTabBar } from './MobileTabBar'
import { NAV_ICONS } from './nav-icons'
import { AppearancePanel } from './AppearancePanel'
import { EXCLUDED_PROJECTS, LanguageFlag, ProjectLogo } from '../ui/brand-marks'
import { SidebarNav } from './SidebarNav'
import { PageFade } from '../motion/page-fade'
import { spring } from '../motion/springs'
import { ProfileModal } from '../../features/auth/ProfileEditor'
import { fetchMe } from '../../lib/api/auth'
import { fetchNotifications, fetchProjects, markNotificationRead } from '../../lib/api/domain'
import { useAuthStore } from '../../lib/auth/auth-store'
import type { AppLanguage } from '../../lib/i18n/i18n'
import { useProjectStore } from '../../lib/projects/project-store'
import { cnnAdmin, fetchCnnSynthese } from '../../lib/api/cnnAdmin'
import { ApiError } from '../../lib/api/client'
import { buildNavSections, hasFullAccess, isCompanyWide, projectLabel, roleLabel, visibleProjectCodes } from '../../lib/rbac/rbac'
import { useThemeStore } from '../../lib/theme/theme-store'
import { cn } from '../../lib/utils'

const SIDEBAR_KEY = 'ma-sidebar-pinned'

/** Heure courante, mise à jour au changement de minute. */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let id = 0
    const tick = () => {
      setNow(new Date())
      id = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    }
    id = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    return () => window.clearTimeout(id)
  }, [])
  return now
}

function headerName(prenom?: string | null, nom?: string | null, email?: string | null) {
  const first = prenom?.trim()
  const last = nom?.trim()
  if (first && last) return `${first} ${last}`
  if (first || last) return first || last || ''
  const local = (email ?? '').split('@')[0]?.trim() ?? ''
  if (!local) return ''
  return local.charAt(0).toUpperCase() + local.slice(1)
}

function headerInitials(prenom?: string | null, nom?: string | null, email?: string | null) {
  const first = prenom?.trim()
  const last = nom?.trim()
  if (first && last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
  const source = first || last || (email ?? '').split('@')[0] || '?'
  return source.slice(0, 2).toUpperCase()
}

/** Avatar du compte connecté : sa photo de profil, sinon ses initiales. */
function HeaderAvatar({ photo, initials, size }: { photo?: string | null; initials: string; size: 'sm' | 'md' }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [photo])
  const box = size === 'sm' ? 'h-8 w-8 text-[12px]' : 'h-11 w-11 text-[15px]'
  if (photo && !broken) {
    return (
      <img
        src={photo}
        alt=""
        onError={() => setBroken(true)}
        className={cn(box, 'shrink-0 rounded-full object-cover shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)]')}
      />
    )
  }
  return (
    <span
      className={cn(
        box,
        'inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#b5b5bd] to-[#8a8a92] font-semibold tracking-wide text-white dark:from-[#6e6e76] dark:to-[#4a4a50]',
      )}
    >
      {initials}
    </span>
  )
}

function BrandMark({ compact }: { compact?: boolean }) {
  return (
    <div className={cn('flex min-w-0 flex-1 items-center gap-3', compact && 'justify-center')}>
      <span className="relative shrink-0">
        <img
          src="/logo-mindset-alliance.jpg"
          alt="Mindset Alliance"
          className="relative h-10 w-10 rounded-full object-cover shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)]"
        />
      </span>
      {!compact && (
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-display text-[11px] font-semibold tracking-[0.1em] text-ink">MINDSET ALLIANCE</p>
          <p className="mt-0.5 text-[11px] font-medium tracking-[0.06em] text-ink-3">MA Workspace</p>
        </div>
      )}
    </div>
  )
}

/** Bouton rond en verre de la barre d'outils. */
function ToolButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-2',
        'transition-[transform,background-color,color] duration-[450ms] ease-[cubic-bezier(0.22,1.3,0.36,1)] active:scale-[1.16] active:bg-ink/[0.09] active:duration-150 dark:active:bg-white/[0.14]',
        'hover:bg-ink/[0.06] hover:text-ink aria-expanded:bg-ink/[0.07] aria-expanded:text-ink dark:hover:bg-white/[0.08] dark:aria-expanded:bg-white/[0.1]',
        'focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]',
        className,
      )}
      {...props}
    />
  )
}

export function AppLayout() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { accessToken, roles, permissionOverrides, email, signOut, hydrate, hydrated, mustChangePassword } = useAuthStore()
  const { currentProject, setProject, syncWithRoles } = useProjectStore()
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const hydrateTheme = useThemeStore((s) => s.hydrate)
  const [q, setQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const lastScroll = useRef(0)
  // Barre latérale : réduite par défaut, s'ouvre au survol ; épinglée, elle reste ouverte.
  const [pinned, setPinned] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_KEY) === '1'
    } catch {
      return false
    }
  })
  const [hovered, setHovered] = useState(false)
  const hoverTimer = useRef<number | undefined>(undefined)
  const expanded = pinned || hovered
  const now = useNow()
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    hydrate()
    hydrateTheme()
  }, [hydrate, hydrateTheme])

  useEffect(() => {
    if (!hydrated) return
    if (!accessToken) {
      const notice = (() => {
        try {
          return sessionStorage.getItem('ma.auth.notice')
        } catch {
          return null
        }
      })()
      // Visiteur non connecté arrivant sur l'accueil : le site vitrine de Mindset Alliance.
      if (notice !== 'expired' && location.pathname === '/') navigate('/bienvenue', { replace: true })
      else navigate(notice === 'expired' ? '/connexion?reason=session' : '/connexion', { replace: true })
    } else if (mustChangePassword && location.pathname !== '/premiere-connexion') {
      navigate('/premiere-connexion', { replace: true })
    }
  }, [accessToken, navigate, hydrated, mustChangePassword, location.pathname])

  useEffect(() => {
    syncWithRoles(roles)
  }, [roles, syncWithRoles])

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, pinned ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [pinned])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    setMobileNav(false)
    setAccountOpen(false)
    setLangOpen(false)
    setNotifOpen(false)
    setProjectOpen(false)
  }, [location.pathname])

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
    enabled: Boolean(accessToken),
  })
  const notifQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    enabled: Boolean(accessToken),
  })

  // Droits Colis na Nga réellement accordés par le Core (matrice des rôles comprise).
  const cnnRights = useQuery({
    queryKey: ['cnn-relay-status'],
    queryFn: cnnAdmin.status,
    enabled: Boolean(accessToken) && currentProject === 'CNN',
    staleTime: 60_000,
  })
  const granted = useMemo(() => {
    const set = new Set<string>()
    for (const [code, actions] of Object.entries(cnnRights.data?.scopes ?? {})) if (actions?.VIEW) set.add(code)
    return set
  }, [cnnRights.data])
  const sections = useMemo(
    () => buildNavSections(roles, currentProject, permissionOverrides, granted),
    [roles, currentProject, permissionOverrides, granted],
  )
  // Onglet mobile principal de l'espace : Tickets (entreprise), Commandes (Colis na Nga), Vue média (MDR).
  const mobileSecondItem = sections.flatMap((section) => section.items).find((item) => ['tickets', 'cnn-orders', 'mdr'].includes(item.id))
  const mobileSecond = mobileSecondItem
    ? { to: mobileSecondItem.to, label: t(`nav.${mobileSecondItem.id}`, { defaultValue: mobileSecondItem.label }), Icon: NAV_ICONS[mobileSecondItem.id] ?? NAV_ICONS.accueil }
    : undefined
  const me = useQuery({ queryKey: ['agents-me'], queryFn: fetchMe, enabled: Boolean(accessToken) })
  // Recherche de l'en-tête : elle cherche dans l'espace choisi.
  const searchTarget = currentProject === 'CNN' ? '/colis-na-nga/commandes' : currentProject === 'ENTREPRISE' ? '/tickets' : null
  const searchPlaceholder = currentProject === 'CNN' ? t('topbar.searchCnn') : t('topbar.search')

  // État réel (jamais affiché « au hasard ») : Core joignable, et en Colis na Nga la base connectée.
  const cnnLive = useQuery({
    queryKey: ['cnn-synthese'],
    queryFn: fetchCnnSynthese,
    enabled: Boolean(accessToken) && currentProject === 'CNN',
    refetchInterval: 30_000,
  })
  const coreDown = me.isError && !(me.error instanceof ApiError && me.error.status < 500)
  const statusKnown = currentProject === 'CNN' ? cnnLive.isSuccess || cnnLive.isError : me.isSuccess || me.isError
  const statusOk = currentProject === 'CNN' ? Boolean(cnnLive.data?.disponible) : !coreDown
  const statusLabel =
    currentProject === 'CNN'
      ? statusOk
        ? t('topbar.cnnLive')
        : t('topbar.cnnOffline')
      : statusOk
        ? t('topbar.systemsOk')
        : t('topbar.coreDown')
  const fullAccess = hasFullAccess(roles)
  const companyWide = isCompanyWide(roles)
  const jwtProjects = visibleProjectCodes(roles)
  const selectable = (projectsQuery.data ?? []).filter((p) => {
    const inactive = ['INACTIF', 'DESACTIVE'].includes((p.statut ?? '').toUpperCase())
    if (inactive) return false
    if (EXCLUDED_PROJECTS.includes(p.code)) return false
    return companyWide || jwtProjects.includes('*') || jwtProjects.includes(p.code)
  })
  const unread = (notifQuery.data ?? []).filter((n) => !n.lu)
  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
  const primaryRole = roles[0]?.role ?? '–'
  const displayName = headerName(me.data?.prenom, me.data?.nom, email)
  const poste = roleLabel(primaryRole)
  const initials = headerInitials(me.data?.prenom, me.data?.nom, email)
  const dateLocale = i18n.language === 'en' ? 'en-GB' : i18n.language === 'sw' ? 'sw-TZ' : 'fr-FR'
  const projectName =
    currentProject === 'ENTREPRISE'
      ? t('topbar.companyWide')
      : selectable.find((p) => p.code === currentProject)?.nom ?? projectLabel(currentProject)
  const today = now.toLocaleDateString(dateLocale, { weekday: 'short', day: 'numeric', month: 'short' })
  const clock = now.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

  /** Changer de projet change tout l'espace : menus, pages et tableau de bord du projet choisi. */
  function switchProject(code: string) {
    setProjectOpen(false)
    if (code === currentProject) return
    setProject(code)
    navigate('/')
  }

  function closeMenus() {
    setLangOpen(false)
    setAccountOpen(false)
    setNotifOpen(false)
    setProjectOpen(false)
  }

  function only(setter: (v: boolean) => void, next: boolean) {
    if (next) closeMenus()
    setter(next)
  }

  if (!hydrated || !accessToken) return null

  const nav = (compact: boolean) => (
    <SidebarNav sections={sections} compact={compact} storageKey={`ma-nav-sections:${email ?? 'anon'}`} />
  )

  return (
    <div className="relative flex h-svh overflow-hidden text-ink">
      <div className="ma-ambient" aria-hidden />

      {/* Barre latérale (ordinateur) : réduite par défaut, s'ouvre au survol en poussant le contenu (rien n'est masqué) ; l'épingle la garde ouverte. */}
      <div
        className={cn(
          'relative z-30 m-3 mr-0 hidden shrink-0 md:block',
          'transition-[width] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
          expanded ? 'w-[268px]' : 'w-[76px]',
        )}
      >
        <aside
          aria-label="Barre latérale"
          onMouseEnter={() => {
            window.clearTimeout(hoverTimer.current)
            hoverTimer.current = window.setTimeout(() => setHovered(true), 90)
          }}
          onMouseLeave={() => {
            window.clearTimeout(hoverTimer.current)
            hoverTimer.current = window.setTimeout(() => setHovered(false), 180)
          }}
          onFocus={() => setHovered(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovered(false)
          }}
          className={cn(
            'glass lg-lens absolute inset-y-0 left-0 flex flex-col overflow-hidden rounded-[30px] [--spec-size:320px]',
            'transition-[width,box-shadow] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
            expanded ? 'w-[268px]' : 'w-[76px]',
          )}
        >
          <div className={cn('flex h-[72px] shrink-0 items-center gap-2', expanded ? 'pl-4 pr-2.5' : 'justify-center px-2')}>
            <BrandMark compact={!expanded} />
            {expanded && (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={spring.snappy}
                onClick={() => setPinned((v) => !v)}
                aria-pressed={pinned}
                aria-label={pinned ? t('topbar.unpinMenu') : t('topbar.pinMenu')}
                title={pinned ? t('topbar.unpinMenu') : t('topbar.pinMenu')}
                className={cn(
                  'press flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]',
                  pinned ? 'bg-ma-gold-500/15 text-accent-ink' : 'text-ink-3 hover:bg-ink/[0.06] hover:text-ink dark:hover:bg-white/[0.08]',
                )}
              >
                <motion.span animate={{ rotate: pinned ? 0 : 45 }} transition={spring.liquid} className="inline-flex">
                  <Pin size={16} strokeWidth={2.2} className={pinned ? 'fill-current' : undefined} />
                </motion.span>
              </motion.button>
            )}
          </div>
          {nav(!expanded)}
        </aside>
      </div>

      {/* Menu glissant (téléphone) */}
      <AnimatePresence>
        {mobileNav && (
          <div className="fixed inset-0 z-[90] md:hidden">
            <motion.button
              type="button"
              className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
              aria-label={t('topbar.closeMenu')}
              onClick={() => setMobileNav(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              className="glass-strong lg-lens absolute bottom-2 left-2 top-2 flex w-[min(19rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-[32px]"
              initial={{ x: '-110%' }}
              animate={{ x: 0 }}
              exit={{ x: '-110%' }}
              transition={spring.sheet}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.5, right: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80 || info.velocity.x < -500) setMobileNav(false)
              }}
            >
              <div className="flex h-[72px] shrink-0 items-center justify-between px-5">
                <BrandMark />
                <ToolButton onClick={() => setMobileNav(false)} aria-label={t('topbar.closeMenu')}>
                  <X size={18} />
                </ToolButton>
              </div>
              {nav(false)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <div className="relative z-10 min-h-0 min-w-0 flex-1">
        {/* Bord de défilement : le contenu se fond sous la barre en verre */}
        <div
          aria-hidden
          className={cn('lg-scroll-edge absolute inset-x-0 top-0 z-40 h-24 transition-opacity duration-500', scrolled ? 'opacity-100' : 'opacity-0')}
        />
        {/* Barre d'outils flottante en verre liquide : se réduit quand on descend */}
        <header
          className={cn(
            'glass lg-lens absolute inset-x-2 top-2 z-50 flex items-center gap-1.5 rounded-full px-2 [--spec-size:260px] sm:inset-x-3 sm:top-3 sm:gap-2 sm:px-2.5',
            'origin-top transition-[height,transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1.2,0.36,1)]',
            minimized ? 'h-[50px] md:scale-[0.985]' : 'h-[60px]',
          )}
        >

          <HeaderMenu
            open={projectOpen}
            onOpenChange={(next) => only(setProjectOpen, next)}
            align="left"
            panelClassName="w-[17rem]"
            trigger={
              <button
                id="project-switcher"
                type="button"
                aria-haspopup="menu"
                aria-expanded={projectOpen}
                aria-label={t('topbar.project')}
                className="press flex h-10 max-w-[13rem] shrink-0 items-center gap-2 rounded-full bg-ink/[0.045] py-1 pl-1.5 pr-3 text-[13.5px] font-semibold text-ink hover:bg-ink/[0.07] aria-expanded:bg-ink/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
                onClick={() => only(setProjectOpen, !projectOpen)}
              >
                <ProjectLogo code={currentProject !== 'ENTREPRISE' ? currentProject : 'MA'} />
                <span className="hidden truncate sm:inline">{projectName}</span>
                <ChevronDown size={14} strokeWidth={2.4} className={cn('shrink-0 text-ink-3 transition-transform duration-300', projectOpen && 'rotate-180')} />
              </button>
            }
          >
            <MenuLabel>{t('topbar.project')}</MenuLabel>
            {companyWide && (
              <MenuItem
                active={currentProject === 'ENTREPRISE'}
                onClick={() => switchProject('ENTREPRISE')}
              >
                <ProjectLogo code="MA" size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t('topbar.companyWide')}</span>
                  <span className="block text-[12px] text-ink-3">Mindset Alliance</span>
                </span>
                {currentProject === 'ENTREPRISE' && <Check size={17} strokeWidth={2.4} className="text-accent-ink" />}
              </MenuItem>
            )}
            {selectable.map((p) => (
              <MenuItem
                key={p.code}
                active={currentProject === p.code}
                onClick={() => switchProject(p.code)}
              >
                <ProjectLogo code={p.code} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.nom}</span>
                  <span className="block text-[12px] tracking-wide text-ink-3">{p.code}</span>
                </span>
                {currentProject === p.code && <Check size={17} strokeWidth={2.4} className="text-accent-ink" />}
              </MenuItem>
            ))}
          </HeaderMenu>

          <div className={cn('relative min-w-0 flex-1 transition-[flex-grow] duration-500 ease-[var(--ease-ma)] md:max-w-[34rem]', searchOpen ? 'flex-[2]' : 'max-sm:invisible', !searchTarget && 'invisible')}>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" strokeWidth={2.2} />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => {
                setSearchOpen(true)
                closeMenus()
              }}
              onBlur={() => setSearchOpen(false)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || !searchTarget) return
                const text = q.trim()
                navigate(text ? `${searchTarget}?q=${encodeURIComponent(text)}` : searchTarget)
                setQ('')
                searchRef.current?.blur()
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-10 w-full rounded-full border-0 bg-[rgb(118_118_128/0.12)] pl-10 pr-3 text-[14px] text-ink outline-none transition-[background-color,box-shadow] duration-300 placeholder:text-transparent sm:pr-16 sm:placeholder:text-ink-3 focus:bg-surface focus:[box-shadow:var(--ring-focus)] dark:bg-[rgb(118_118_128/0.24)] dark:focus:bg-white/[0.1]"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center rounded-[7px] bg-surface px-1.5 py-0.5 font-sans text-[10.5px] font-semibold text-ink-3 shadow-[0_1px_0_rgb(17_27_63/0.12),inset_0_0_0_1px_rgb(17_27_63/0.08)] sm:inline-flex dark:bg-white/10 dark:shadow-none">
              Ctrl K
            </kbd>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            <span className={cn('hidden items-center gap-1.5 px-2 text-[13px] font-medium capitalize text-ink-3 transition-opacity duration-300', !minimized && 'xl:inline-flex')}>
              <CalendarDays size={15} />
              {today}
              <span className="mx-0.5 h-3.5 w-px bg-hairline" aria-hidden />
              <Clock3 size={15} />
              <span className="tabular-nums text-ink-2">{clock}</span>
            </span>
            <span
              className={cn(
                'mr-1 hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold',
                statusOk ? 'bg-status-success/10 text-status-success' : 'bg-status-warning/12 text-[#a85a04] dark:text-[#fbbf24]',
                !minimized && statusKnown && 'lg:inline-flex',
              )}
            >
              <span className="relative flex h-2 w-2">
                {statusOk && <span className="ma-pulse absolute inline-flex h-full w-full rounded-full bg-status-success/60" />}
                <span className={cn('relative inline-flex h-2 w-2 rounded-full', statusOk ? 'bg-status-success' : 'bg-status-warning')} />
              </span>
              {statusLabel}
            </span>

            <ToolButton aria-label={theme === 'dark' ? t('topbar.themeToLight') : t('topbar.themeToDark')} onClick={toggleTheme}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
                  transition={spring.snappy}
                  className="inline-flex"
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </motion.span>
              </AnimatePresence>
            </ToolButton>

            <HeaderMenu
              open={langOpen}
              onOpenChange={(next) => only(setLangOpen, next)}
              panelClassName="w-72"
              trigger={
                <ToolButton
                  className="hidden sm:inline-flex"
                  aria-label={t('topbar.language')}
                  aria-haspopup="menu"
                  aria-expanded={langOpen}
                  onClick={() => only(setLangOpen, !langOpen)}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={i18n.language}
                      initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.4, opacity: 0, rotate: 30 }}
                      transition={spring.snappy}
                      className="inline-flex"
                    >
                      <LanguageFlag lang={i18n.language} className="h-[22px] w-[22px]" />
                    </motion.span>
                  </AnimatePresence>
                </ToolButton>
              }
            >
              <LanguagePanel
                onSelect={(lng: AppLanguage) => {
                  void i18n.changeLanguage(lng)
                  setLangOpen(false)
                }}
              />
            </HeaderMenu>

            <HeaderMenu
              open={notifOpen}
              onOpenChange={(next) => only(setNotifOpen, next)}
              panelClassName="w-[22rem]"
              trigger={
                <ToolButton
                  aria-label={t('topbar.notifications')}
                  aria-haspopup="menu"
                  aria-expanded={notifOpen}
                  onClick={() => only(setNotifOpen, !notifOpen)}
                >
                  <Bell size={18} />
                  <AnimatePresence>
                    {unread.length > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={spring.snappy}
                        className="absolute right-0.5 top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ff3b30] px-1 text-[10.5px] font-semibold tabular-nums text-white"
                      >
                        {unread.length}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </ToolButton>
              }
            >
              <MenuLabel>{t('topbar.notifications')}</MenuLabel>
              {unread.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <BellOff className="h-6 w-6 text-ink-3" />
                  <p className="text-[13.5px] text-ink-3">{t('home.noUnread')}</p>
                </div>
              )}
              {unread.slice(0, 6).map((n) => (
                <MenuItem key={n.id} className="items-start" onClick={() => markRead.mutate(n.id)}>
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ma-gold-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold leading-snug">{n.titre}</span>
                    {n.message && <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-3">{n.message}</span>}
                  </span>
                </MenuItem>
              ))}
            </HeaderMenu>

            <HeaderMenu
              open={accountOpen}
              onOpenChange={(next) => only(setAccountOpen, next)}
              panelClassName="w-80 max-h-[min(38rem,calc(100vh-5.5rem))]"
              trigger={
                <button
                  type="button"
                  className="press ml-0.5 flex h-10 max-w-[16rem] items-center gap-2.5 rounded-full py-1 pl-1 pr-1 text-ink hover:bg-ink/[0.05] aria-expanded:bg-ink/[0.07] md:pr-3 dark:hover:bg-white/[0.07]"
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                  title={`${displayName}${poste ? ` · ${poste}` : ''}`}
                  onClick={() => only(setAccountOpen, !accountOpen)}
                >
                  <HeaderAvatar photo={me.data?.photo} initials={initials} size="sm" />
                  <span className="hidden min-w-0 max-w-[180px] text-left leading-tight md:block">
                    <span className="block truncate text-[13px] font-semibold">{displayName}</span>
                    <span className="block truncate text-[11.5px] text-ink-3">{poste}</span>
                  </span>
                </button>
              }
            >
              <div className="flex items-center gap-3 px-3 pb-3 pt-2.5">
                <HeaderAvatar photo={me.data?.photo} initials={initials} size="md" />
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{displayName}</span>
                  {email && <span className="block truncate text-[12.5px] text-ink-3">{email}</span>}
                </span>
              </div>
              <div className="mx-1 mb-1 flex flex-wrap gap-1.5 px-2">
                <span className="rounded-full bg-ink/[0.05] px-2.5 py-1 text-[11.5px] font-medium text-ink-2 dark:bg-white/[0.07]">{poste}</span>
                <span className="rounded-full bg-ink/[0.05] px-2.5 py-1 text-[11.5px] font-medium text-ink-2 dark:bg-white/[0.07]">
                  {currentProject === 'ENTREPRISE' ? t('topbar.companyWide') : projectLabel(currentProject)}
                </span>
                {fullAccess && (
                  <span className="rounded-full bg-ma-gold-500/14 px-2.5 py-1 text-[11.5px] font-semibold text-accent-ink">{t('home.fullAccess')}</span>
                )}
              </div>
              <MenuSeparator />
              <MenuLabel>{t('appearance.title')}</MenuLabel>
              <AppearancePanel />
              <MenuSeparator />
              <MenuItem
                onClick={() => {
                  setAccountOpen(false)
                  setProfileOpen(true)
                }}
              >
                <User size={17} className="text-ink-3" />
                {t('topbar.myProfile')}
              </MenuItem>
              <MenuItem className="text-status-danger hover:bg-status-danger/8 dark:text-[#f87171]" onClick={() => void signOut().then(() => navigate('/connexion'))}>
                <LogOut size={17} />
                {t('topbar.signOut')}
              </MenuItem>
            </HeaderMenu>
          </div>
        </header>

        <main
          className="ma-scroll absolute inset-0 z-0 overflow-auto"
          onScroll={(e) => {
            const y = (e.currentTarget as HTMLElement).scrollTop
            setScrolled(y > 4)
            const delta = y - lastScroll.current
            if (Math.abs(delta) > 6) {
              setMinimized(delta > 0 && y > 80)
              lastScroll.current = y
            }
          }}
        >
          <div className="mx-auto w-full max-w-[1600px] px-4 pb-32 pt-[92px] sm:px-6 sm:pt-[100px] md:px-8 md:pb-16">
            <PageFade key={`${location.pathname}:${currentProject}`}>
              <Outlet />
            </PageFade>
          </div>
        </main>

        <MobileTabBar
          minimized={minimized}
          onMenu={() => setMobileNav(true)}
          onSearch={() => {
            setSearchOpen(true)
            requestAnimationFrame(() => searchRef.current?.focus())
          }}
          labels={{ home: currentProject === 'CNN' ? t('nav.cnn-home') : t('nav.accueil'), search: t('topbar.searchShort'), menu: t('topbar.menu') }}
          second={mobileSecond}
        />
      </div>
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  )
}
