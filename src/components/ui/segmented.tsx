import { useId, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { cn } from '../../lib/utils'
import { spring } from '../motion/springs'

/** Sélecteur segmenté façon iOS : la pastille glisse avec un ressort vers l'option choisie. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  ariaLabel,
}: {
  options: { value: T; label: ReactNode; icon?: ReactNode }[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
  ariaLabel?: string
}) {
  const id = useId()
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-[rgb(118_118_128/0.12)] p-[3px] [scrollbar-width:none] dark:bg-[rgb(118_118_128/0.24)]',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'press relative z-0 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-semibold tracking-[-0.01em] transition-colors duration-200',
              size === 'sm' ? 'h-7 px-3 text-[12.5px]' : 'h-8 px-3.5 text-[13.5px]',
              active ? 'text-ink' : 'text-ink-2 hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={spring.liquid}
                className="absolute inset-0 -z-10 rounded-full bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/0.04),0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)] dark:bg-[#636366] dark:shadow-[0_3px_8px_rgb(0_0_0/0.3)]"
              />
            )}
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
