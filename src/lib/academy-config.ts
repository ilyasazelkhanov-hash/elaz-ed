export type AcademyLocale = 'ru' | 'kk' | 'en'

/** Translations stay available for a future multilingual Academy release. */
export const academyMultilingualEnabled = import.meta.env?.VITE_ACADEMY_MULTILINGUAL === 'true'

const russianLocales = ['ru'] as const
const multilingualLocales = ['ru', 'kk', 'en'] as const

export function supportedAcademyLocales(): readonly AcademyLocale[] {
  return academyMultilingualEnabled ? multilingualLocales : russianLocales
}
