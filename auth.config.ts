import Google from '@auth/core/providers/google';
import Credentials from '@auth/core/providers/credentials';
import { defineConfig } from 'auth-astro';
import { getEnv } from './src/lib/server/env.ts';
import { captureGoogleSubject } from './src/lib/server/identity.ts';
import { authenticateEmail } from './src/lib/server/email-auth.ts';

export default defineConfig({
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  providers: [
    Google({ clientId: getEnv('GOOGLE_CLIENT_ID') ?? '', clientSecret: getEnv('GOOGLE_CLIENT_SECRET') ?? '' }),
    Credentials({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        return authenticateEmail(credentials ?? {});
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, account, user }) => {
      const nextToken = captureGoogleSubject(token, account, user);
      if (user?.email && typeof user.email === 'string') {
        nextToken.email = user.email;
      }
      return nextToken;
    },
    session: ({ session, token }) => ({
      ...session,
      googleSubject: typeof token.googleSubject === 'string' ? token.googleSubject : undefined,
      supabaseSubject: typeof token.supabaseSubject === 'string' ? token.supabaseSubject : undefined,
      user: {
        ...session.user,
        email: session.user?.email ?? (typeof token.email === 'string' ? token.email : undefined),
        name: session.user?.name ?? (typeof token.name === 'string' ? token.name : undefined),
        image: session.user?.image ?? (typeof token.picture === 'string' ? token.picture : undefined),
      },
    }),
  },
});
