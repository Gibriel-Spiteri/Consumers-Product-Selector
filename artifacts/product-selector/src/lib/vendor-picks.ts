// The message protocol with the Consumers Quote Helper browser extension (browser-extension/consumers-quote-helper).
// Customers add products on vendor websites; the extension hands them to this page as "picks". Everything that
// arrives here is untrusted: it only pre-fills the Add Special Order form, and the rep confirms it.
import type { SpecialOrderProductLine } from "@workspace/api-client-react";

export const FROM_PAGE = "consumers-product-selector";
export const FROM_EXTENSION = "consumers-quote-helper";

export interface VendorPick {
  id: string;
  pickedAt: string;
  pageUrl: string;
  vendorDomain: string;
  name: string;
  model: string;
  color: string;
  price: number | null;
  imageUrl: string;
  quantity: number;
}

const MAX_TEXT = 300;
const str = (v: unknown, max = MAX_TEXT) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max) : "");
function httpsUrl(v: unknown): string {
  try {
    const url = new URL(String(v ?? ""));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export function parsePick(raw: unknown): VendorPick | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const id = str(p.id, 64);
  const pageUrl = httpsUrl(p.pageUrl);
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id) || !pageUrl) return null;
  const price = typeof p.price === "number" && Number.isFinite(p.price) && p.price >= 0 && p.price <= 99999999
    ? Math.round(p.price * 100) / 100 : null;
  const qty = typeof p.quantity === "number" && Number.isInteger(p.quantity) && p.quantity >= 1 && p.quantity <= 1000000 ? p.quantity : 1;
  const pick: VendorPick = {
    id,
    pickedAt: str(p.pickedAt, 40),
    pageUrl,
    vendorDomain: str(p.vendorDomain, 253).toLowerCase(),
    name: str(p.name),
    model: str(p.model),
    color: str(p.color),
    price,
    imageUrl: httpsUrl(p.imageUrl),
    quantity: qty,
  };
  return pick.name || pick.model ? pick : null;
}

// A "vendor-picks" message from the extension, or null for anything else.
export function parsePicksMessage(data: unknown): VendorPick[] | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (d.source !== FROM_EXTENSION || d.type !== "vendor-picks" || !Array.isArray(d.picks)) return null;
  return d.picks.slice(0, 50).map(parsePick).filter((p): p is VendorPick => p !== null);
}

// The vendor's main domain, so us.kohler.com and www.kohler.com both count as kohler.com (same rule as the extension).
export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/\.$/, "").split(".").filter(Boolean);
  if (parts.length <= 2) return parts.join(".");
  const twoPartTld = /^(co|com|net|org|gov|ac)\.[a-z]{2}$/.test(parts.slice(-2).join("."));
  return parts.slice(twoPartTld ? -3 : -2).join(".");
}

export function websiteDomain(url: string | null | undefined): string {
  try {
    return url ? registrableDomain(new URL(url).hostname) : "";
  } catch {
    return "";
  }
}

// Product lines whose website is on the pick's vendor domain (some vendors carry several, e.g. Foremost).
export function productLinesForPick(pick: VendorPick, lines: SpecialOrderProductLine[]): SpecialOrderProductLine[] {
  return lines.filter(l => websiteDomain(l.websiteUrl) === pick.vendorDomain);
}

// What the extension needs to know where to run: each product line's vendor website.
export function vendorSites(lines: SpecialOrderProductLine[]) {
  return lines
    .filter(l => !!l.websiteUrl)
    .map(l => ({ websiteUrl: l.websiteUrl, productLineId: l.id, productLineName: l.name, netsuiteItemId: l.netsuiteItemId }));
}

export interface SpecialOrderPrefill {
  netsuiteItemId?: string;
  candidateNames: string[];
  model: string;
  description: string;
  color: string;
  listPrice: number | null;
  quantity: number;
  sourceUrl: string;
}

export function prefillFromPick(pick: VendorPick, lines: SpecialOrderProductLine[]): SpecialOrderPrefill {
  const candidates = productLinesForPick(pick, lines);
  return {
    netsuiteItemId: candidates.length === 1 ? candidates[0].netsuiteItemId : undefined,
    candidateNames: candidates.map(c => c.name),
    model: pick.model,
    description: pick.name,
    color: pick.color,
    listPrice: pick.price,
    quantity: pick.quantity,
    sourceUrl: pick.pageUrl,
  };
}

export function postToExtension(type: string, data: Record<string, unknown> = {}) {
  window.postMessage({ source: FROM_PAGE, type, ...data }, window.location.origin);
}
