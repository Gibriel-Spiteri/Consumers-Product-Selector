// Push to a Sales Order Revision (2026-11-09). The search box reads an SOR or Sales Order number the way the
// server does (api-server lib/sorPush.ts sorQueryDigits).

/** "SOR230", "sor 230", "SO714882", "714882" -> the digits; anything else -> null. */
export function sorDigits(q: string): string | null {
  const s = q.trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return null;
  const m = s.match(/^(?:SOR|SO)?#?(\d{1,9})$/);
  return m ? m[1] : null;
}
