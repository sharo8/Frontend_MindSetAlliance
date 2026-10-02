import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGS, type AppLanguage } from '../../lib/i18n/i18n'
import { cn } from '../../lib/utils'

const FLAGS: Record<AppLanguage, string> = {
  fr: '🇫🇷',
  en: '🇬🇧',
  ln: '🇨🇩',
  sw: '🇹🇿',
}

export function LanguagePanel({
  onSelect,
}: {
  onSelect: (lng: AppLanguage) => void
}) {
  const { t, i18n } = useTranslation()
  const current = (SUPPORTED_LANGS.includes(i18n.language as AppLanguage) ? i18n.language : 'fr') as AppLanguage
  return (
    <>
      {SUPPORTED_LANGS.map((code) => {
        const selected = code === current
        return (
          <button
            key={code}
            type="button"
            role="menuitem"
            className={cn(
              'flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-ma-navy-700',
              selected && 'bg-ma-navy-700/80',
            )}
            onClick={() => onSelect(code)}
          >
            <span className="text-xl leading-none">{FLAGS[code]}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ma-white">{t(`language.${code}`)}</span>
              <span className="block text-xs text-ma-gray-300">{t(`language.${code}Hint`)}</span>
            </span>
            {selected && <Check size={16} className="text-ma-gold-400" />}
          </button>
        )
      })}
    </>
  )
}
