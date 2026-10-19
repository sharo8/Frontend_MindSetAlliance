import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Segmented } from '../ui/segmented'
import { useGlassStore } from '../../lib/theme/liquid'
import { useThemeStore } from '../../lib/theme/theme-store'

/**
 * Réglages d'apparence (comme Réglages > Luminosité d'iOS 27) :
 * thème clair / sombre et niveau du verre liquide, de transparent à teinté.
 */
export function AppearancePanel() {
  const { t } = useTranslation()
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const level = useGlassStore((s) => s.level)
  const setLevel = useGlassStore((s) => s.setLevel)
  const pct = Math.round(level * 100)

  return (
    <div className="space-y-3 px-3 pb-2 pt-1">
      <Segmented
        size="sm"
        className="w-full [&>button]:flex-1 [&>button]:justify-center"
        ariaLabel={t('appearance.theme')}
        value={theme}
        onChange={setTheme}
        options={[
          { value: 'light', label: t('appearance.light'), icon: <Sun className="h-3.5 w-3.5" /> },
          { value: 'dark', label: t('appearance.dark'), icon: <Moon className="h-3.5 w-3.5" /> },
        ]}
      />
      <div>
        <div className="mb-2 flex items-center justify-between text-[12.5px]">
          <span className="font-semibold text-ink-2">{t('appearance.glass')}</span>
          <span className="tabular-nums text-ink-3">{pct} %</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => setLevel(Number(e.target.value) / 100)}
          aria-label={t('appearance.glass')}
          className="ma-range w-full"
          style={{ ['--val' as string]: `${pct}%` }}
        />
        <div className="mt-1.5 flex justify-between text-[11.5px] text-ink-3">
          <span>{t('appearance.clear')}</span>
          <span>{t('appearance.tinted')}</span>
        </div>
      </div>
    </div>
  )
}
