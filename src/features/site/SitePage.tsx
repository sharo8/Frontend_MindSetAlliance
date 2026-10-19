import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Clapperboard,
  Compass,
  Hammer,
  Languages,
  Lightbulb,
  LogIn,
  MapPin,
  Menu,
  Navigation,
  PackageCheck,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
  Workflow,
  X,
} from 'lucide-react'
import { SceneBackground, usePointerField } from '../auth/ProductShowcase'
import { LanguageSwitch, ThemeSwitch } from '../auth/AuthShell'
import { useAuthStore } from '../../lib/auth/auth-store'
import { useThemeStore } from '../../lib/theme/theme-store'
import { cn } from '../../lib/utils'
import { Constellation } from './Constellation'

/**
 * Site vitrine de Mindset Alliance : qui nous sommes, nos produits, notre manière de faire.
 * Page publique (pas de connexion). Le bouton « Espace équipe » mène à la connexion de MA Workspace.
 * Uniquement des faits vérifiés : aucun chiffre, avis ou client inventé.
 */
export function SitePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const signedIn = Boolean(useAuthStore((s) => s.accessToken))
  const hydrateAuth = useAuthStore((s) => s.hydrate)
  const dark = useThemeStore((s) => s.theme === 'dark')
  const hydrateTheme = useThemeStore((s) => s.hydrate)
  const { x, y } = usePointerField()
  const [menu, setMenu] = useState(false)
  const { scrollYProgress, scrollY } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    hydrateAuth()
    hydrateTheme()
  }, [hydrateAuth, hydrateTheme])
  useEffect(() => scrollY.on('change', (v) => setScrolled(v > 24)), [scrollY])
  useEffect(() => {
    document.title = t('site.docTitle', 'Mindset Alliance | Qui sommes-nous')
  }, [t])

  const enter = () => navigate(signedIn ? '/' : '/connexion')
  const nav = [
    { id: 'qui-sommes-nous', label: t('site.nav.about', 'Qui sommes-nous') },
    { id: 'produits', label: t('site.nav.products', 'Nos produits') },
    { id: 'approche', label: t('site.nav.approach', 'Notre approche') },
    { id: 'contact', label: t('site.nav.contact', 'Contact') },
  ]
  const go = (id: string) => {
    setMenu(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="auth-scene relative min-h-svh overflow-x-clip text-ink">
      <div className="fixed inset-0">
        <SceneBackground x={x} y={y} />
      </div>
      <motion.div style={{ scaleX: progress }} className="fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-gradient-to-r from-[#b98a14] via-[#f2c35a] to-[#4f6bff]" />

      {/* ── Barre de navigation ───────────────────────────────────────────── */}
      <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
        <div
          className={cn(
            'mx-auto flex max-w-[1240px] items-center gap-3 rounded-full px-3 py-2 transition-all duration-500 sm:px-4',
            scrolled ? 'glass-strong shadow-lg' : 'bg-transparent',
          )}
        >
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5" aria-label="Mindset Alliance">
            <img src="/logo-mindset-alliance.jpg" alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-black/5 dark:ring-white/10" />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block font-display text-[12.5px] font-semibold tracking-[0.2em] text-ink">MINDSET ALLIANCE</span>
              <span className="block text-[11px] font-medium text-ink-3">{t('site.place', 'Kinshasa, RDC')}</span>
            </span>
          </button>
          <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label={t('site.nav.label', 'Sections')}>
            {nav.map((n) => (
              <button key={n.id} type="button" onClick={() => go(n.id)} className="rounded-full px-3.5 py-2 text-[13.5px] font-medium text-ink-2 transition-colors hover:bg-ink/[0.05] hover:text-ink dark:hover:bg-white/[0.07]">
                {n.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            <span className="hidden md:block">
              <LanguageSwitch />
            </span>
            <span className="hidden sm:block">
              <ThemeSwitch />
            </span>
            <button
              type="button"
              onClick={enter}
              className="press group relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-full bg-[#0a1330] px-4 text-[13.5px] font-semibold text-white shadow-[0_8px_24px_-10px_rgb(10_19_48/0.8)] dark:bg-white dark:text-[#0a1330]"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full dark:via-[#f2c35a]/40" />
              <LogIn className="relative h-4 w-4" />
              <span className="relative">{signedIn ? t('site.open', 'Ouvrir MA Workspace') : t('site.team', 'Espace équipe')}</span>
            </button>
            <button type="button" onClick={() => setMenu((m) => !m)} aria-label={t('site.nav.label', 'Sections')} aria-expanded={menu} className="glass press inline-flex h-10 w-10 items-center justify-center rounded-full lg:hidden">
              {menu ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>
        <AnimatePresence>
          {menu && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="glass-strong mx-auto mt-2 max-w-[1240px] rounded-[26px] p-2 lg:hidden"
            >
              {nav.map((n) => (
                <button key={n.id} type="button" onClick={() => go(n.id)} className="block w-full rounded-[18px] px-4 py-3 text-left text-[15px] font-semibold text-ink hover:bg-ink/[0.05] dark:hover:bg-white/[0.07]">
                  {n.label}
                </button>
              ))}
              <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-2">
                <LanguageSwitch />
                <ThemeSwitch />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="relative z-10">
        <Hero dark={dark} onDiscover={() => go('produits')} onEnter={enter} signedIn={signedIn} />
        <WordsBand />
        <About />
        <Products />
        <Approach />
        <Contact onEnter={enter} signedIn={signedIn} />
      </main>
      <Footer onNav={go} />
    </div>
  )
}

// ── Héros ──────────────────────────────────────────────────────────────────────

function Hero({ dark, onDiscover, onEnter, signedIn }: { dark: boolean; onDiscover: () => void; onEnter: () => void; signedIn: boolean }) {
  const { t, i18n } = useTranslation()
  const reduce = useReducedMotion()
  const words = (t('site.hero.words', { returnObjects: true, defaultValue: ['ambitieux', 'inspirant', 'innovant', 'exigeant', 'audacieux'] }) as unknown as string[]) ?? []
  const [i, setI] = useState(0)
  useEffect(() => {
    if (reduce || words.length < 2) return
    const id = window.setInterval(() => setI((n) => (n + 1) % words.length), 2600)
    return () => window.clearInterval(id)
  }, [reduce, words.length])
  const { scrollY } = useScroll()
  const lift = useTransform(scrollY, [0, 600], [0, -80])
  const fade = useTransform(scrollY, [0, 500], [1, 0.2])

  return (
    <section className="relative flex min-h-svh items-center overflow-hidden px-5 pb-20 pt-32 sm:px-8">
      <Constellation dark={dark} className="absolute inset-0 h-full w-full" />
      <motion.div style={{ y: lift, opacity: fade }} className="relative mx-auto grid w-full max-w-[1240px] items-center gap-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, type: 'spring', stiffness: 160, damping: 20 }}>
            <KinshasaClock />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30, filter: 'blur(14px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: 0.2, duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-7 font-display text-[clamp(2.6rem,7.4vw,6rem)] font-semibold leading-[0.98] tracking-[0.02em]"
          >
            <span className="site-shimmer block">MINDSET</span>
            <span className="site-gold-text block">ALLIANCE</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, type: 'spring', stiffness: 140, damping: 20 }}
            className="mt-7 max-w-[34rem] text-[clamp(1.05rem,1.6vw,1.3rem)] leading-relaxed text-ink-2"
          >
            {t('site.hero.lead', 'Nous imaginons, construisons et faisons vivre nos propres produits numériques, pensés pour le quotidien en République démocratique du Congo.')}
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-5 flex flex-wrap items-center gap-x-2 text-[clamp(1.2rem,2vw,1.6rem)] font-semibold leading-[1.4] tracking-[-0.02em] text-ink">
            <span>{t('site.hero.mindset', 'Un état d’esprit')}</span>
            <span className="relative inline-block h-[1.4em] min-w-[10ch] overflow-hidden" lang={i18n.language}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={words[i] ?? 'w'}
                  initial={{ y: '100%', opacity: 0, filter: 'blur(6px)' }}
                  animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
                  exit={{ y: '-100%', opacity: 0, filter: 'blur(6px)' }}
                  transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                  className="site-gold-text absolute inset-x-0 top-0 whitespace-nowrap leading-[1.4]"
                >
                  {words[i]}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, type: 'spring', stiffness: 160, damping: 20 }} className="mt-10 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onDiscover}
              className="press group inline-flex h-13 items-center gap-2.5 rounded-full bg-gradient-to-r from-[#e9b949] to-[#f6d77e] px-6 py-3.5 text-[15px] font-bold text-[#1c1405] shadow-[0_14px_40px_-12px_rgb(233_185_73/0.75)]"
            >
              <Sparkles className="h-[18px] w-[18px]" />
              {t('site.hero.discover', 'Découvrir nos produits')}
              <ArrowRight className="h-[18px] w-[18px] transition-transform group-hover:translate-x-1" />
            </button>
            <button type="button" onClick={onEnter} className="glass press inline-flex items-center gap-2.5 rounded-full px-6 py-3.5 text-[15px] font-semibold text-ink">
              <LogIn className="h-[18px] w-[18px]" />
              {signedIn ? t('site.open', 'Ouvrir MA Workspace') : t('site.team', 'Espace équipe')}
            </button>
          </motion.div>
        </div>

        <HeroEmblem />
      </motion.div>
      <motion.button
        type="button"
        onClick={onDiscover}
        aria-label={t('site.hero.scroll', 'Faire défiler')}
        animate={reduce ? undefined : { y: [0, 8, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-7 left-1/2 hidden h-11 w-7 -translate-x-1/2 items-start justify-center rounded-full border-2 border-ink/25 pt-2 sm:flex"
      >
        <span className="h-2 w-1 rounded-full bg-[#e9b949]" />
      </motion.button>
    </section>
  )
}

/** Heure de Kinshasa en direct (comme la page d'attente du site). */
function KinshasaClock() {
  const { t, i18n } = useTranslation()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const time = now.toLocaleTimeString(i18n.language?.startsWith('en') ? 'en-GB' : 'fr-FR', { timeZone: 'Africa/Kinshasa', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return (
    <span className="glass inline-flex items-center gap-2.5 rounded-full py-1.5 pl-2 pr-4 text-[13px] font-medium text-ink-2">
      <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-[#e9b949]/20">
        <span className="absolute inset-0 animate-ping rounded-full bg-[#e9b949]/30" />
        <MapPin className="relative h-3.5 w-3.5 text-accent-ink" />
      </span>
      {t('site.hero.from', 'Depuis Kinshasa')}
      <span className="font-semibold tabular-nums text-ink">{time}</span>
    </span>
  )
}

/** Emblème : le logo dans des anneaux de lumière, et les produits en orbite. */
function HeroEmblem() {
  const reduce = useReducedMotion()
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rx = useSpring(useTransform(my, [-1, 1], [10, -10]), { stiffness: 120, damping: 16 })
  const ry = useSpring(useTransform(mx, [-1, 1], [-12, 12]), { stiffness: 120, damping: 16 })
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.35, type: 'spring', stiffness: 90, damping: 16 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        mx.set(((e.clientX - r.left) / r.width) * 2 - 1)
        my.set(((e.clientY - r.top) / r.height) * 2 - 1)
      }}
      onPointerLeave={() => {
        mx.set(0)
        my.set(0)
      }}
      className="relative mx-auto aspect-square w-full max-w-[26rem] [perspective:1200px]"
    >
      <motion.div style={{ rotateX: rx, rotateY: ry }} className="relative h-full w-full [transform-style:preserve-3d]">
        <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle,rgb(242_195_90/0.35),transparent_65%)] blur-2xl" />
        <div className="absolute inset-[22%] rounded-full">
          <span className="site-ring" />
          <span className="site-ring is-slow" />
          <div className="glass-strong relative flex h-full w-full items-center justify-center rounded-full p-4 [transform:translateZ(40px)]">
            <img src="/logo-mindset-alliance.jpg" alt="Mindset Alliance" className="h-full w-full rounded-full object-cover shadow-[0_20px_60px_-20px_rgb(0_0_0/0.6)]" />
          </div>
        </div>
        {/* Produits en orbite */}
        <motion.div
          className="absolute inset-0"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
        >
          <Orbiter className="left-1/2 top-[2%] -translate-x-1/2">
            <img src="/logo-colis-na-nga.png" alt="Colis na Nga" className="h-full w-full rounded-full object-cover" />
          </Orbiter>
          <Orbiter className="bottom-[8%] left-[6%]">
            <span className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#18245a] to-[#0a1330] text-[13px] font-extrabold tracking-[0.08em] text-[#f2c35a]">MDR</span>
          </Orbiter>
          <Orbiter className="bottom-[8%] right-[6%]">
            <span className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[#f2c35a] to-[#b98a14] text-[#1c1405]">
              <Sparkles className="h-6 w-6" />
            </span>
          </Orbiter>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

function Orbiter({ className, children }: { className: string; children: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={cn('glass-strong absolute h-16 w-16 rounded-full p-1.5 sm:h-[4.5rem] sm:w-[4.5rem]', className)}
      animate={reduce ? undefined : { rotate: -360 }}
      transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
    >
      {children}
    </motion.div>
  )
}

// ── Bande de mots ──────────────────────────────────────────────────────────────

function WordsBand() {
  const { t } = useTranslation()
  const items = [
    t('site.band.imagine', 'Imaginer'),
    t('site.band.build', 'Construire'),
    t('site.band.deliver', 'Livrer'),
    t('site.band.inspire', 'Inspirer'),
    'Colis na Nga',
    'Mindset du Royaume',
    'Kinshasa',
    'Mbote',
    'Jambo',
    t('site.band.hello', 'Bonjour'),
  ]
  const row = [...items, ...items]
  return (
    <div className="relative border-y border-hairline bg-ink/[0.02] py-5 dark:bg-white/[0.02]" aria-hidden>
      <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
        <div className="site-marquee gap-10 pr-10">
          {row.map((w, i) => (
            <span key={i} className="flex items-center gap-10 whitespace-nowrap font-display text-[clamp(1.2rem,2.4vw,1.9rem)] font-semibold tracking-[0.06em] text-ink/70">
              {w}
              <Sparkles className="h-4 w-4 text-[#e9b949]" />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Sections ───────────────────────────────────────────────────────────────────

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ delay, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function SectionTitle({ kicker, title, lead }: { kicker: string; title: ReactNode; lead?: string }) {
  return (
    <Reveal className="max-w-[46rem]">
      <p className="text-[12.5px] font-bold uppercase tracking-[0.22em] text-accent-ink">{kicker}</p>
      <h2 className="mt-4 text-[clamp(2rem,4.6vw,3.6rem)] font-bold leading-[1.04] tracking-[-0.045em] text-ink">{title}</h2>
      {lead && <p className="mt-5 text-[clamp(1rem,1.4vw,1.15rem)] leading-relaxed text-ink-2">{lead}</p>}
    </Reveal>
  )
}

/** Carte qui s'incline vers le pointeur, avec une lumière dorée sous le curseur. */
function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const reduce = useReducedMotion()
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 200, damping: 18 })
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 200, damping: 18 })
  return (
    <motion.div
      ref={ref}
      style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformPerspective: 1000 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        mx.set((e.clientX - r.left) / r.width - 0.5)
        my.set((e.clientY - r.top) / r.height - 0.5)
        e.currentTarget.style.setProperty('--sx', `${e.clientX - r.left}px`)
        e.currentTarget.style.setProperty('--sy', `${e.clientY - r.top}px`)
      }}
      onPointerLeave={() => {
        mx.set(0)
        my.set(0)
      }}
      className={cn('glass-strong group relative overflow-hidden rounded-[32px]', className)}
    >
      <span className="site-spot pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative">{children}</div>
    </motion.div>
  )
}

function About() {
  const { t } = useTranslation()
  const pillars = [
    { icon: <Lightbulb />, title: t('site.about.p1t', 'Imaginer'), text: t('site.about.p1', 'Partir des besoins réels des gens d’ici et dessiner des solutions simples, utiles et belles.') },
    { icon: <Hammer />, title: t('site.about.p2t', 'Construire'), text: t('site.about.p2', 'Une équipe technique interne qui développe nos applications, nos serveurs et nos outils, de bout en bout.') },
    { icon: <Compass />, title: t('site.about.p3t', 'Faire vivre'), text: t('site.about.p3', 'Nous exploitons nous-mêmes nos produits, chaque jour, et les améliorons au contact de ceux qui les utilisent.') },
  ]
  return (
    <section id="qui-sommes-nous" className="relative scroll-mt-24 px-5 py-28 sm:px-8 sm:py-36">
      <div className="mx-auto max-w-[1240px]">
        <SectionTitle
          kicker={t('site.about.kicker', 'Qui sommes-nous')}
          title={
            <>
              {t('site.about.title1', 'Une société qui crée')} <span className="site-gold-text">{t('site.about.title2', 'ses propres produits')}</span>
            </>
          }
          lead={t(
            'site.about.lead',
            'MINDSET ALLIANCE SARL est une société basée à Kinshasa. Nous ne sommes pas une agence : nous concevons, développons et exploitons nos propres produits numériques, de l’idée jusqu’au quotidien de ceux qui les utilisent. Colis na Nga et Mindset du Royaume sont les premiers ; d’autres sont en préparation.',
          )}
        />
        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.12}>
              <TiltCard className="h-full p-8">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-gradient-to-br from-[#f2c35a] to-[#b98a14] text-[#1c1405] shadow-[0_12px_30px_-12px_rgb(233_185_73/0.8)] [&>svg]:h-6 [&>svg]:w-6">
                  {p.icon}
                </span>
                <p className="mt-6 font-display text-[13px] font-semibold tracking-[0.2em] text-ink-3">0{i + 1}</p>
                <h3 className="mt-1.5 text-[24px] font-bold tracking-[-0.03em] text-ink">{p.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{p.text}</p>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Products() {
  const { t } = useTranslation()
  const features = [
    { icon: <Navigation />, text: t('site.cnn.f1', 'Suivi GPS en direct de chaque course') },
    { icon: <PackageCheck />, text: t('site.cnn.f2', 'Remise confirmée par code, signature ou photo') },
    { icon: <Wallet />, text: t('site.cnn.f3', 'Paiement par Mobile Money') },
    { icon: <Users />, text: t('site.cnn.f4', 'Motards partenaires des associations et coursiers de l’entreprise pour les clients abonnés') },
  ]
  return (
    <section id="produits" className="relative scroll-mt-24 px-5 py-28 sm:px-8 sm:py-36">
      <div className="mx-auto max-w-[1240px]">
        <SectionTitle
          kicker={t('site.products.kicker', 'Nos produits')}
          title={t('site.products.title', 'Ce que nous construisons')}
          lead={t('site.products.lead', 'Chaque produit répond à un besoin concret. Ensemble, ils forment l’alliance.')}
        />

        <div className="mt-16 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {/* Colis na Nga */}
          <Reveal className="lg:row-span-2">
            <TiltCard className="h-full p-8 sm:p-10">
              <div className="flex items-center gap-4">
                <img src="/logo-colis-na-nga.png" alt="" className="h-16 w-16 rounded-[20px] object-cover shadow-[0_14px_36px_-14px_rgb(240_90_26/0.8)]" />
                <div>
                  <h3 className="text-[30px] font-bold tracking-[-0.04em] text-ink">Colis na Nga</h3>
                  <p className="text-[14px] font-medium text-ink-3">{t('site.cnn.tag', 'Livraison à Kinshasa')}</p>
                </div>
              </div>
              <p className="mt-6 max-w-[36rem] text-[clamp(1.05rem,1.5vw,1.2rem)] leading-relaxed text-ink-2">
                {t('site.cnn.lead', 'L’application pour envoyer des lettres et des colis légers partout à Kinshasa, en quelques touches.')}
              </p>
              <RouteVisual />
              <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                {features.map((f) => (
                  <li key={f.text} className="flex items-start gap-3 rounded-[18px] bg-ink/[0.03] p-3.5 text-[14px] leading-snug text-ink-2 dark:bg-white/[0.04]">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-[#f05a1a]/12 text-[#f05a1a] [&>svg]:h-4 [&>svg]:w-4">{f.icon}</span>
                    {f.text}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="https://colisnanga.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="press group inline-flex items-center gap-2 rounded-full bg-[#f05a1a] px-5 py-3 text-[14.5px] font-bold text-white shadow-[0_12px_30px_-12px_rgb(240_90_26/0.85)]"
                >
                  colisnanga.com
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </a>
                <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold text-ink-2">
                  <Smartphone className="h-4 w-4" />
                  {t('site.cnn.stores', 'Android et iOS : bientôt sur les stores')}
                </span>
              </div>
            </TiltCard>
          </Reveal>

          {/* Mindset du Royaume */}
          <Reveal delay={0.12}>
            <TiltCard className="h-full p-8">
              <div className="flex items-center gap-4">
                <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#18245a] to-[#0a1330] text-[17px] font-extrabold tracking-[0.08em] text-[#f2c35a] shadow-[0_14px_36px_-14px_rgb(10_19_48/0.9)]">
                  MDR
                </span>
                <div>
                  <h3 className="text-[26px] font-bold tracking-[-0.04em] text-ink">Mindset du Royaume</h3>
                  <p className="flex items-center gap-1.5 text-[14px] font-medium text-ink-3">
                    <Clapperboard className="h-4 w-4" />
                    {t('site.mdr.tag', 'Chaîne YouTube')}
                  </p>
                </div>
              </div>
              <p className="mt-5 text-[15px] leading-relaxed text-ink-2">
                {t('site.mdr.lead', 'La chaîne YouTube de Mindset Alliance : des vidéos pour partager des idées et nourrir l’état d’esprit qui nous anime.')}
              </p>
            </TiltCard>
          </Reveal>

          {/* La suite */}
          <Reveal delay={0.2}>
            <TiltCard className="h-full p-8">
              <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#f2c35a] to-[#b98a14] text-[#1c1405]">
                <span className="absolute inset-0 animate-ping rounded-[20px] bg-[#f2c35a]/30" />
                <Sparkles className="relative h-7 w-7" />
              </span>
              <h3 className="mt-5 text-[26px] font-bold tracking-[-0.04em] text-ink">{t('site.next.title', 'Et la suite…')}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{t('site.next.lead', 'D’autres produits sont en préparation dans nos ateliers. Restez à l’écoute.')}</p>
            </TiltCard>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/** Petite scène vivante : un colis qui file d'un point à l'autre de Kinshasa. */
function RouteVisual() {
  const reduce = useReducedMotion()
  const path = 'M 30 120 C 120 20, 200 170, 290 80 S 430 40, 510 110'
  return (
    <div className="relative mt-7 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#0a1330] to-[#18245a] p-4">
      <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgb(255_255_255/0.25)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.25)_1px,transparent_1px)] [background-size:28px_28px]" />
      <svg viewBox="0 0 540 160" className="relative h-auto w-full" role="img" aria-label="Colis na Nga">
        <path d={path} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="10" strokeLinecap="round" />
        <path d={path} fill="none" stroke="#f2c35a" strokeWidth="3" strokeLinecap="round" className="site-route" />
        <circle cx="30" cy="120" r="9" fill="#f05a1a" />
        <circle cx="30" cy="120" r="16" fill="#f05a1a" opacity="0.25">
          {!reduce && <animate attributeName="r" values="10;22;10" dur="2.2s" repeatCount="indefinite" />}
        </circle>
        <circle cx="510" cy="110" r="9" fill="#22c55e" />
        <circle cx="510" cy="110" r="16" fill="#22c55e" opacity="0.25">
          {!reduce && <animate attributeName="r" values="10;22;10" dur="2.2s" begin="1.1s" repeatCount="indefinite" />}
        </circle>
        <g>
          <circle r="11" fill="#fff" />
          <circle r="6" fill="#f05a1a" />
          {!reduce && <animateMotion dur="5s" repeatCount="indefinite" path={path} rotate="auto" />}
        </g>
      </svg>
    </div>
  )
}

function Approach() {
  const { t } = useTranslation()
  const items = [
    { icon: <MapPin />, title: t('site.approach.a1t', 'Pensé pour ici'), text: t('site.approach.a1', 'Mobile Money, adresses et repères de Kinshasa, français, anglais, lingala et swahili : nos produits parlent la langue de ceux qui les utilisent.') },
    { icon: <Users />, title: t('site.approach.a2t', 'Une équipe intégrée'), text: t('site.approach.a2', 'Nos développeurs travaillent ensemble sur tous les produits, de l’application mobile au serveur.') },
    { icon: <ShieldCheck />, title: t('site.approach.a3t', 'Confiance et sécurité'), text: t('site.approach.a3', 'Accès contrôlés, données protégées, chaque action importante tracée.') },
    { icon: <Workflow />, title: t('site.approach.a4t', 'Un pilotage commun'), text: t('site.approach.a4', 'MA Workspace, notre console interne, relie nos produits et nos équipes au même endroit.') },
  ]
  return (
    <section id="approche" className="relative scroll-mt-24 px-5 py-28 sm:px-8 sm:py-36">
      <div className="mx-auto max-w-[1240px]">
        <SectionTitle kicker={t('site.approach.kicker', 'Notre approche')} title={t('site.approach.title', 'Notre manière de faire')} />
        <div className="mt-16 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((it, i) => (
            <Reveal key={it.title} delay={i * 0.1}>
              <TiltCard className="h-full p-7">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#4f6bff]/12 text-[#4f6bff] dark:bg-[#7c94ff]/15 dark:text-[#9fb0ff] [&>svg]:h-[22px] [&>svg]:w-[22px]">{it.icon}</span>
                <h3 className="mt-5 text-[19px] font-bold tracking-[-0.025em] text-ink">{it.title}</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-2">{it.text}</p>
              </TiltCard>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.1} className="mt-5">
          <div className="glass-strong flex flex-wrap items-center gap-x-8 gap-y-4 rounded-[28px] px-7 py-6">
            <span className="flex items-center gap-3 text-[15px] font-semibold text-ink">
              <Languages className="h-5 w-5 text-accent-ink" />
              {t('site.approach.langs', 'Nous parlons votre langue')}
            </span>
            {[
              ['Bonjour', 'Français'],
              ['Hello', 'English'],
              ['Mbote', 'Lingala'],
              ['Jambo', 'Kiswahili'],
            ].map(([hi, lang]) => (
              <span key={lang} className="flex items-baseline gap-2">
                <span className="site-gold-text text-[22px] font-bold tracking-[-0.02em]">{hi}</span>
                <span className="text-[12.5px] text-ink-3">{lang}</span>
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Contact({ onEnter, signedIn }: { onEnter: () => void; signedIn: boolean }) {
  const { t } = useTranslation()
  return (
    <section id="contact" className="relative scroll-mt-24 px-5 py-28 sm:px-8 sm:py-36">
      <Reveal className="mx-auto max-w-[1100px]">
        <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-br from-[#0a1330] via-[#111b3f] to-[#18245a] px-7 py-16 text-center text-white shadow-[0_40px_100px_-40px_rgb(10_19_48/0.9)] sm:px-14 sm:py-20">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#f2c35a]/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-[#4f6bff]/30 blur-3xl" />
          <img src="/logo-mindset-alliance.jpg" alt="" className="relative mx-auto h-20 w-20 rounded-full object-cover ring-4 ring-white/10" />
          <h2 className="relative mt-8 text-[clamp(2rem,4.4vw,3.4rem)] font-bold leading-[1.05] tracking-[-0.045em]">
            {t('site.contact.title', 'Construisons la suite ensemble')}
          </h2>
          <p className="relative mx-auto mt-5 max-w-[38rem] text-[16.5px] leading-relaxed text-white/75">
            {t('site.contact.lead', 'Une idée, un partenariat, une question sur nos produits ? Retrouvez-nous sur nos sites. Membre de l’équipe ? Votre espace vous attend.')}
          </p>
          <div className="relative mt-10 flex flex-wrap justify-center gap-3">
            <a href="https://mindset-alliance.com" target="_blank" rel="noopener noreferrer" className="press inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3.5 text-[15px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-md hover:bg-white/15">
              mindset-alliance.com
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <a href="https://colisnanga.com" target="_blank" rel="noopener noreferrer" className="press inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3.5 text-[15px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-md hover:bg-white/15">
              colisnanga.com
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={onEnter}
              className="press inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#e9b949] to-[#f6d77e] px-6 py-3.5 text-[15px] font-bold text-[#1c1405] shadow-[0_14px_40px_-12px_rgb(233_185_73/0.75)]"
            >
              <LogIn className="h-[18px] w-[18px]" />
              {signedIn ? t('site.open', 'Ouvrir MA Workspace') : t('site.contact.login', 'Se connecter à MA Workspace')}
            </button>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function Footer({ onNav }: { onNav: (id: string) => void }) {
  const { t } = useTranslation()
  return (
    <footer className="relative z-10 border-t border-hairline px-5 py-12 sm:px-8">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo-mindset-alliance.jpg" alt="" className="h-11 w-11 rounded-full object-cover" />
          <div>
            <p className="font-display text-[13px] font-semibold tracking-[0.2em] text-ink">MINDSET ALLIANCE</p>
            <p className="text-[12.5px] text-ink-3">{t('site.footer.place', 'Kinshasa, République démocratique du Congo')}</p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-ink-2" aria-label={t('site.nav.label', 'Sections')}>
          <button type="button" onClick={() => onNav('qui-sommes-nous')} className="hover:text-ink">{t('site.nav.about', 'Qui sommes-nous')}</button>
          <button type="button" onClick={() => onNav('produits')} className="hover:text-ink">{t('site.nav.products', 'Nos produits')}</button>
          <button type="button" onClick={() => onNav('approche')} className="hover:text-ink">{t('site.nav.approach', 'Notre approche')}</button>
          <Link to="/connexion" className="hover:text-ink">{t('site.team', 'Espace équipe')}</Link>
        </nav>
        <p className="text-[12.5px] text-ink-3">© {new Date().getFullYear()} MINDSET ALLIANCE SARL</p>
      </div>
    </footer>
  )
}
