export function getEnv(name: string): string | undefined {
  const astroEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.[name];
  const nodeEnv = typeof process === 'undefined' ? undefined : process.env[name];
  const value = astroEnv ?? nodeEnv;
  return value?.trim() || undefined;
}
