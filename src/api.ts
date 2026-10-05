import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';
import { NewSwapRequest, SwapRequest } from './types';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---- base access code ----
let accessCode = '';
export function setAccessCode(code: string) {
  accessCode = code;
}

/** Thrown when the stored base code is wrong/changed, so the app can ask for it again. */
export class AccessError extends Error {
  constructor(public status: 'bad_code' | 'too_many_attempts') {
    super(status);
  }
}

function checkStatus(status: string | undefined) {
  if (status === 'bad_code' || status === 'too_many_attempts') throw new AccessError(status);
}

export async function verifyCode(code: string): Promise<'ok' | 'bad_code' | 'too_many_attempts'> {
  const { data, error } = await supabase.rpc('access_check', { p_code: code });
  if (error) throw new Error('לא הצלחנו לבדוק את הקוד. בדקו את החיבור לאינטרנט.');
  return data as 'ok' | 'bad_code' | 'too_many_attempts';
}

export async function fetchOpenRequests(): Promise<SwapRequest[]> {
  const { data, error } = await supabase.rpc('requests_list', { p_code: accessCode });
  if (error) throw new Error(error.message);
  const res = data as { status: string; rows?: SwapRequest[] };
  checkStatus(res.status);
  return res.rows ?? [];
}

export async function createRequest(req: NewSwapRequest, ownerToken: string): Promise<string> {
  const { data, error } = await supabase.rpc('request_create', {
    p_code: accessCode,
    p_duty_type: req.duty_type,
    p_duty_date: req.duty_date,
    p_name: req.name,
    p_phone: req.phone,
    p_note: req.note,
    p_token: ownerToken,
  });
  if (error) {
    if (error.message.includes('too_many_requests')) {
      throw new Error('יש לך כבר 10 בקשות פתוחות. סגור בקשות ישנות לפני שמפרסמים חדשה.');
    }
    throw new Error('הפרסום נכשל. בדוק את החיבור ונסה שוב.');
  }
  const res = data as { status: string; id?: string };
  checkStatus(res.status);
  if (res.status !== 'ok' || !res.id) throw new Error('הפרסום נכשל. בדקו שהתאריך תקין ונסו שוב.');
  return res.id;
}

export type CloseReason = 'swapped' | 'removed';

/** Close a request owned either by this phone number or by this device. */
export async function closeRequest(id: string, phone: string, ownerToken: string, reason: CloseReason): Promise<boolean> {
  const { data, error } = await supabase.rpc('request_close', {
    p_code: accessCode,
    p_id: id,
    p_phone: phone,
    p_token: ownerToken,
    p_reason: reason,
  });
  if (error) throw new Error('הפעולה נכשלה. נסה שוב.');
  const res = data as { status: string; closed?: boolean };
  checkStatus(res.status);
  return Boolean(res.closed);
}

/** Fire-and-forget: count that someone sent a WhatsApp swap offer. */
export function logOffer(requestId: string, dutyType: string): void {
  supabase
    .rpc('offer_log', { p_code: accessCode, p_request_id: requestId, p_duty_type: dutyType })
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

export async function adminSetCode(password: string, newCode: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_code', { p_password: password, p_new_code: newCode });
  if (error) {
    if (error.message.includes('bad_new_code')) throw new Error('הקוד צריך להיות 4 עד 8 ספרות.');
    if (error.message.includes('bad_password')) throw new Error('סיסמת המנהל לא נכונה.');
    throw new Error('השינוי נכשל. נסו שוב.');
  }
}
