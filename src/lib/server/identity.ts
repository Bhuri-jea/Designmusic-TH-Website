export type IdentityToken = { googleSubject?: string; supabaseSubject?: string; [key: string]: unknown };

export function captureGoogleSubject<T extends IdentityToken>(token: T, account?: { provider?: string; providerAccountId?: string } | null, user?: unknown): T {
  if (account?.provider === 'google' && typeof account.providerAccountId === 'string' && account.providerAccountId.trim()) {
    return { ...token, googleSubject: account.providerAccountId, supabaseSubject: undefined };
  }
  if (account?.provider === 'credentials') {
    const id = (user as { id?: unknown } | undefined)?.id;
    return { ...token, googleSubject: undefined, supabaseSubject: typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : undefined };
  }
  return token;
}

export function subjectFromToken(token: IdentityToken): string | undefined {
  if (typeof token.googleSubject === 'string' && token.googleSubject.trim()) return token.googleSubject;
  return typeof token.supabaseSubject === 'string' && token.supabaseSubject.trim() ? `supabase:${token.supabaseSubject}` : undefined;
}
