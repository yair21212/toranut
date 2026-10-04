import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';
import { NewSwapRequest, SwapRequest } from './types';
import { todayISO } from './dates';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const COLUMNS = 'id, created_at, duty_type, duty_date, want_dates, name, phone, note';

export async function fetchOpenRequests(): Promise<SwapRequest[]> {
  const { data, error } = await supabase
    .from('swap_requests')
    .select(COLUMNS)
    .eq('closed', false)
    .gte('duty_date', todayISO())
    .order('duty_date', { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as SwapRequest[];
}

export async function createRequest(req: NewSwapRequest, ownerToken: string): Promise<string> {
  const { data, error } = await supabase
    .from('swap_requests')
    .insert({ ...req, owner_token: ownerToken })
    .select('id')
    .single();
  if (error) {
    if (error.message.includes('too_many_requests')) {
      throw new Error('יש לך כבר 10 בקשות פתוחות. סגור בקשות ישנות לפני שמפרסמים חדשה.');
    }
    throw new Error('הפרסום נכשל. בדוק את החיבור ונסה שוב.');
  }
  return (data as { id: string }).id;
}

export async function closeRequest(id: string, ownerToken: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('close_request', { p_id: id, p_token: ownerToken });
  if (error) throw new Error('הפעולה נכשלה. נסה שוב.');
  return Boolean(data);
}
