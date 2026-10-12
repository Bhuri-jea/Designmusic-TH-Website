export type IdentityToken = { googleSubject?: string; [key: string]: unknown };

export function captureGoogleSubject<T extends IdentityToken>(token: T, account?: { provider?: string; providerAccountId?: string } | null, _user?: unknown): T {
  if (account?.provider === 'google' && typeof account.providerAccountId === 'string' && account.providerAccountId.trim()) {
    return { ...token, googleSubject: account.providerAccountId };
  }
  return token;
}

export function subjectFromToken(token: IdentityToken): string | undefined {
  return typeof token.googleSubject === 'string' && token.googleSubject.trim() ? token.googleSubject : undefined;
}
