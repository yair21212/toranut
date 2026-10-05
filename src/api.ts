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

export type CloseReason = 'swapped' | 'removed';

/** Close a request owned either by this phone number or by this device. */
export async function closeRequest(id: string, phone: string, ownerToken: string, reason: CloseReason): Promise<boolean> {
  const { data, error } = await supabase.rpc('close_request_owned', {
    p_id: id,
    p_phone: phone,
    p_token: ownerToken,
    p_reason: reason,
  });
  if (error) throw new Error('הפעולה נכשלה. נסה שוב.');
  return Boolean(data);
}

/** Fire-and-forget: count that someone sent a WhatsApp swap offer. */
export function logOffer(requestId: string, dutyType: string): void {
  supabase
    .from('swap_offers')
    .insert({ request_id: requestId, duty_type: dutyType })
    .then(() => {}, () => {});
}

export type AdminStats = {
  users: number;
  requests_total: number;
  requests_open: number;
  swapped: number;
  removed: number;
  expired: number;
  offers: number;
  swapped_7d: number;
  requests_7d: number;
  by_type: { duty_type: string; requests: number; swapped: number; offers: number; open: number }[];
  daily: { day: string; requests: number; swapped: number }[];
};

export async function fetchAdminStats(password: string): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('admin_stats', { p_password: password });
  if (error) {
    if (error.message.includes('bad_password')) throw new Error('הסיסמה לא נכונה.');
    throw new Error('לא הצלחנו לטעון את הנתונים. בדוק את החיבור.');
  }
  return data as AdminStats;
}
