// @ts-check
import { defineConfig } from 'astro/config';

import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';

import vercel from '@astrojs/vercel';

import auth from 'auth-astro';

// https://astro.build/config
export default defineConfig({
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ja', 'zh-CN', 'th'],
    routing: {
      prefixDefaultLocale: false
    }
  },

  integrations: [svelte(), auth()],

  vite: {
    plugins: [tailwindcss()]
  },

  adapter: vercel()
});