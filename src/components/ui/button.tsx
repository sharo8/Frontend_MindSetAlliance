import { cn } from '../../lib/utils'
import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'gold' | 'ghost' | 'navy' | 'outline'
}

export function Button({ className, variant = 'gold', type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[12px] px-4 py-2.5 text-sm font-semibold transition duration-200 ease-[var(--ease-ma)]',
        'hover:-translate-y-px active:translate-y-0 active:scale-[0.98]',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:active:scale-100',
        variant === 'gold' &&
          'btn-shine bg-ma-gold-400 text-ma-navy-950 shadow-[0_8px_20px_rgb(246_208_106/0.28)] hover:bg-ma-gold-300 hover:shadow-[0_12px_24px_rgb(246_208_106/0.4)]',
        variant === 'ghost' && 'text-ma-gray-300 hover:text-ma-gold-400',
        variant === 'navy' && 'bg-ma-navy-700 text-ma-white hover:bg-ma-navy-800',
        variant === 'outline' &&
          'border border-ma-gold-600/45 bg-white/70 text-ma-navy-800 hover:bg-white dark:border-ma-gold-500/40 dark:bg-transparent dark:text-ma-gold-400 dark:hover:bg-ma-navy-700/70',
        className,
      )}
      {...props}
    />
  )
}
