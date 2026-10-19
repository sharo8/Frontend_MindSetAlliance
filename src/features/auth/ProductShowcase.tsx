import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react'
import { BadgeCheck, Banknote, ShieldCheck, TicketCheck, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { easeIOS } from '../../components/motion/springs'

/**
 * Scène de connexion « graphite » (couleurs du mode sombre du système) :
 * un seul décor pour toute la page, une lumière qui suit la souris,
 * et des widgets en verre liquide qui flottent derrière et à côté du formulaire.
 */

/** Position du pointeur sur toute la page (-1 à 1), adoucie par un ressort. */
export function usePointerField() {
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const x = useSpring(px, { stiffness: 70, damping: 18 })
  const y = useSpring(py, { stiffness: 70, damping: 18 })
  const reduce = useReducedMotion()
  useEffect(() => {
    if (reduce) return
    const onMove = (e: PointerEvent) => {
      px.set((e.clientX / window.innerWidth) * 2 - 1)
      py.set((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [px, py, reduce])
  return { x, y }
}

/** Décor : noir graphite, voiles de lumière gris très lents, une seule touche d'or, lumière qui suit la souris. */
export function SceneBackground({ x, y }: { x: MotionValue<number>; y: MotionValue<number> }) {
  const reduce = useReducedMotion()
  const lx = useTransform(x, [-1, 1], ['15%', '85%'])
  const ly = useTransform(y, [-1, 1], ['10%', '90%'])
  const fx = useTransform(x, [-1, 1], [-24, 24])
  const fy = useTransform(y, [-1, 1], [-16, 16])
  const veils = [
    { c: 'bg-[#f6f6f9] dark:bg-[#3a3a3e]', o: 'opacity-70 dark:opacity-55', pos: 'left-[-10%] top-[-20%] h-[70%] w-[55%]', ax: [0, 80, 20, 0], ay: [0, 40, 90, 0], d: 28 },
    { c: 'bg-[#dcdce4] dark:bg-[#2c2c30]', o: 'opacity-80 dark:opacity-70', pos: 'right-[-15%] top-[10%] h-[75%] w-[60%]', ax: [0, -60, -10, 0], ay: [0, 60, -20, 0], d: 34 },
    { c: 'bg-[#e8b73e] dark:bg-[#b8860b]', o: 'opacity-[0.18] dark:opacity-[0.16]', pos: 'right-[10%] bottom-[-25%] h-[55%] w-[45%]', ax: [0, -50, 30, 0], ay: [0, -40, -10, 0], d: 30 },
    { c: 'bg-[#f6f6f9] dark:bg-[#45454b]', o: 'opacity-50 dark:opacity-35', pos: 'left-[25%] bottom-[-30%] h-[50%] w-[45%]', ax: [0, 40, -30, 0], ay: [0, -30, -60, 0], d: 26 },
  ]
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-[#e4e5ec] transition-colors duration-500 dark:bg-black">
      <motion.div className="absolute inset-[-8%]" style={{ x: fx, y: fy }}>
        {veils.map((v, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full blur-[90px] ${v.pos} ${v.c} ${v.o}`}
            animate={reduce ? undefined : { x: v.ax, y: v.ay, scale: [1, 1.1, 0.95, 1] }}
            transition={{ duration: v.d, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </motion.div>
      {/* Lumière douce qui suit la souris */}
      <motion.div
        className="absolute h-[44rem] w-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.5),transparent_60%)] dark:bg-[radial-gradient(circle,rgb(255_255_255/0.07),transparent_60%)]"
        style={{ left: lx, top: ly }}
      />
      {/* Trame fine, très discrète */}
      <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(var(--ma-ink-1)_1px,transparent_1px),linear-gradient(90deg,var(--ma-ink-1)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(70%_60%_at_65%_45%,black,transparent)]" />
      <div className="absolute inset-0 opacity-[0.07] mix-blend-overlay [background-image:url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E&quot;)]" />
    </div>
  )
}

/** Sociétés du groupe. Pas de logo officiel disponible pour Mindset du Royaume : on affiche son sigle. */
const COMPANIES: { name: string; logo?: string }[] = [
  { name: 'Colis na Nga', logo: '/logo-colis-na-nga.png' },
  { name: 'Mindset du Royaume' },
  { name: 'Mindset Alliance', logo: '/logo-mindset-alliance.jpg' },
]

/** Partie vitrine (ordinateur) : capsule en direct, titre, widgets flottants, sociétés. */
export function ShowcaseWidgets({ x, y }: { x: MotionValue<number>; y: MotionValue<number> }) {
  const { t } = useTranslation()
  return (
    <div className="relative hidden min-w-0 flex-col justify-center lg:flex">
      <motion.div
        initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.9, ease: easeIOS, delay: 0.2 }}
      >
        <LiveIsland />
        <h2 className="mt-6 max-w-[34rem] text-balance text-[38px] font-semibold leading-[1.06] tracking-[-0.045em] text-ink xl:text-[46px]">
          {t('loginShowcase.title')}
        </h2>
        <p className="mt-3 max-w-[30rem] text-[15.5px] leading-relaxed text-ink-3 [@media(max-height:820px)]:hidden">{t('loginShowcase.body')}</p>
      </motion.div>

      <div className="mt-10 grid w-full max-w-[600px] grid-cols-[1.05fr_1fr] gap-4 [@media(max-height:760px)]:mt-6 xl:gap-5">
        <Floating depth={22} x={x} y={y} delay={0.4} bob={0} className="row-span-2">
          <RingsWidget />
        </Floating>
        <Floating depth={36} x={x} y={y} delay={0.52} bob={1.4}>
          <NotificationStack />
        </Floating>
        <Floating depth={14} x={x} y={y} delay={0.64} bob={2.6}>
          <SecurityWidget />
        </Floating>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-2 [@media(max-height:760px)]:mt-6">
        <span className="mr-1 text-[12px] text-ink-3">{t('loginShowcase.companies')}</span>
        {COMPANIES.map(({ name, logo }, i) => (
          <motion.span
            key={name}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeIOS, delay: 0.9 + i * 0.08 }}
            className="glass inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-[12.5px] font-medium text-ink"
          >
            {logo ? (
              <img src={logo} alt="" className={`h-6 w-6 object-cover ${logo.includes('colis') ? 'rounded-[7px]' : 'rounded-full'}`} />
            ) : (
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink/[0.08] text-[9px] font-bold text-ink-2 dark:bg-white/[0.12]">MDR</span>
            )}
            {name}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

/** Widget qui flotte : entrée à ressort, léger balancement, parallaxe selon sa profondeur. */
function Floating({
  children,
  depth,
  x,
  y,
  delay,
  bob,
  className,
}: {
  children: ReactNode
  depth: number
  x: MotionValue<number>
  y: MotionValue<number>
  delay: number
  bob: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const tx = useTransform(x, [-1, 1], [-depth, depth])
  const ty = useTransform(y, [-1, 1], [-depth * 0.7, depth * 0.7])
  return (
    <motion.div className={className} style={{ x: tx, y: ty }}>
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.92, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none', transform: 'none' } }}
        transition={{ type: 'spring', stiffness: 120, damping: 18, delay }}
        className="h-full"
      >
        <motion.div
          className="h-full"
          animate={reduce ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: bob }}
        >
          {children}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

/** Widget en verre liquide graphite (matière du système, reflet qui suit la souris). */
function GlassWidget({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`glass relative h-full overflow-hidden rounded-[30px] p-5 text-ink [--spec-size:260px] ${className}`}>{children}</div>
}

/** Anneaux (comme Forme sur iPhone) : les trois piliers de la console. Aucun chiffre : rien d'inventé. */
function RingsWidget() {
  const { t } = useTranslation()
  const rings = [
    { label: t('loginShowcase.pillarTickets'), color: '#e8b73e' },
    { label: t('loginShowcase.pillarFinance'), color: 'var(--ma-ink-1)' },
    { label: t('loginShowcase.pillarTeams'), color: '#30d158' },
  ]
  return (
    <GlassWidget className="flex flex-col">
      <p className="text-[13px] font-semibold text-ink-2">{t('loginShowcase.pillars')}</p>
      <div className="relative mx-auto my-4 aspect-square w-[min(170px,19vh)] shrink-0">
        <svg viewBox="0 0 168 168" className="h-full w-full -rotate-90">
          {rings.map((r, i) => {
            const radius = 72 - i * 20
            const c = 2 * Math.PI * radius
            return (
              <g key={r.label}>
                <circle cx="84" cy="84" r={radius} fill="none" stroke={r.color} strokeOpacity={0.14} strokeWidth="15" />
                <motion.circle
                  cx="84"
                  cy="84"
                  r={radius}
                  fill="none"
                  stroke={r.color}
                  strokeWidth="15"
                  strokeLinecap="round"
                  strokeDasharray={c}
                  initial={{ strokeDashoffset: c }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 1.8, ease: easeIOS, delay: 0.8 + i * 0.18 }}
                />
              </g>
            )
          })}
        </svg>
      </div>
      <div className="mt-auto space-y-2">
        {rings.map((r) => (
          <div key={r.label} className="flex items-center gap-2 text-[12.5px] text-ink-2">
            <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
            {r.label}
          </div>
        ))}
      </div>
    </GlassWidget>
  )
}

/** Pile de notifications iOS : une nouvelle arrive en haut toutes les quelques secondes. */
function NotificationStack() {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const pool = [
    { app: 'Colis na Nga', icon: <img src="/logo-colis-na-nga.png" alt="" className="h-9 w-9" />, tint: '', text: t('loginShowcase.feature1') },
    { app: t('loginShowcase.appFinance'), icon: <Banknote />, tint: 'from-[#3ad66b] to-[#1fa84c]', text: t('loginShowcase.feature2') },
    { app: t('loginShowcase.appSupport'), icon: <TicketCheck />, tint: 'from-[#8e8e93] to-[#636366]', text: t('loginShowcase.feature3') },
    { app: t('loginShowcase.appTeams'), icon: <UserPlus />, tint: 'from-[#5e9cff] to-[#2f6fe0]', text: t('loginShowcase.feature4') },
  ]
  const [head, setHead] = useState(0)
  useEffect(() => {
    if (reduce) return
    const id = window.setInterval(() => setHead((h) => h + 1), 3200)
    return () => window.clearInterval(id)
  }, [reduce])
  const visible = [0, 1, 2].map((k) => ({ ...pool[(head + pool.length * 10 - k) % pool.length], key: head - k }))

  return (
    <div className="relative h-[118px]">
      <AnimatePresence initial={false}>
        {visible.map((n, i) => (
          <motion.div
            key={n.key}
            initial={{ opacity: 0, y: -40, scale: 0.9, filter: 'blur(6px)' }}
            animate={{ opacity: i === 2 ? 0.55 : 1, y: i * 12, scale: 1 - i * 0.06, filter: 'blur(0px)', zIndex: 10 - i }}
            exit={{ opacity: 0, y: 40, scale: 0.8, transition: { duration: 0.3 } }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="absolute inset-x-0 top-0 origin-top"
          >
            <div className={`flex items-start gap-3 rounded-[24px] p-3.5 shadow-[0_18px_40px_-14px_rgb(20_20_40/0.28),0_0_0_0.5px_rgb(0_0_0/0.09)] dark:shadow-[0_16px_40px_-16px_rgb(0_0_0/0.8),inset_0_1px_0_rgb(255_255_255/0.14),inset_0_0_0_0.5px_rgb(255_255_255/0.12)] backdrop-blur-2xl backdrop-saturate-150 ${i === 0 ? 'bg-white/95 dark:bg-[#2c2c2e]/80' : 'bg-[#f7f7fa] dark:bg-[#232325]/95'}`}>
              <div className={`flex min-w-0 flex-1 items-start gap-3 transition-opacity duration-300 ${i === 0 ? 'opacity-100' : 'opacity-0'}`}>
                <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-gradient-to-b text-white [&_svg]:h-[18px] [&_svg]:w-[18px] ${n.tint}`}>{n.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12.5px] font-semibold text-ink">{n.app}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-2">{n.text}</p>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/** Sécurité de la console : ce qui protège chaque connexion (aucun chiffre inventé). */
function SecurityWidget() {
  const { t } = useTranslation()
  const items = [t('loginShowcase.secure1'), t('loginShowcase.secure2'), t('loginShowcase.secure3')]
  return (
    <GlassWidget>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-ink-2">{t('loginShowcase.security')}</p>
        <ShieldCheck className="h-4 w-4 text-status-success" />
      </div>
      <ul className="mt-3 space-y-2.5">
        {items.map((item, i) => (
          <motion.li
            key={item}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: easeIOS, delay: 1 + i * 0.15 }}
            className="flex items-center gap-2.5 text-[13px] text-ink"
          >
            <BadgeCheck className="h-4 w-4 shrink-0 text-status-success" />
            {item}
          </motion.li>
        ))}
      </ul>
    </GlassWidget>
  )
}

/** Capsule noire qui s'étire pour annoncer l'état du système, comme la Dynamic Island. */
function LiveIsland() {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const [wide, setWide] = useState(false)
  useEffect(() => {
    if (reduce) {
      setWide(true)
      return
    }
    const first = window.setTimeout(() => setWide(true), 900)
    const id = window.setInterval(() => setWide((v) => !v), 4200)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [reduce])
  return (
    <motion.div
      layout
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="inline-flex h-9 items-center gap-2.5 overflow-hidden rounded-full bg-black px-3.5 shadow-[0_10px_30px_-8px_rgb(0_0_0/0.9)] ring-[0.5px] ring-white/15"
      style={{ minWidth: 120 }}
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#30d158]/70" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#30d158]" />
      </span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={wide ? 'wide' : 'short'}
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(4px)' }}
          transition={{ duration: 0.25 }}
          className="whitespace-nowrap text-[12.5px] font-medium text-white"
        >
          {wide ? t('loginShowcase.islandWide') : t('loginShowcase.islandShort')}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  )
}
