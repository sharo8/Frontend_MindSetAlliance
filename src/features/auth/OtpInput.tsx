import { useEffect, useRef } from 'react'
import { cn } from '../../lib/utils'

type Props = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function OtpInput({ value, onChange, disabled }: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '')

  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  return (
    <div className="flex justify-center gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el
          }}
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={digit}
          aria-label={`Chiffre ${index + 1} du code`}
          className={cn(
            'h-12 w-11 rounded-xl border border-ma-gold-400/35 bg-ma-navy-950 text-center text-lg font-semibold tracking-[0.12em] text-ma-white shadow-[inset_0_0_0_1px_rgba(246,208,106,0.08)] focus:border-ma-gold-400 focus:ring-2 focus:ring-ma-gold-400/40',
          )}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, '').slice(-1)
            const chars = digits.slice()
            chars[index] = next
            onChange(chars.join(''))
            if (next) refs.current[index + 1]?.focus()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !digits[index] && index > 0) {
              refs.current[index - 1]?.focus()
            }
          }}
          onPaste={(event) => {
            event.preventDefault()
            const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
            onChange(pasted)
            refs.current[Math.min(pasted.length, 5)]?.focus()
          }}
        />
      ))}
    </div>
  )
}
