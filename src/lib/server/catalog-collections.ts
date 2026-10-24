import {select,SupabaseRequestError} from './supabase.ts';
export async function loadPublicCollections(load:()=>Promise<any[]>=()=>select('catalog_collections',{order:'created_at'})){
 try{return await load();}catch(error){
  // Category labels are optional during rollout; inventory and authorization errors still fail closed.
  if(error instanceof SupabaseRequestError&&['PGRST205','42P01'].includes(error.databaseCode??''))return [];
  throw error;
 }
}