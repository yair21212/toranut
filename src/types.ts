export type DutyType = 'shatifut' | 'hada' | 'rampa';

export const DUTY_LABELS: Record<DutyType, string> = {
  shatifut: 'שטפייה',
  hada: 'חד"א',
  rampa: 'רמפה',
};

export const DUTY_HINTS: Record<DutyType, string> = {
  shatifut: 'שטיפת כלים במטבח',
  hada: 'תורנות מטבח רגילה',
  rampa: 'תורנות רמפה',
};

export const DUTY_COLORS: Record<DutyType, { bg: string; fg: string; soft: string }> = {
  shatifut: { bg: '#2F5D8A', fg: '#FFFFFF', soft: '#E3ECF5' },
  hada: { bg: '#B4581F', fg: '#FFFFFF', soft: '#F7E7DC' },
  rampa: { bg: '#4F6B2E', fg: '#FFFFFF', soft: '#E7EEDC' },
};

export const DUTY_ORDER: DutyType[] = ['shatifut', 'hada', 'rampa'];

export type Profile = {
  name: string; // full name
  email: string; // lower-case; used only to log in again, never shown
  dutyType: DutyType;
};

export type SwapRequest = {
  id: string;
  created_at: string;
  duty_type: DutyType;
  duty_date: string; // YYYY-MM-DD
  name: string;
  note: string | null;
  mine: boolean; // posted by this email or this device
};

export type NewSwapRequest = {
  duty_type: DutyType;
  duty_date: string;
  name: string;
  email: string;
  note: string | null;
};
