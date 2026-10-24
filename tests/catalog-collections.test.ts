import test from 'node:test';import assert from 'node:assert/strict';
import {loadPublicCollections} from '../src/lib/server/catalog-collections.ts';
import {SupabaseRequestError} from '../src/lib/server/supabase.ts';
test('public catalog tolerates only a missing optional category table during additive rollout',async()=>{
 for(const code of ['PGRST205','42P01'])assert.deepEqual(await loadPublicCollections(async()=>{throw new SupabaseRequestError(502,code);}),[]);
 await assert.rejects(loadPublicCollections(async()=>{throw new SupabaseRequestError(502,'42501');}));
 const rows=[{slug:'parts',labels:{en:'Instrument parts'}}];assert.deepEqual(await loadPublicCollections(async()=>rows),rows);
});