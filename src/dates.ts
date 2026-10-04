const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD */
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** "יום שלישי, 14.10" */
export function formatLong(iso: string): string {
  const d = fromISO(iso);
  return `יום ${DAYS[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}`;
}

/** "ג׳ 14.10" */
export function formatShort(iso: string): string {
  const d = fromISO(iso);
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}`;
}

export function relativeLabel(iso: string): string | null {
  const t = todayISO();
  if (iso === t) return 'היום';
  if (iso === addDays(t, 1)) return 'מחר';
  if (iso === addDays(t, 2)) return 'מחרתיים';
  return null;
}

export function dayOfMonth(iso: string): number {
  return fromISO(iso).getDate();
}

export function weekday(iso: string): number {
  return fromISO(iso).getDay();
}

export function monthName(iso: string): string {
  const names = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  return names[fromISO(iso).getMonth()];
}

export const WEEK_HEADERS = DAYS_SHORT;
