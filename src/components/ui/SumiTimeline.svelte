<script lang="ts">
  import { spring } from 'svelte/motion';
  import { onMount } from 'svelte';

  let scrollY = $state(0);
  let docHeight = $state(0);
  let winHeight = $state(0);

  // Spring for smooth brush stroke drawing
  const progress = spring(0, {
    stiffness: 0.05,
    damping: 0.8
  });

  // rAF-throttled scroll handler — prevents firing on every pixel scrolled
  let rafPending = false;

  function onScroll() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      scrollY = window.scrollY;
      rafPending = false;
    });
  }

  $effect(() => {
    if (docHeight > winHeight) {
      const maxScroll = docHeight - winHeight;
      const pct = Math.min(Math.max(scrollY / maxScroll, 0), 1);
      progress.set(pct);
    }
  });

  function updateHeights() {
    docHeight = document.documentElement.scrollHeight;
    winHeight = window.innerHeight;
  }

  onMount(() => {
    updateHeights();
    // Manual scroll listener (rAF throttled) instead of svelte:window bind
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateHeights, { passive: true });

    const observer = new ResizeObserver(updateHeights);
    observer.observe(document.body);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateHeights);
      observer.disconnect();
    };
  });
</script>

<div class="fixed top-0 -left-2 w-6 h-screen pointer-events-none z-0 mix-blend-screen overflow-hidden opacity-100 flex justify-end">
  <svg viewBox="0 0 100 1000" preserveAspectRatio="none" class="w-full h-full">
    <defs>
      <filter id="brush-wobble" filterUnits="userSpaceOnUse" x="-50" y="-50" width="200" height="1100">
        <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="20" xChannelSelector="R" yChannelSelector="G" />
      </filter>

      <linearGradient id="brush-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="25%" stop-color="#a3a3a3" />
        <stop offset="100%" stop-color="#262626" />
      </linearGradient>
    </defs>

    <!-- Faint track -->
    <path
      d="M 80 0 Q 90 500, 80 1000"
      stroke="rgba(255,255,255,0.15)"
      stroke-width="10"
      fill="none"
      filter="url(#brush-wobble)"
    />

    <!-- Ink stroke -->
    <path
      d="M 80 0 Q 90 500, 80 1000"
      stroke="url(#brush-gradient)"
      stroke-width="20"
      fill="none"
      filter="url(#brush-wobble)"
      stroke-dasharray="1000"
      stroke-dashoffset={1000 - ($progress * 1000)}
      stroke-linecap="round"
    />

    <!-- Ink drop head -->
    <circle
      cx="85"
      cy={$progress * 1000}
      r="10"
      fill="url(#brush-gradient)"
      filter="url(#brush-wobble)"
      style="opacity: {$progress > 0.01 && $progress < 0.99 ? 1 : 0}; transition: opacity 0.3s;"
    />
  </svg>
</div>
