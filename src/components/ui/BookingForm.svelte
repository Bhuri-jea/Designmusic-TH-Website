<script lang="ts">
  import { Calendar, Clock, PenTool, Image as ImageIcon, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, UploadCloud } from 'lucide-svelte';
  import { ui, defaultLang } from '../../i18n/ui';

  // State
  let step = $state(1);
  let instrument = $state('');
  let service = $state('');
  let selectedDate = $state('');
  let selectedTime = $state('');
  
  // Details & Uploads
  let notes = $state('');
  let uploadedImages = $state<string[]>([]); // To hold preview URLs
  let isDragging = $state(false);

  // Options
  const instruments = ['Saxophone (Soprano)', 'Saxophone (Alto)', 'Saxophone (Tenor)', 'Saxophone (Baritone)', 'Bassoon', 'Other'];
  
  const services = [
    { name: 'Basic (Pad & Cork adjustment)', basePrice: 1000 },
    { name: 'Standard (Cleaning & Spring/Pad replacement)', basePrice: 3500 },
    { name: 'Overhaul (Full restoration)', basePrice: 5000 },
    { name: 'Custom/Assessment', basePrice: 0 }
  ];
  
  // Calculate estimated price based on service and instrument
  let estimatedPrice = $derived.by(() => {
    if (!service) return null;
    const srv = services.find(s => s.name === service);
    if (!srv || srv.basePrice === 0) return 'TBD upon inspection';
    
    let multiplier = 1;
    if (instrument === 'Saxophone (Tenor)') multiplier = 1.2;
    if (instrument === 'Saxophone (Baritone)') multiplier = 1.5;
    if (instrument === 'Bassoon') multiplier = 1.3;
    
    const currency = 'THB';
    return `~ ${(srv.basePrice * multiplier).toLocaleString()} ${currency}`;
  });

  const timeBlocks = [
    '10:00 - 11:00',
    '11:00 - 12:00',
    '13:00 - 14:00',
    '14:00 - 15:00',
    '15:00 - 16:00',
    '16:00 - 17:00',
    '17:00 - 18:00'
  ];

  // Helper to get next 14 days for the date picker
  let availableDates = $derived.by(() => {
    const dates = [];
    let d = new Date();
    d.setDate(d.getDate() + 1); // Start from tomorrow
    
    for (let i = 0; i < 14; i++) {
      if (d.getDay() !== 0) { // Skip Sundays
        dates.push({
          value: d.toISOString().split('T')[0],
          display: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        });
      }
      d.setDate(d.getDate() + 1);
    }
    return dates;
  });

  function nextStep() {
    if (step === 1 && (!instrument || !service)) return alert('Please select an instrument and service type.');
    if (step === 2 && (!selectedDate || !selectedTime)) return alert('Please select a date and time slot.');
    step++;
  }

  function prevStep() {
    step--;
  }

  // Image upload handlers
  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    if (e.dataTransfer?.files) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }

  function handleFileInput(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files) {
      handleFiles(Array.from(target.files));
    }
  }

  function handleFiles(files: File[]) {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          uploadedImages = [...uploadedImages, e.target.result as string];
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    
    // Fallback: Generate a mailto link since there's no backend specified yet
    const subject = encodeURIComponent(`Repair Booking: ${instrument} - ${service}`);
    const body = encodeURIComponent(`
Booking Details:
Date: ${selectedDate}
Time: ${selectedTime}
Instrument: ${instrument}
Service: ${service}
Estimated Price: ${estimatedPrice}

Condition Notes:
${notes}

[Note: Images were attached in the web UI. Requires backend for full sync]
    `);
    
    window.location.href = `mailto:designmusicthailand@gmail.com?subject=${subject}&body=${body}`;
    
    // Show success screen
    step = 4;
  }
</script>

