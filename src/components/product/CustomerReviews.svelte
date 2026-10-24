<script lang="ts">
 import type {CustomerReview} from '../../lib/catalog-presentation';
 import type {Locale} from '../../lib/catalog';
 let {reviews=[],lang='en'}=$props<{reviews:CustomerReview[];lang?:Locale}>();
 const words=$derived({en:{title:'Customer impressions',source:'Customer feedback added by the shop.',rating:'out of 5 stars'},th:{title:'ความประทับใจจากลูกค้า',source:'ความคิดเห็นจากลูกค้าที่ร้านนำมาเผยแพร่',rating:'จาก 5 ดาว'},ja:{title:'お客様の声',source:'店舗が掲載したお客様のご感想です。',rating:'/ 5つ星'},'zh-CN':{title:'客户感想',source:'由店铺发布的客户反馈。',rating:'/ 5星'}}[lang]);
</script>
{#if reviews.length>0}<section class="customer-reviews" aria-label={words.title}>
 <h2>{words.title}</h2><p class="review-source">{words.source}</p>
 <div class="review-list">{#each reviews as review}<article>
  <div class="review-header"><h3>{review.name}</h3><span class="review-stars" aria-label={`${review.rating} ${words.rating}`}><span aria-hidden="true">{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span></span></div>
  <p class="impression">{review.impression}</p>
 </article>{/each}</div>
</section>{/if}
<style>
 .customer-reviews{border-top:1px solid #b9b0a4;padding-top:1.5rem;color:#2b252a}.customer-reviews h2{font-family:var(--font-serif);font-size:clamp(1.7rem,3vw,2.2rem);line-height:1.3}.review-source{color:#625b60;font-size:.95rem;margin-top:.5rem}.review-list{display:grid;gap:1rem;margin-top:1.25rem}.review-list article{padding:1rem 1.15rem;border:1px solid #b9b0a4;border-radius:.75rem;background:#fcfaf5;min-width:0}.review-header{display:flex;gap:.8rem;align-items:center;justify-content:space-between;flex-wrap:wrap}.review-header h3{font-size:1rem;font-weight:600;overflow-wrap:anywhere}.review-stars{color:#78551f;letter-spacing:.1em;white-space:nowrap}.impression{margin-top:.65rem;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.75}
</style>
