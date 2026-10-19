import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../../locales/en.json'
import fr from '../../locales/fr.json'
import ln from '../../locales/ln.json'
import sw from '../../locales/sw.json'

export const LANGUAGE_KEY = 'ma-language-preference'
export const SUPPORTED_LANGS = ['fr', 'en', 'ln', 'sw'] as const
export type AppLanguage = (typeof SUPPORTED_LANGS)[number]
/** Langues proposées dans l'interface. */
export const UI_LANGS = ['fr', 'en'] as const

function initialLanguage(): AppLanguage {
  if (typeof window === 'undefined') return 'fr'
  const stored = window.localStorage.getItem(LANGUAGE_KEY)
  if (stored && (UI_LANGS as readonly string[]).includes(stored)) return stored as AppLanguage
  return 'fr'
}

void i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    ln: { translation: ln },
    sw: { translation: sw },
  },
  lng: initialLanguage(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LANGUAGE_KEY, lng)
  document.documentElement.lang = lng
})

if (typeof document !== 'undefined') {
  document.documentElement.lang = i18n.language
}

export default i18n
