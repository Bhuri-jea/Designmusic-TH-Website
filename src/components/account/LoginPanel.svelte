<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { signIn } from 'auth-astro/client';
  import { accountCopy } from '../../i18n/account';
  import { safeCallback } from '../../utils/navigation';
  import type { Locale } from '../../lib/catalog';
  let { lang = 'en', initialSignup = false } = $props<{ lang?: string; initialSignup?: boolean }>();
  let profilePath = $derived(['ja', 'th', 'zh-CN'].includes(lang) ? '/' + lang + '/profile' : '/profile');
  let copy = $derived(accountCopy[lang as keyof typeof accountCopy] ?? accountCopy.en);
  let signup = $state(untrack(() => initialSignup));
  let name = $state('');
  let email = $state('');
  let password = $state('');
  let confirmation = $state('');
  let status = $state('');
  let busy = $state(false);
  let returnPath = $state('');
  const runtimeSignIn = signIn as unknown as (provider: string, options: Record<string, string | boolean>) => Promise<Response | void>;

  onMount(() => {
    const locale: Locale = lang === 'ja' || lang === 'th' || lang === 'zh-CN' ? lang : 'en';
    returnPath = safeCallback(new URLSearchParams(window.location.search).get('returnTo'), locale);
    // Supabase verifies the confirmation link; fragment tokens never grant a site session.
    if (window.location.hash.includes('access_token=') || window.location.hash.includes('error=')) {
      const failed = window.location.hash.includes('error=');
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      status = failed ? copy.unavailable : copy.confirmation;
    }
  });
  function switchMode(value: boolean) {
    signup = value;
    password = '';
    confirmation = '';
    status = '';
  }
  async function googleLogin() {
    busy = true;
    status = copy.busy;
    try { await runtimeSignIn('google', { callbackUrl: returnPath || profilePath, redirect: true }); }
    catch { status = copy.unavailable; }
    finally { busy = false; }
  }
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (signup && password !== confirmation) { status = copy.mismatch; return; }
    busy = true;
    status = copy.busy;
    try {
      if (signup) {
        const response = await fetch('/api/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, email, password, locale: lang }) });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          status = response.status === 429 ? copy.rate : result.error === 'weak_password' ? copy.weak : response.status === 400 ? copy.invalid : copy.unavailable;
          return;
        }
        switchMode(false);
        status = copy.sent;
      } else {
        const response = await runtimeSignIn('credentials', { email, password, redirect: false, callbackUrl: returnPath || profilePath });
        if (response instanceof Response) status = copy.invalid;
      }
    } catch { status = copy.unavailable; }
    finally { busy = false; password = ''; confirmation = ''; }
  }
</script>

<div class="w-full bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-10 md:p-14 text-center" data-aos="fade-up">
  <div class="grid grid-cols-2 gap-2 mb-8 rounded-xl bg-black/30 p-1" role="group" aria-label={copy.account}>
    <button type="button" class="rounded-lg py-3 transition-colors {signup ? 'text-neutral-400 hover:text-white' : 'bg-[#c2aa6a] text-[#171a1b]'}" aria-pressed={!signup} disabled={busy} onclick={() => switchMode(false)}>{copy.login}</button>
    <button type="button" class="rounded-lg py-3 transition-colors {signup ? 'bg-[#c2aa6a] text-[#171a1b]' : 'text-neutral-400 hover:text-white'}" aria-pressed={signup} disabled={busy} onclick={() => switchMode(true)}>{copy.signup}</button>
  </div>
  <h1 class="font-serif text-4xl mb-4">{signup ? copy.create : copy.welcome}</h1>
  <p class="text-neutral-400 font-light mb-8">{signup ? copy.signupIntro : copy.intro}</p>
  <form class="space-y-4 text-left" onsubmit={submit}>
    {#if signup}
      <div><label for="account-name" class="block text-xs uppercase tracking-[0.2em] text-neutral-400 mb-2">{copy.name}</label><input id="account-name" name="name" bind:value={name} required maxlength="120" autocomplete="name" class="w-full bg-black/50 border border-white/20 rounded-xl p-4 text-white focus:outline-none focus:border-white transition-all" /></div>
    {/if}
    <div><label for="account-email" class="block text-xs uppercase tracking-[0.2em] text-neutral-400 mb-2">{copy.email}</label><input id="account-email" name="email" type="email" bind:value={email} required maxlength="320" autocomplete="email" class="w-full bg-black/50 border border-white/20 rounded-xl p-4 text-white focus:outline-none focus:border-white transition-all" placeholder="you@example.com" /></div>
    <div><label for="account-password" class="block text-xs uppercase tracking-[0.2em] text-neutral-400 mb-2">{copy.password}</label><input id="account-password" name="password" type="password" bind:value={password} required minlength={signup ? 12 : 1} maxlength="72" autocomplete={signup ? 'new-password' : 'current-password'} aria-describedby={signup ? 'password-hint' : undefined} class="w-full bg-black/50 border border-white/20 rounded-xl p-4 text-white focus:outline-none focus:border-white transition-all" />{#if signup}<p id="password-hint" class="mt-2 text-xs text-neutral-400">{copy.passwordHint}</p>{/if}</div>
    {#if signup}
      <div><label for="account-confirm" class="block text-xs uppercase tracking-[0.2em] text-neutral-400 mb-2">{copy.confirm}</label><input id="account-confirm" name="confirm" type="password" bind:value={confirmation} required minlength="12" maxlength="72" autocomplete="new-password" class="w-full bg-black/50 border border-white/20 rounded-xl p-4 text-white focus:outline-none focus:border-white transition-all" /></div>
    {/if}
    <button type="submit" disabled={busy} class="w-full bg-[#c2aa6a] text-[#171a1b] rounded-xl py-4 font-medium hover:bg-[#d0bc83] transition-colors disabled:opacity-50">{signup ? copy.emailSignup : copy.emailLogin}</button>
  </form>
  <p class="mt-3 min-h-5 text-sm text-neutral-300" role="status" aria-live="polite">{status}</p>
  <div class="my-8 flex items-center gap-4 text-neutral-500 text-xs uppercase tracking-[0.2em]"><span class="flex-1 h-px bg-white/10"></span>{copy.or}<span class="flex-1 h-px bg-white/10"></span></div>
  <button type="button" disabled={busy} onclick={googleLogin} class="flex items-center justify-center gap-3 w-full bg-white text-black rounded-xl py-4 font-medium hover:bg-neutral-200 transition-colors disabled:opacity-50">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-5 h-5" aria-hidden="true"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
    {signup ? copy.googleSignup : copy.googleLogin}
  </button>
  <p class="mt-8 text-sm text-neutral-400 font-light">{copy.separate}</p>
</div>
