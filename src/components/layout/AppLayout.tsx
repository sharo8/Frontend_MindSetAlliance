import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Globe,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  User,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { HeaderMenu } from './HeaderMenu'
import { LanguagePanel } from './LanguagePanel'
import { SidebarNav } from './SidebarNav'
import { PageFade } from '../motion/page-fade'
import { ProfileModal } from '../../features/auth/ProfileEditor'
import { fetchMe } from '../../lib/api/auth'
import { fetchNotifications, fetchProjects, markNotificationRead } from '../../lib/api/domain'
import { useAuthStore } from '../../lib/auth/auth-store'
import type { AppLanguage } from '../../lib/i18n/i18n'
import { useProjectStore } from '../../lib/projects/project-store'
import { buildNavSections, hasFullAccess, isCompanyWide, projectLabel, roleLabel, visibleProjectCodes } from '../../lib/rbac/rbac'
import { useThemeStore } from '../../lib/theme/theme-store'
import { cn } from '../../lib/utils'

const SIDEBAR_KEY = 'ma-sidebar-collapsed'

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

function SocietyMark({ code }: { code: string }) {
  const palette = ['#16215c', '#0f766e', '#9a3412', '#1d4ed8', '#854d0e', '#4c1d95']
  const color = palette[[...code].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % palette.length]
  return (
    <span
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8px] font-bold tracking-wide text-white"
      style={{ background: color }}
      aria-hidden
    >
      {code.slice(0, 3)}
    </span>
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
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_KEY) === '1'
    } catch {
      return false
    }
  })
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
      navigate(notice === 'expired' ? '/connexion?reason=session' : '/connexion', { replace: true })
    } else if (mustChangePassword && location.pathname !== '/premiere-connexion') {
      navigate('/premiere-connexion', { replace: true })
    }
  }, [accessToken, navigate, hydrated, mustChangePassword, location.pathname])

  useEffect(() => {
    syncWithRoles(roles)
  }, [roles, syncWithRoles])

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

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

  const sections = useMemo(() => buildNavSections(roles, currentProject, permissionOverrides), [roles, currentProject, permissionOverrides])
  const fullAccess = hasFullAccess(roles)
  const companyWide = isCompanyWide(roles)
  const jwtProjects = visibleProjectCodes(roles)
  const selectable = (projectsQuery.data ?? []).filter((p) => {
    const inactive = ['INACTIF', 'DESACTIVE'].includes((p.statut ?? '').toUpperCase())
    if (inactive) return false
    return companyWide || jwtProjects.includes('*') || jwtProjects.includes(p.code)
  })
  const unread = (notifQuery.data ?? []).filter((n) => !n.lu)
  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
  const me = useQuery({ queryKey: ['agents-me'], queryFn: fetchMe, enabled: Boolean(accessToken) })
  const primaryRole = roles[0]?.role ?? '—'
  const displayName = headerName(me.data?.prenom, me.data?.nom, email)
  const poste = roleLabel(primaryRole)
  const initials = headerInitials(me.data?.prenom, me.data?.nom, email)
  const dateLocale = i18n.language === 'en' ? 'en-GB' : i18n.language === 'sw' ? 'sw-TZ' : 'fr-FR'
  const projectName =
    currentProject === 'ENTREPRISE'
      ? t('topbar.companyWide')
      : selectable.find((p) => p.code === currentProject)?.nom ?? projectLabel(currentProject)

  function closeMenus() {
    setLangOpen(false)
    setAccountOpen(false)
    setNotifOpen(false)
    setProjectOpen(false)
  }

  if (!hydrated || !accessToken) return null

  const nav = (compact: boolean) => (
    <SidebarNav sections={sections} compact={compact} storageKey={`ma-nav-sections:${email ?? 'anon'}`} />
  )

  return (
    <div className="flex h-svh overflow-hidden bg-ma-paper text-ma-ink dark:bg-ma-navy-950 dark:text-ma-white">
      <aside
        aria-label="Barre latérale"
        className={cn(
          'hidden shrink-0 overflow-hidden border-r border-ma-gold-600/15 bg-gradient-to-b from-ma-navy-800 to-ma-navy-950 text-ma-white transition-[width] duration-300 ease-[var(--ease-ma)] md:flex md:flex-col',
          collapsed ? 'w-[72px]' : 'w-60',
        )}
      >
        <div className={cn('flex h-14 items-center gap-2 border-b border-white/10 px-3', collapsed && 'justify-center px-2')}>
          <img src="/logo-mindset-alliance.jpg" alt="" className="h-8 w-8 rounded-full object-cover ring-1 ring-ma-gold-500/40" />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="font-display text-[9px] tracking-[0.18em] text-ma-gold-400">MINDSET ALLIANCE</p>
              <p className="text-[8px] tracking-[0.22em] text-ma-gray-300">MA WORKSPACE</p>
            </div>
          )}
        </div>
        {nav(collapsed)}
        <div className="hidden border-t border-white/10 p-2 md:block">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl px-2 py-2 text-xs text-ma-gray-300 transition hover:bg-white/5 hover:text-ma-white"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? t('topbar.expandMenu') : t('topbar.collapseMenu')}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!collapsed && <span>{t('topbar.collapse')}</span>}
          </button>
        </div>
      </aside>

      {mobileNav && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" className="absolute inset-0 bg-ma-navy-950/55" aria-label={t('topbar.closeMenu')} onClick={() => setMobileNav(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-ma-navy-900 text-ma-white shadow-[var(--shadow-ma-lg)]">
            <button type="button" className="absolute right-2 top-3 rounded-md p-1.5 hover:bg-white/10" onClick={() => setMobileNav(false)} aria-label="Fermer">
              <X size={16} />
            </button>
            <div className="flex h-14 items-center gap-2 border-b border-white/10 px-3 pr-10">
              <img src="/logo-mindset-alliance.jpg" alt="" className="h-8 w-8 rounded-full object-cover" />
              <div className="min-w-0 leading-tight">
                <p className="font-display text-[9px] tracking-[0.18em] text-ma-gold-400">MINDSET ALLIANCE</p>
                <p className="text-[8px] tracking-[0.22em] text-ma-gray-300">MA WORKSPACE</p>
              </div>
            </div>
            {nav(false)}
          </aside>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-visible">
        <header className="relative z-50 flex h-14 min-h-14 shrink-0 items-center gap-2 overflow-visible border-b border-slate-200 bg-white px-3 text-ma-navy-950 dark:border-white/10 dark:bg-ma-navy-950/90 dark:text-ma-white">
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-700 transition hover:bg-slate-100 md:hidden dark:text-ma-white dark:hover:bg-white/10"
            aria-label="Ouvrir le menu"
            onClick={() => setMobileNav(true)}
          >
            <Menu size={16} />
          </button>
          <div className="flex shrink-0 items-center gap-2 md:hidden">
            <img src="/logo-mindset-alliance.jpg" alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-ma-gold-500/40" />
            <span className="font-display text-[10px] tracking-widest text-ma-navy-900 dark:text-ma-gold-400">MA</span>
          </div>
          <HeaderMenu
            open={projectOpen}
            onOpenChange={(next) => {
              setProjectOpen(next)
              if (next) {
                setLangOpen(false)
                setAccountOpen(false)
                setNotifOpen(false)
              }
            }}
            align="left"
            panelClassName="min-w-[12rem] w-max"
            trigger={
              <button
                id="project-switcher"
                type="button"
                aria-haspopup="menu"
                aria-expanded={projectOpen}
                aria-label={t('topbar.project')}
                className="flex h-8 max-w-[14rem] shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-ma-navy-950 hover:bg-slate-50 dark:border-ma-gold-600/30 dark:bg-ma-navy-800/90 dark:text-ma-white dark:hover:bg-ma-navy-700"
                onClick={() => {
                  setProjectOpen((v) => !v)
                  setLangOpen(false)
                  setAccountOpen(false)
                  setNotifOpen(false)
                }}
              >
                {currentProject !== 'ENTREPRISE' ? (
                  <SocietyMark code={currentProject} />
                ) : (
                  <SocietyMark code="MA" />
                )}
                <span className="truncate">{projectName}</span>
                <ChevronDown size={12} className="shrink-0" />
              </button>
            }
          >
            {companyWide && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ma-navy-700"
                onClick={() => {
                  setProject('ENTREPRISE')
                  setProjectOpen(false)
                }}
              >
                <SocietyMark code="MA" />
                {t('topbar.companyWide')}
              </button>
            )}
            {selectable.map((p) => (
              <button
                key={p.code}
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-ma-navy-700"
                onClick={() => {
                  setProject(p.code)
                  setProjectOpen(false)
                }}
              >
                <SocietyMark code={p.code} />
                <span>
                  <span className="block">{p.nom}</span>
                  <span className="text-[10px] uppercase tracking-wider text-ma-gray-300">{p.code}</span>
                </span>
              </button>
            ))}
          </HeaderMenu>
          <div className={cn('relative min-w-[10rem] flex-1 transition-[flex] duration-300', searchOpen && 'flex-[2]')}>
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 dark:text-ma-gray-300" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => {
                setSearchOpen(true)
                closeMenus()
              }}
              onBlur={() => setSearchOpen(false)}
              placeholder={t('topbar.search')}
              className="h-8 w-full rounded-lg border border-slate-200 bg-slate-100 py-0 pl-8 pr-14 text-xs text-ma-navy-950 placeholder:text-slate-600 transition duration-200 focus:border-ma-gold-500 focus:shadow-[0_0_0_3px_rgba(232,180,42,0.22)] dark:border-white/10 dark:bg-ma-navy-800/80 dark:text-ma-white dark:placeholder:text-ma-gray-300"
            />
            <kbd className="pointer-events-none absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-300 px-1.5 py-0.5 text-[9px] text-slate-600 sm:inline dark:border-white/15 dark:text-ma-gray-300">
              Ctrl+K
            </kbd>
          </div>
          <div className="hidden shrink-0 items-center gap-1.5 text-xs text-slate-700 lg:flex dark:text-ma-gray-300">
            <CalendarDays size={14} />
            <span>{new Date().toLocaleDateString(dateLocale)}</span>
          </div>
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800 sm:inline-flex dark:bg-status-success/15 dark:text-status-success">
            <span className="ma-pulse inline-block h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-status-success" />
            {t('topbar.systemsOk')}
          </span>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-700 transition hover:bg-slate-100 dark:text-ma-white dark:hover:bg-white/10"
            aria-label={theme === 'dark' ? t('topbar.themeToLight') : t('topbar.themeToDark')}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <HeaderMenu
            open={langOpen}
            onOpenChange={(next) => {
              setLangOpen(next)
              if (next) {
                setAccountOpen(false)
                setNotifOpen(false)
                setProjectOpen(false)
              }
            }}
            panelClassName="w-64"
            trigger={
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-700 transition hover:bg-slate-100 dark:text-ma-white dark:hover:bg-white/10"
                aria-label={t('topbar.language')}
                aria-haspopup="menu"
                aria-expanded={langOpen}
                onClick={() => {
                  setLangOpen((v) => !v)
                  setAccountOpen(false)
                  setNotifOpen(false)
                  setProjectOpen(false)
                }}
              >
                <Globe size={16} />
              </button>
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
            onOpenChange={(next) => {
              setNotifOpen(next)
              if (next) {
                setAccountOpen(false)
                setLangOpen(false)
                setProjectOpen(false)
              }
            }}
            panelClassName="w-72 max-w-[calc(100vw-1rem)] p-2"
            trigger={
              <button
                type="button"
                className="relative rounded-lg p-1.5 text-slate-700 transition hover:bg-slate-100 dark:text-ma-white dark:hover:bg-white/10"
                aria-label={t('topbar.notifications')}
                aria-haspopup="menu"
                aria-expanded={notifOpen}
                onClick={() => {
                  setNotifOpen((v) => !v)
                  setAccountOpen(false)
                  setLangOpen(false)
                  setProjectOpen(false)
                }}
              >
                <Bell size={16} />
                {unread.length > 0 && (
                  <span className="absolute right-0.5 top-0.5 inline-flex min-w-3.5 items-center justify-center rounded-full bg-ma-gold-500 px-1 text-[9px] font-bold text-ma-navy-950">
                    {unread.length}
                  </span>
                )}
              </button>
            }
          >
            {unread.length === 0 && <p className="px-2 py-3 text-sm text-ma-gray-300">Aucune notification non lue.</p>}
            {unread.slice(0, 6).map((n) => (
              <button
                key={n.id}
                type="button"
                className="block w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5"
                onClick={() => markRead.mutate(n.id)}
              >
                <span className="block font-medium">{n.titre}</span>
                {n.message && <span className="mt-0.5 block text-xs text-ma-gray-300">{n.message}</span>}
              </button>
            ))}
          </HeaderMenu>
          <HeaderMenu
            open={accountOpen}
            onOpenChange={(next) => {
              setAccountOpen(next)
              if (next) {
                setLangOpen(false)
                setNotifOpen(false)
                setProjectOpen(false)
              }
            }}
            panelClassName="w-56 p-1"
            trigger={
              <button
                type="button"
                className="flex max-w-[16.5rem] items-center gap-2 rounded-lg px-1.5 py-1 text-ma-navy-950 transition hover:bg-slate-100 dark:text-ma-white dark:hover:bg-white/10"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                title={`${displayName}${poste ? ` — ${poste}` : ''}`}
                onClick={() => {
                  setAccountOpen((v) => !v)
                  setLangOpen(false)
                  setNotifOpen(false)
                  setProjectOpen(false)
                }}
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ma-navy-900 text-[11px] font-semibold tracking-wide text-ma-gold-300 dark:bg-ma-gold-500/20">
                  {initials}
                </span>
                <span className="hidden min-w-0 max-w-[220px] text-left leading-tight md:block">
                  <span className="block truncate text-xs font-semibold text-ma-navy-950 dark:text-ma-white" title={displayName}>
                    {displayName}
                  </span>
                  <span className="block truncate text-[11px] text-slate-600 dark:text-ma-gray-300" title={poste}>
                    {poste}
                  </span>
                </span>
                {fullAccess && (
                  <span className="hidden rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-ma-muted ring-1 ring-ma-line md:inline dark:text-ma-gray-300 dark:ring-white/15">
                    {t('home.fullAccess')}
                  </span>
                )}
                <ChevronDown size={14} className="hidden shrink-0 md:block" />
              </button>
            }
          >
            {email && (
              <p className="truncate px-2 py-1 text-xs text-ma-gray-300" title={email}>
                {email}
              </p>
            )}
            <p className="px-2 py-1 text-xs text-ma-gray-300">
              {currentProject === 'ENTREPRISE' ? t('topbar.companyWide') : projectLabel(currentProject)}
            </p>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-ma-navy-700"
              onClick={() => {
                setAccountOpen(false)
                setProfileOpen(true)
              }}
            >
              <User size={14} />
              {t('topbar.myProfile')}
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-ma-navy-700"
              onClick={() => void signOut().then(() => navigate('/connexion'))}
            >
              <LogOut size={14} />
              {t('topbar.signOut')}
            </button>
          </HeaderMenu>
        </header>
        <main className="relative z-0 min-h-0 min-w-0 flex-1 overflow-auto bg-ma-paper p-4 md:p-6 dark:bg-[linear-gradient(180deg,#0a1332_0%,#050b1f_220px)]">
          <PageFade key={`${location.pathname}:${currentProject}`}>
            <Outlet />
          </PageFade>
        </main>
      </div>
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  )
}
