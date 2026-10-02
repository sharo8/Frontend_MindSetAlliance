import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type Props = {
  kicker: string
  title: string
  subtitle?: string
  children: ReactNode
  footer?: string
  wide?: boolean
}

export function AuthShell({ kicker, title, subtitle, children, footer, wide }: Props) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 55% at 50% 8%, #1e2d72 0%, #16215c 22%, #0a1332 52%, #050b1f 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ background: 'radial-gradient(circle at 50% 16%, rgba(246,208,106,0.14) 0%, transparent 44%)' }}
      />
      <div className={cn('relative w-full', wide ? 'max-w-[28rem]' : 'max-w-[26rem]')}>
        <div className="ma-auth-rise rounded-2xl bg-gradient-to-b from-ma-gold-400/60 via-ma-gold-600/20 to-transparent p-px shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_0_1px_rgba(246,208,106,0.08)]">
          <div className="rounded-2xl bg-ma-navy-800 px-5 pb-8 pt-0 sm:px-8">
            <div className="flex flex-col items-center">
              <img
                src="/logo-mindset-alliance.jpg"
                alt="Mindset Alliance"
                className="-mt-10 h-[4.5rem] w-[4.5rem] rounded-full object-cover shadow-[0_12px_32px_rgba(0,0,0,0.45)] ring-2 ring-ma-gold-400/70 sm:-mt-12 sm:h-24 sm:w-24"
              />
              <p className="mt-4 font-display text-[10px] tracking-[0.38em] text-ma-gold-400 sm:text-[11px]">{kicker}</p>
              <h1 className="mt-1.5 text-center font-display text-[1.55rem] font-semibold uppercase tracking-[0.14em] text-ma-white sm:text-[1.8rem]">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 max-w-[20rem] text-center text-xs leading-relaxed text-ma-gray-300 sm:text-sm">{subtitle}</p>
              )}
            </div>
            <div className="mt-7">{children}</div>
          </div>
        </div>
        {footer && <p className="mt-6 text-center text-[11px] tracking-wide text-ma-gray-300/80">{footer}</p>}
      </div>
    </div>
  )
}
