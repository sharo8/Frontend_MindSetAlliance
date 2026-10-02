import { cn } from '../../lib/utils'
import type { InputHTMLAttributes } from 'react'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-ma-navy-950 placeholder:text-slate-400 transition focus:border-ma-gold-500 focus:shadow-[0_0_0_3px_rgba(224,167,33,0.18)] dark:border-ma-navy-700 dark:bg-ma-navy-900 dark:text-ma-white dark:placeholder:text-ma-gray-300/70',
        className,
      )}
      {...props}
    />
  )
}