<div class="max-w-3xl mx-auto bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
  
  <!-- Progress Header -->
  <div class="flex border-b border-white/10">
    <div class={`flex-1 text-center py-4 text-xs font-medium tracking-widest uppercase transition-colors ${step >= 1 ? 'text-white border-b-2 border-white' : 'text-neutral-500'}`}>1. Service</div>
    <div class={`flex-1 text-center py-4 text-xs font-medium tracking-widest uppercase transition-colors ${step >= 2 ? 'text-white border-b-2 border-white' : 'text-neutral-500'}`}>2. Time</div>
    <div class={`flex-1 text-center py-4 text-xs font-medium tracking-widest uppercase transition-colors ${step >= 3 ? 'text-white border-b-2 border-white' : 'text-neutral-500'}`}>3. Details</div>
  </div>

  <div class="p-8 md:p-12">
    
    <!-- STEP 1: Instrument & Service -->
    {#if step === 1}
      <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h3 class="font-serif text-2xl text-white mb-4 flex items-center gap-3"><PenTool class="w-6 h-6 opacity-70" /> Select Instrument</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {#each instruments as inst}
              <button 
                class={`p-4 text-left rounded-xl border transition-all ${instrument === inst ? 'bg-white text-black border-white' : 'bg-transparent text-neutral-300 border-white/20 hover:border-white/50'}`}
                onclick={() => instrument = inst}
              >
                {inst}
              </button>
            {/each}
          </div>
        </div>

        <div>
          <h3 class="font-serif text-2xl text-white mb-4">Required Service</h3>
          <div class="grid grid-cols-1 gap-4">
            {#each services as srv}
              <button 
                class={`p-4 text-left rounded-xl border transition-all flex justify-between items-center ${service === srv.name ? 'bg-white text-black border-white' : 'bg-transparent text-neutral-300 border-white/20 hover:border-white/50'}`}
                onclick={() => service = srv.name}
              >
                <span>{srv.name}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Dynamic Price Estimation -->
        {#if instrument && service}
          <div class="p-6 bg-white/5 border border-white/10 rounded-xl mt-8 animate-in fade-in slide-in-from-bottom-2">
            <div class="flex justify-between items-end mb-3">
              <span class="text-neutral-400 font-medium tracking-widest uppercase text-xs">{t('booking.estimated')}</span>
              <span class="text-3xl font-serif text-white">{estimatedPrice}</span>
            </div>
            <div class="flex gap-2 text-neutral-500 text-xs font-light bg-black/40 p-3 rounded-lg">
              <AlertCircle class="w-4 h-4 shrink-0" />
              <p>Disclaimer: This is an estimated base price. The final repair fee depends strictly on the physical condition of your instrument upon inspection.</p>
            </div>
          </div>
        {/if}

        <div class="flex justify-end pt-6">
          <button class="btn btn-primary gap-2" onclick={nextStep}>Next Step <ChevronRight class="w-4 h-4" /></button>
        </div>
      </div>
    {/if}

    <!-- STEP 2: Date & Time -->
    {#if step === 2}
      <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h3 class="font-serif text-2xl text-white mb-4 flex items-center gap-3"><Calendar class="w-6 h-6 opacity-70" /> Select Date</h3>
          <div class="flex overflow-x-auto pb-4 gap-3 snap-x scrollbar-hide">
            {#each availableDates as date}
              <button 
                class={`shrink-0 snap-start p-4 w-28 text-center rounded-xl border transition-all ${selectedDate === date.value ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-neutral-300 border-white/20 hover:border-white/50'}`}
                onclick={() => selectedDate = date.value}
              >
                <div class="text-xs uppercase tracking-widest opacity-70 mb-1">{date.display.split(',')[0]}</div>
                <div class="font-medium">{date.display.split(',')[1]}</div>
              </button>
            {/each}
          </div>
        </div>

        <div>
          <h3 class="font-serif text-2xl text-white mb-4 flex items-center gap-3"><Clock class="w-6 h-6 opacity-70" /> Select 1-Hour Time Block</h3>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {#each timeBlocks as time}
              <button 
                class={`p-4 text-center rounded-xl border transition-all ${selectedTime === time ? 'bg-white text-black border-white shadow-[0_0_20px_-5px_rgba(255,255,255,0.3)]' : 'bg-transparent text-neutral-300 border-white/20 hover:border-white/50'}`}
                onclick={() => selectedTime = time}
              >
                {time}
              </button>
            {/each}
          </div>
        </div>

        <div class="flex justify-between pt-6">
          <button class="btn btn-ghost gap-2" onclick={prevStep}><ChevronLeft class="w-4 h-4" /> Back</button>
          <button class="btn btn-primary gap-2" onclick={nextStep}>Next Step <ChevronRight class="w-4 h-4" /></button>
        </div>
      </div>
    {/if}

    <!-- STEP 3: Details & Images -->
    {#if step === 3}
      <form class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500" onsubmit={handleSubmit}>
        
        <div class="space-y-2">
          <label for="notes" class="text-xs font-medium tracking-widest uppercase text-neutral-400">Describe the issue / Instrument Condition</label>
          <textarea id="notes" bind:value={notes} rows="3" class="w-full bg-black/50 border border-white/20 rounded-xl p-4 text-white placeholder-neutral-600 focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-all" placeholder="E.g., The low Bb key is sticking and there's a small dent near the bell..."></textarea>
        </div>

        <!-- Image Upload Drag & Drop -->
        <div class="space-y-2">
          <label class="text-xs font-medium tracking-widest uppercase text-neutral-400">Upload Photos of Damage</label>
          <div 
            class={`w-full border-2 border-dashed rounded-xl p-8 text-center transition-all ${isDragging ? 'border-white bg-white/10' : 'border-white/20 bg-black/30 hover:border-white/40 hover:bg-black/50'}`}
            ondragover={(e) => { e.preventDefault(); isDragging = true; }}
            ondragleave={() => isDragging = false}
            ondrop={handleDrop}
          >
            <UploadCloud class="w-8 h-8 text-neutral-500 mx-auto mb-3" />
            <p class="text-sm text-neutral-300 mb-1">Drag and drop images here, or</p>
            <label class="text-sm font-medium text-white cursor-pointer hover:underline">
              browse your files
              <input type="file" multiple accept="image/*" class="hidden" onchange={handleFileInput} />
            </label>
          </div>
          
          <!-- Image Previews -->
          {#if uploadedImages.length > 0}
            <div class="flex gap-4 mt-4 overflow-x-auto py-2">
              {#each uploadedImages as img, i}
                <div class="relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border border-white/20">
                  <img src={img} alt="Upload preview" class="w-full h-full object-cover" />
                  <button type="button" class="absolute top-1 right-1 bg-black/60 rounded-full p-1 hover:bg-red-500/80 transition-colors" onclick={() => uploadedImages.splice(i, 1)}>
                    <CheckCircle2 class="w-3 h-3 text-white hidden" /> <!-- We reuse the icon slot for a close or check -->
                    <span class="text-white text-[10px] leading-none block px-1">&times;</span>
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Summary box -->
        <div class="p-6 bg-white/5 border border-white/10 rounded-xl mt-8">
          <h4 class="font-medium tracking-widest uppercase text-xs text-neutral-400 mb-4">Booking Summary</h4>
          <div class="grid grid-cols-2 gap-y-4 gap-x-2 text-sm font-light">
            <div><span class="text-neutral-500 block text-[10px] uppercase tracking-widest mb-1">Date & Time</span> <span class="text-white">{selectedDate} <br/> {selectedTime}</span></div>
            <div><span class="text-neutral-500 block text-[10px] uppercase tracking-widest mb-1">Instrument</span> <span class="text-white">{instrument}</span></div>
            <div><span class="text-neutral-500 block text-[10px] uppercase tracking-widest mb-1">Service</span> <span class="text-white">{service.split('(')[0]}</span></div>
            <div><span class="text-neutral-500 block text-[10px] uppercase tracking-widest mb-1">Est. Price</span> <span class="text-white font-medium">{estimatedPrice}</span></div>
          </div>
        </div>

        <div class="flex justify-between pt-6">
          <button type="button" class="btn btn-ghost gap-2" onclick={prevStep}><ChevronLeft class="w-4 h-4" /> Back</button>
          <button type="submit" class="btn btn-primary gap-2">Confirm Booking <CheckCircle2 class="w-4 h-4" /></button>
        </div>
      </form>
    {/if}

    <!-- STEP 4: Success -->
    {#if step === 4}
      <div class="text-center py-12 space-y-6 animate-in fade-in zoom-in-95 duration-500">
        <div class="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_-10px_rgba(255,255,255,0.5)]">
          <CheckCircle2 class="w-10 h-10 text-black" />
        </div>
        <h2 class="font-serif text-4xl text-white">Booking Request Sent</h2>
        <p class="text-neutral-400 font-light text-lg max-w-md mx-auto">
          Thank you for choosing Design Music. Your appointment request and photos have been submitted. We will review and reply to confirm your time slot shortly.
        </p>
        <div class="pt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <a href="/profile" class="btn btn-primary tracking-widest uppercase text-sm">View My Appointments</a>
          <a href="/repair-services" class="btn btn-secondary tracking-widest uppercase text-sm">Return to Services</a>
        </div>
      </div>
    {/if}

  </div>
</div>

<style>
  /* Hide scrollbar for the horizontal date picker */
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
</style>
