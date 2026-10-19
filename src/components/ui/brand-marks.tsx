import { useId } from 'react'
import { cn } from '../../lib/utils'

/** Drapeau de la France, rond. */
export function FlagFR({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 24 24" className={cn('h-[18px] w-[18px] shrink-0 rounded-full shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)]', className)} aria-hidden>
      <clipPath id={id}>
        <circle cx="12" cy="12" r="12" />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <rect width="8" height="24" fill="#0055A4" />
        <rect x="8" width="8" height="24" fill="#FFFFFF" />
        <rect x="16" width="8" height="24" fill="#EF4135" />
      </g>
    </svg>
  )
}

/** Drapeau du Royaume-Uni, rond. */
export function FlagGB({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 60 60" className={cn('h-[18px] w-[18px] shrink-0 rounded-full shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)]', className)} aria-hidden>
      <clipPath id={id}>
        <circle cx="30" cy="30" r="30" />
      </clipPath>
      <g clipPath={`url(#${id})`}>
        <rect width="60" height="60" fill="#012169" />
        <path d="M0 0L60 60M60 0L0 60" stroke="#FFFFFF" strokeWidth="12" />
        <path d="M0 0L60 60M60 0L0 60" stroke="#C8102E" strokeWidth="4" />
        <path d="M30 0V60M0 30H60" stroke="#FFFFFF" strokeWidth="18" />
        <path d="M30 0V60M0 30H60" stroke="#C8102E" strokeWidth="10" />
      </g>
    </svg>
  )
}

/** Drapeau de la langue d'interface (français par défaut). */
export function LanguageFlag({ lang, className }: { lang: string; className?: string }) {
  return lang?.startsWith('en') ? <FlagGB className={className} /> : <FlagFR className={className} />
}

/** Logos officiels disponibles. Mindset du Royaume n'a pas encore de logo fourni : on affiche son sigle. */
const PROJECT_LOGOS: Record<string, { src: string; shape: 'round' | 'app' }> = {
  MA: { src: '/logo-mindset-alliance.jpg', shape: 'round' },
  ENTREPRISE: { src: '/logo-mindset-alliance.jpg', shape: 'round' },
  CNN: { src: '/logo-colis-na-nga.png', shape: 'app' },
}

/** Sociétés qui ne font pas partie du groupe Mindset Alliance : jamais proposées dans le sélecteur. */
export const EXCLUDED_PROJECTS = ['SSS']

/** Logo d'un projet (ou son sigle si aucun logo officiel n'existe). */
export function ProjectLogo({ code, size = 'sm' }: { code: string; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-6 w-6' : 'h-9 w-9'
  const logo = PROJECT_LOGOS[code]
  if (logo) {
    return (
      <img
        src={logo.src}
        alt=""
        aria-hidden
        className={cn(
          box,
          'shrink-0 object-cover shadow-[0_0_0_0.5px_rgb(0_0_0/0.1)]',
          logo.shape === 'round' ? 'rounded-full' : size === 'sm' ? 'rounded-[7px]' : 'rounded-[10px]',
        )}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        box,
        'inline-flex shrink-0 items-center justify-center rounded-full bg-ink/[0.08] font-bold tracking-wide text-ink-2 dark:bg-white/[0.12]',
        size === 'sm' ? 'text-[8px]' : 'text-[10px]',
      )}
    >
      {code.slice(0, 3)}
    </span>
  )
}
