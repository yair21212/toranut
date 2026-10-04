/** Normalize an Israeli mobile number to 9725XXXXXXXX, or null if invalid. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('00972')) d = d.slice(5);
  else if (d.startsWith('972')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  if (/^5\d{8}$/.test(d)) return '972' + d;
  return null;
}

/** 9725XXXXXXXX -> 05X-XXX-XXXX */
export function displayPhone(p: string): string {
  const local = '0' + p.slice(3);
  return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
}

export function whatsappUrl(phone: string, text: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
