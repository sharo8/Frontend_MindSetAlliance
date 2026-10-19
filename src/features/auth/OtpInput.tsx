import { useEffect, useRef } from 'react'
import { motion, useAnimationControls } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils'

type Props = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** Secoue légèrement les cases quand le code est refusé. */
  invalid?: boolean
}

/** Six cases creusées dans l'argile ; la case active s'illumine en or, collage du code complet accepté. */
export function OtpInput({ value, onChange, disabled, invalid }: Props) {
  const { t } = useTranslation()
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '')
  const controls = useAnimationControls()

  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (invalid) void controls.start({ x: [0, -8, 7, -5, 3, 0], transition: { duration: 0.42 } })
  }, [invalid, controls])

  return (
    <motion.div animate={controls} className="grid grid-cols-6 gap-2 sm:gap-2.5" role="group" aria-label={t('login.otpGroup')}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el
          }}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={digit}
          aria-label={t('login.otpDigit', { n: index + 1 })}
          aria-invalid={invalid || undefined}
          className={cn(
            'clay-field aspect-[5/6] w-full min-w-0 rounded-[14px] border-0 text-center text-[22px] font-semibold tabular-nums text-ink outline-none transition-[box-shadow,background-color,transform] duration-200 ease-[var(--ease-ma)]',
            'focus:scale-[1.04] focus:bg-surface focus:[box-shadow:var(--ring-focus)] disabled:opacity-60',
            digit && 'bg-surface',
            invalid && 'text-status-danger',
          )}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, '').slice(-1)
            const chars = digits.slice()
            chars[index] = next
            onChange(chars.join(''))
            if (next) refs.current[index + 1]?.focus()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !digits[index] && index > 0) refs.current[index - 1]?.focus()
            if (event.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus()
            if (event.key === 'ArrowRight' && index < 5) refs.current[index + 1]?.focus()
          }}
          onPaste={(event) => {
            event.preventDefault()
            const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
            onChange(pasted)
            refs.current[Math.min(pasted.length, 5)]?.focus()
          }}
        />
      ))}
    </motion.div>
  )
}
