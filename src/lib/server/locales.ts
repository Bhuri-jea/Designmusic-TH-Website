export const supportedLocales = ['en', 'ja', 'zh-CN', 'th'] as const;
export type SupportedLocale = typeof supportedLocales[number];
export function isSupportedLocale(value: string | undefined): value is SupportedLocale {
  return supportedLocales.includes(value as SupportedLocale);
}
