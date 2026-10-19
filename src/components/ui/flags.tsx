import { useId } from 'react'
import { cn } from '../../lib/utils'

export type CurrencyCode = 'USD' | 'CDF'

/** Pays de chaque devise : États-Unis (dollar), RD Congo (franc congolais). */
const COUNTRY: Record<CurrencyCode, string> = { USD: 'États-Unis', CDF: 'République démocratique du Congo' }

/** Drapeau du pays d'une devise, dessiné en SVG (net à toutes les tailles, identique sur tous les systèmes). */
export function CurrencyFlag({ code, className, title }: { code: CurrencyCode; className?: string; title?: string }) {
  const clip = useId().replace(/:/g, '')
  return (
    <svg
      viewBox="0 0 30 20"
      role="img"
      aria-label={title ?? COUNTRY[code]}
      className={cn('inline-block h-[14px] w-[21px] shrink-0 rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]', className)}
    >
      <title>{title ?? COUNTRY[code]}</title>
      <defs>
        <clipPath id={clip}>
          <rect width="30" height="20" rx="2.5" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        {code === 'USD' && (
          <>
            <rect width="30" height="20" fill="#fff" />
            {[0, 2, 4, 6, 8, 10, 12].map((i) => (
              <rect key={i} y={(i * 20) / 13} width="30" height={20 / 13} fill="#B22234" />
            ))}
            <rect width="12" height={(20 / 13) * 7} fill="#3C3B6E" />
            {[0, 1, 2, 3].map((r) =>
              [0, 1, 2, 3, 4].map((c) => <circle key={`${r}-${c}`} cx={1.4 + c * 2.3 + (r % 2) * 1.15} cy={1.5 + r * 2.3} r="0.45" fill="#fff" />),
            )}
          </>
        )}
        {code === 'CDF' && (
          <>
            <rect width="30" height="20" fill="#007FFF" />
            <polygon points="0,20 0,15.2 23.6,0 30,0 30,4.8 6.4,20" fill="#F7D618" />
            <polygon points="0,20 0,17.6 27.2,0 30,0 30,2.4 2.8,20" fill="#CE1021" />
            <polygon
              points="5,1.6 5.8,3.9 8.2,3.9 6.3,5.3 7,7.6 5,6.2 3,7.6 3.7,5.3 1.8,3.9 4.2,3.9"
              fill="#F7D618"
            />
          </>
        )}
      </g>
    </svg>
  )
}
