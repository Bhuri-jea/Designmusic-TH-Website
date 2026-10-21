<script lang="ts">
 import {WORKSHOP_MAP_URL,WORKSHOP_MAP_EMBED,WORKSHOP_ADDRESS_EN,WORKSHOP_ADDRESS_TH,workshopLabels} from '../../lib/workshop';
 let {lang='en'}=$props<{lang?:keyof typeof workshopLabels}>();
 const copy=$derived(workshopLabels[lang]??workshopLabels.en);
</script>

<section class="workshop-location" aria-label={copy.title}>
 <h2>{copy.title}</h2>
 <address><p lang="en">{WORKSHOP_ADDRESS_EN}</p><p lang="th">{WORKSHOP_ADDRESS_TH}</p></address>
 <a href={WORKSHOP_MAP_URL} target="_blank" rel="noopener noreferrer">{copy.map} ↗</a>
 <iframe src={WORKSHOP_MAP_EMBED} title="Design Music workshop — pickup location in Bangkok" width="600" height="450" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
</section>

<style>
 .workshop-location{padding:20px;border:1px solid #a8b29e;border-radius:14px;background:#e8ece2;color:#252923;text-align:left;min-width:0}
 h2{margin:0 0 12px;font-size:1.15rem;font-weight:600;line-height:1.4}
 address{font-style:normal}p{margin:0 0 12px;font-size:.95rem;line-height:1.7;overflow-wrap:anywhere}
 a{display:inline-flex;align-items:center;min-height:44px;color:#334728;text-decoration:underline;text-underline-offset:4px;font-size:.95rem;font-weight:600;margin-bottom:10px}
 a:focus-visible{outline:2px solid #334728;outline-offset:4px}
 iframe{display:block;width:100%;max-width:100%;height:320px;border:0;border-radius:8px;background:#d3dacb}
 @media(max-width:639px){.workshop-location{padding:16px}iframe{height:260px}}
</style>
