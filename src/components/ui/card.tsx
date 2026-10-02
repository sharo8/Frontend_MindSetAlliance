import { cn } from '../../lib/utils'
import type { HTMLAttributes } from 'react'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-ma)] border border-ma-line bg-white text-ma-navy-950 shadow-[var(--shadow-ma-sm)]',
        'transition-[box-shadow,transform,border-color] duration-[var(--duration-ma)] ease-[var(--ease-ma)]',
        'hover:-translate-y-px hover:border-ma-navy-800/20 hover:shadow-[var(--shadow-ma-md)]',
        'dark:border-white/10 dark:bg-ma-navy-800/85 dark:text-ma-white dark:shadow-[0_16px_40px_rgba(0,0,0,0.28)]',
        'dark:hover:border-ma-gold-500/25',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-ma-line/80 px-4 py-3 sm:px-5 sm:py-4 dark:border-white/10', className)} {...props} />
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-3 sm:px-5 sm:py-4', className)} {...props} />
}
