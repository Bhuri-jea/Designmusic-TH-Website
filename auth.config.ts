import Google from '@auth/core/providers/google';
import Credentials from '@auth/core/providers/credentials';
import { defineConfig } from 'auth-astro';
import { getEnv } from './src/lib/server/env.ts';
import { captureGoogleSubject } from './src/lib/server/identity.ts';

const emailLoginEmail = getEnv('EMAIL_LOGIN_EMAIL')?.trim().toLowerCase();
const emailLoginPassword = getEnv('EMAIL_LOGIN_PASSWORD');
const emailLoginName = getEnv('EMAIL_LOGIN_NAME')?.trim() || 'Design Music Customer';

export default defineConfig({
  providers: [
    Google({ clientId: getEnv('GOOGLE_CLIENT_ID') ?? '', clientSecret: getEnv('GOOGLE_CLIENT_SECRET') ?? '' }),
    Credentials({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!emailLoginEmail || !emailLoginPassword) return null;
        const submittedEmail = String(credentials?.email ?? '').trim().toLowerCase();
        const submittedPassword = String(credentials?.password ?? '');

        if (submittedEmail === emailLoginEmail && submittedPassword === emailLoginPassword) {
          return {
            id: 'email-user',
            name: emailLoginName,
            email: emailLoginEmail,
            image: null,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, account, user }) => {
      const nextToken = captureGoogleSubject(token, account, user);
      if (user?.email && typeof user.email === 'string' && !nextToken.email) {
        nextToken.email = user.email;
      }
      return nextToken;
    },
    session: ({ session, token }) => ({
      ...session,
      googleSubject: typeof token.googleSubject === 'string' ? token.googleSubject : undefined,
      user: {
        ...session.user,
        email: session.user?.email ?? (typeof token.email === 'string' ? token.email : undefined),
        name: session.user?.name ?? (typeof token.name === 'string' ? token.name : undefined),
        image: session.user?.image ?? (typeof token.picture === 'string' ? token.picture : undefined),
      },
    }),
  },
});
