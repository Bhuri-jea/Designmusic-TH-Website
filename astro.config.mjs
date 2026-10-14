import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import auth from 'auth-astro';

export default defineConfig({
  output: 'server',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ja', 'zh-CN', 'th'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [svelte(), auth({ injectEndpoints: false })],
  vite: {
    plugins: [tailwindcss()],
    server: { watch: { ignored: ['**/.runtime/**', '**/.superpowers/**', '**/.vercel/**'] } },
  },
  adapter: vercel({ maxDuration: 120 }),
});

