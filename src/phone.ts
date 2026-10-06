/** Normalize an email address, or null if it doesn't look valid. */
export function normalizeEmail(input: string): string | null {
  const e = input.trim().toLowerCase();
  if (e.length > 120 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return null;
  return e;
}

/** Full name = at least two words, first and last of 2+ letters. Returns the cleaned name or null. */
export function normalizeFullName(input: string): string | null {
  const n = input.trim().replace(/\s+/g, ' ');
  if (n.length > 40 || !/^\S{2,}( \S+)*( \S{2,})$/.test(n)) return null;
  return n;
}

/** Copy text to the clipboard on the web (with a fallback for older browsers). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Opens WhatsApp (app on phones). Without a number, WhatsApp lets the user pick the chat. */
export const WHATSAPP_URL = 'https://wa.me/';
