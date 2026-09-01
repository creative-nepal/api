export const SUPPORTED_LANGUAGES = ['en', 'ne'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const FALLBACK_LANGUAGE: SupportedLanguage = 'en';

export const LANGUAGE_HEADER = 'x-language';
export const LANGUAGE_QUERY = 'lang';

export function isSupportedLanguage(
  value: string | undefined,
): value is SupportedLanguage {
  return (
    value !== undefined &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  );
}

export const I18N_PREFIX = 'i18n:';
