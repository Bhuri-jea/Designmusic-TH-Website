<script lang="ts">
  import { Motion } from 'svelte-motion';
  import { spring } from 'svelte/motion';
  import { onMount } from 'svelte';

  let scrollY = 0;
  
  // Spring store for buttery smooth parallax scrolling
  const smoothY = spring(0, {
    stiffness: 0.03,
    damping: 0.8
  });

  // rAF-throttled scroll handler to prevent scroll lag
  let rafPending = false;
  function onScroll() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      scrollY = window.scrollY;
      smoothY.set(scrollY);
      rafPending = false;
    });
  }

  onMount(() => {
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  });

  // Continuous gentle floating animation + Entrance (Made more visible)
  const brushVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: (custom: { delay: number }) => ({
      opacity: 1, // Svelte-motion overrides the Tailwind opacity class here!
      scale: [1, 1.15, 0.95, 1],
      rotate: [0, 4, -3, 0],
      x: [0, 20, -15, 0],
      y: [0, -20, 15, 0],
      transition: { 
        opacity: { delay: custom.delay, duration: 2, ease: "easeOut" },
        scale: { duration: 8, repeat: Infinity, ease: "easeInOut" },
        rotate: { duration: 12, repeat: Infinity, ease: "easeInOut" },
        x: { duration: 10, repeat: Infinity, ease: "easeInOut" },
        y: { duration: 14, repeat: Infinity, ease: "easeInOut" }
      }
    })
  };
</script>

<div class="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-neutral-950">
  
  <div class="absolute inset-0 opacity-40 mix-blend-screen">
    
    <!-- Brush Stroke 1: Muted Slate Blue -->
    <div class="absolute inset-0 transition-transform will-change-transform" style="transform: translate3d(0, {$smoothY * -0.4}px, 0) rotate({$smoothY * 0.02}deg);">
      <Motion custom={{ delay: 0.2 }} variants={brushVariants} initial="hidden" animate="visible" let:motion>
        <div use:motion class="absolute top-[0%] left-[-10%] w-[80vw] h-[40vw] opacity-[0.12] blur-[100px] rounded-[100%] bg-slate-400 mix-blend-color-dodge"></div>
      </Motion>
    </div>

    <!-- Brush Stroke 2: Deep Muted Burgundy/Rose -->
    <div class="absolute inset-0 transition-transform will-change-transform" style="transform: translate3d({$smoothY * -0.1}px, {$smoothY * -0.2}px, 0);">
      <Motion custom={{ delay: 0.5 }} variants={brushVariants} initial="hidden" animate="visible" let:motion>
        <div use:motion class="absolute top-[40%] right-[-20%] w-[100vw] h-[25vw] opacity-[0.08] blur-[80px] rounded-[100%] bg-rose-900 mix-blend-color-dodge rotate-[-25deg]"></div>
      </Motion>
    </div>

    <!-- Brush Stroke 3: Dimmed Vintage Gold/Bronze -->
    <div class="absolute inset-0 transition-transform will-change-transform" style="transform: translate3d(0, {$smoothY * -0.6}px, 0);">
      <Motion custom={{ delay: 0.8 }} variants={brushVariants} initial="hidden" animate="visible" let:motion>
        <div use:motion class="absolute bottom-[-20%] left-[20%] w-[50vw] h-[50vw] opacity-[0.06] blur-[120px] rounded-[45%] bg-[#a67c00] mix-blend-color-dodge"></div>
      </Motion>
    </div>

    <!-- Brush Stroke 4: Subtle Silver/Grey -->
    <div class="absolute inset-0 transition-transform will-change-transform" style="transform: translate3d(0, {$smoothY * -0.3}px, 0);">
      <Motion custom={{ delay: 1 }} variants={brushVariants} initial="hidden" animate="visible" let:motion>
        <div use:motion class="absolute top-[20%] left-[60%] w-[30vw] h-[60vw] opacity-[0.08] blur-[90px] rounded-[100%] bg-neutral-400 mix-blend-color-dodge rotate-[15deg]"></div>
      </Motion>
    </div>
  </div>
  
  <!-- Noise texture overlay - SVG filter replaced with Base64 PNG to eliminate GPU scrolling lag -->
  <div class="absolute inset-0 opacity-[0.15] mix-blend-overlay" style="background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyBAMAAADsEZWCAAAAElBMVEUAAAD8/vwEBAP///8/Pz8AAAAMW07OAAAAAXRSTlMAQObYZgAAAI5JREFUOMuV1bENwzAMBVAyQ7t3j2ABX8CLeP8VMoIFXIH1O1u2fB2nE2yS1xBEz/M4jOM4jOM4jOM4jOM4jOM4jOM4/o+T4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4p2v4n1fP5J4lU1/m+gAAAAASUVORK5CYII='); background-repeat: repeat;"></div>
  
  <!-- Vignette for depth -->
  <div class="absolute inset-0 bg-radial-[circle_at_center] from-transparent via-transparent to-neutral-950/95"></div>
</div>
