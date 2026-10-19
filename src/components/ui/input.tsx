import { cn } from '../../lib/utils'
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

/** Champ « creusé » dans l'argile, anneau doré à la saisie. */
export const fieldClass =
  'clay-field w-full rounded-[13px] border-0 px-3.5 text-sm text-ink placeholder:text-ink-3/80 outline-none transition-[box-shadow,background-color] duration-200 ease-[var(--ease-ma)] focus:bg-surface focus:[box-shadow:var(--ring-focus)] disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:[box-shadow:0_0_0_1.5px_rgb(220_38_38/0.8),0_0_0_4px_rgb(220_38_38/0.15)]'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(fieldClass, 'h-10 py-2', className)} {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={cn(fieldClass, 'min-h-[96px] resize-y py-2.5 leading-relaxed', className)} {...props} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        fieldClass,
        'h-10 cursor-pointer appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237a849f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    />
  )
})

/** Libellé de champ cohérent partout. */
export function FieldLabel({ children, hint, className }: { children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <span className={cn('mb-1.5 flex items-baseline justify-between gap-2 text-[12.5px] font-medium text-ink-2', className)}>
      <span>{children}</span>
      {hint && <span className="text-[11.5px] font-normal text-ink-3">{hint}</span>}
    </span>
  )
}
