import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { AlertCircle, Check } from 'lucide-react'
import { IconTile, type IconTone } from '../../components/ui/card'
import { spring } from '../../components/motion/springs'
import { cn } from '../../lib/utils'

/** Interrupteur iOS 27 : piste verte, la pastille s'étire sous le doigt puis glisse avec un ressort. */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
  size = 'md',
  className,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const track = size === 'sm' ? 'h-[24px] w-[42px]' : 'h-[31px] w-[51px]'
  const knob = size === 'sm' ? 'h-[20px]' : 'h-[27px]'
  const base = size === 'sm' ? 20 : 27
  const [pressed, setPressed] = useState(false)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full p-[2px] transition-[background-color,box-shadow,opacity] duration-300 ease-[var(--ease-ma)] focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)] disabled:cursor-not-allowed',
        track,
        checked && !disabled && 'justify-end bg-[#34c759] dark:bg-[#30d158]',
        checked && disabled && 'justify-end bg-[#34c759]/45 dark:bg-[#30d158]/35',
        !checked && 'justify-start bg-[rgb(120_120_128/0.16)] dark:bg-[rgb(120_120_128/0.32)]',
        !checked && disabled && 'opacity-55',
        className,
      )}
    >
      <motion.span
        layout
        transition={spring.liquid}
        animate={{ width: pressed && !disabled ? base + 7 : base }}
        className={cn('block rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_3px_1px_rgb(0_0_0/0.06),0_0_0_0.5px_rgb(0_0_0/0.04)]', knob)}
      />
    </button>
  )
}

/** Case à cocher : creusée vide, or Mindset une fois cochée. */
export function CheckBox({
  checked,
  onChange,
  disabled,
  label,
  className,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label: string
  className?: string
}) {
  return (
    <span className={cn('relative inline-flex h-[20px] w-[20px] shrink-0', className)}>
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          'peer h-full w-full cursor-pointer appearance-none rounded-[7px] transition-[background,box-shadow] duration-200 ease-[var(--ease-ma)] focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)] disabled:cursor-not-allowed disabled:opacity-50',
          checked
            ? 'clay-gold'
            : 'clay-field',
        )}
      />
      <motion.span
        aria-hidden
        initial={false}
        animate={{ scale: checked ? 1 : 0.4, opacity: checked ? 1 : 0 }}
        transition={spring.snappy}
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-ma-navy-950"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </motion.span>
    </span>
  )
}

/** Bloc de formulaire : pastille d'icône, titre, aide, contenu. */
export function FormSection({
  icon,
  tone = 'navy',
  title,
  hint,
  action,
  children,
  className,
}: {
  icon: ReactNode
  tone?: IconTone
  title: ReactNode
  hint?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('border-b border-hairline py-5 first:pt-1 last:border-b-0 last:pb-1', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile tone={tone} size="sm" className="mt-px">
            {icon}
          </IconTile>
          <div className="min-w-0">
            <h3 className="text-[14.5px] font-semibold tracking-[-0.015em] text-ink">{title}</h3>
            {hint && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{hint}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  )
}

/** Message d'erreur sous un champ. */
export function FieldError({ children }: { children: ReactNode }) {
  return (
    <p className="ma-fact-in mt-1.5 flex items-center gap-1.5 text-[12px] font-medium text-status-danger">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
      {children}
    </p>
  )
}

/** Aide discrète sous un champ. */
export function FieldHint({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-snug text-ink-3 [&_svg]:mt-px [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0">
      {icon}
      <span>{children}</span>
    </p>
  )
}

/** Vignette d'information dans une fenêtre (note, rappel). */
export function InfoNote({ icon, children, tone = 'neutral' }: { icon: ReactNode; children: ReactNode; tone?: 'neutral' | 'gold' }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-[14px] px-3.5 py-3 text-[12.5px] leading-relaxed ring-1 ring-inset [&>svg]:mt-0.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0',
        tone === 'gold'
          ? 'bg-ma-gold-500/[0.08] text-ink-2 ring-ma-gold-500/20 [&>svg]:text-accent-ink'
          : 'bg-ink/[0.03] text-ink-2 ring-hairline dark:bg-white/[0.03] [&>svg]:text-ink-3',
      )}
    >
      {icon}
      <div className="min-w-0">{children}</div>
    </div>
  )
}
