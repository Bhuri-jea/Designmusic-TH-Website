/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly GOOGLE_CLIENT_ID?: string;
  readonly GOOGLE_CLIENT_SECRET?: string;
  readonly AUTH_SECRET?: string;
  readonly EMAIL_LOGIN_EMAIL?: string;
  readonly EMAIL_LOGIN_PASSWORD?: string;
  readonly EMAIL_LOGIN_NAME?: string;
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
}
