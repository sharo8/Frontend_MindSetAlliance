import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { UI_LANGS, type AppLanguage } from '../../lib/i18n/i18n'
import { LanguageFlag } from '../ui/brand-marks'
import { MenuItem, MenuLabel } from './HeaderMenu'

export function LanguagePanel({ onSelect }: { onSelect: (lng: AppLanguage) => void }) {
  const { t, i18n } = useTranslation()
  const current: AppLanguage = i18n.language?.startsWith('en') ? 'en' : 'fr'
  return (
    <>
      <MenuLabel>{t('topbar.language')}</MenuLabel>
      {UI_LANGS.map((code) => {
        const selected = code === current
        return (
          <MenuItem key={code} active={selected} onClick={() => onSelect(code)}>
            <LanguageFlag lang={code} className="h-8 w-8" />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-ink">{t(`language.${code}`)}</span>
              <span className="block text-[12px] text-ink-3">{t(`language.${code}Hint`)}</span>
            </span>
            {selected && <Check size={17} strokeWidth={2.4} className="text-accent-ink" />}
          </MenuItem>
        )
      })}
    </>
  )
}
