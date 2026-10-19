import { cn } from '../../lib/utils'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'gold' | 'navy' | 'outline' | 'ghost' | 'danger' | 'soft'
type Size = 'sm' | 'md' | 'lg' | 'icon'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  // Action principale : argile dorée, reflet balayé au survol
  gold: 'btn-shine clay-gold text-ma-navy-950 hover:brightness-[1.04] hover:saturate-[1.06]',
  // Action forte secondaire : argile bleu nuit
  navy: 'clay-navy text-white hover:brightness-110',
  // Action secondaire : verre clair, contour fin
  outline:
    'glass-strong text-ink hover:bg-white dark:hover:bg-white/10 [--glass-shadow:0_1px_2px_rgb(17_27_63/0.05),0_6px_16px_-8px_rgb(17_27_63/0.18)]',
  ghost: 'bg-transparent text-ink-2 hover:bg-ink/[0.05] hover:text-ink dark:hover:bg-white/[0.07]',
  soft: 'bg-ma-gold-500/12 text-accent-ink hover:bg-ma-gold-500/18 dark:bg-ma-gold-400/12',
  danger:
    'bg-gradient-to-b from-[#ef4444] to-[#c81e1e] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_10px_22px_-10px_rgb(220_38_38/0.7)] hover:brightness-110',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 rounded-[10px] px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-[13px] px-4 text-sm',
  lg: 'h-12 gap-2.5 rounded-[15px] px-5 text-[15px]',
  icon: 'h-10 w-10 rounded-[13px] p-0',
}

export function Button({ className, variant = 'gold', size = 'md', type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={cn(
        'press inline-flex select-none items-center justify-center whitespace-nowrap font-semibold tracking-[-0.01em]',
        'focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]',
        'disabled:pointer-events-none disabled:opacity-45 disabled:saturate-50',
        sizes[size],
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
