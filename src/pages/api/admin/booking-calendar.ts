import type {APIRoute} from 'astro';
import {requireAdmin} from '../../../lib/server/admin.ts';
import {bookingAvailability} from '../../../lib/server/bookings.ts';
import {bookingDateWindow} from '../../../lib/booking.ts';
import {rpc, SupabaseRequestError} from '../../../lib/server/supabase.ts';
import {HttpError,jsonResponse,errorResponse,readSameOriginJson} from '../../../lib/server/http.ts';
export const prerender=false;
function calendarSetupError(error:unknown){
 if(error instanceof SupabaseRequestError&&['42883','42P01','PGRST202','PGRST205'].includes(error.databaseCode??''))return new HttpError(503,'booking_calendar_setup_required');
 return error;
}
export const GET:APIRoute=async({request})=>{
 try{
  await requireAdmin(request);
  const [weeklyHours,overrides,availability]=await Promise.all([rpc('booking_weekly_hours',{}),rpc('booking_date_hours',{}),bookingAvailability(undefined,{googleFailure:'unavailable',includePast:true})]);
  return jsonResponse({...availability,...bookingDateWindow(),weeklyHours,overrides});
 }catch(error){return errorResponse(calendarSetupError(error));}
};
export const PATCH:APIRoute=async({request})=>{
 try{
  await requireAdmin(request);
  const body=await readSameOriginJson(request,8192),window=bookingDateWindow();
  const date=typeof body.date==='string'&&/^\d{4}-\d\d-\d\d$/.test(body.date)?new Date(`${body.date}T00:00:00Z`):null;
  const validDate=!!date&&!Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===body.date;
  if(Object.keys(body).sort().join(',')!=='date,hours'||typeof body.date!=='string'||!validDate||body.date<window.from||body.date>window.to
     ||body.hours!==null&&(!body.hours||typeof body.hours!=='object'||Array.isArray(body.hours)))throw new HttpError(400,'invalid_booking_date');
  if(body.hours!==null)for(const [time,status] of Object.entries(body.hours as object)){
   if(!/^(0[8-9]|1[0-9]):(00|30)$/.test(time)||!['available','contact_directly'].includes(String(status)))throw new HttpError(400,'invalid_booking_hours');
  }
  await rpc('admin_set_booking_date',{p_date:body.date,p_hours:body.hours});
  return jsonResponse({ok:true});
 }catch(error){return errorResponse(calendarSetupError(error));}
};
