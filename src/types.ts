export type DutyType = 'shatifut' | 'hada' | 'rampa';

export const DUTY_LABELS: Record<DutyType, string> = {
  shatifut: 'שתפייה',
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
  name: string;
  phone: string; // normalized 9725XXXXXXXX
  dutyType: DutyType;
};

export type SwapRequest = {
  id: string;
  created_at: string;
  duty_type: DutyType;
  duty_date: string; // YYYY-MM-DD
  want_dates: string[];
  name: string;
  phone: string;
  note: string | null;
};

export type NewSwapRequest = Omit<SwapRequest, 'id' | 'created_at'>;
