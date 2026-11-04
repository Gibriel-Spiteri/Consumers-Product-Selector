// The message protocol with the Consumers Quote Helper browser extension (browser-extension/consumers-quote-helper).
// Customers add products on vendor websites; the extension hands them to this page as "picks". Everything that
// arrives here is untrusted: it only fills in plain text fields (length-limited) of a special-order line, which the
// rep checks and completes on the quote list before anything goes to NetSuite.
// 2026-11-04: picks go straight onto the quote list (quoteInputFromPick). Was: they only pre-filled the Add Special
// Order form through a Use button; that remains for picks whose vendor site has several product lines.
import type { SpecialOrderDetails, SpecialOrderProductLine } from "@workspace/api-client-react";
import type { SpecialOrderInput } from "@/context/quote-list-context";

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
  // Extension 1.3.0 and later: what the customer chose or the page showed (all optional, plain text or ids).
  productLineId?: string; // the product line chosen on a vendor site that has several (Foremost)
  typeId?: string; // the special-order Type chosen in the extension's panel
  typeName?: string;
  collection?: string; // "Broderick"
  description?: string; // the product name, as edited in the panel
  category?: string; // the vendor's breadcrumbs, "Kitchen / Sink Faucets / Pull-Down" (for the Type guess)
}

const MAX_TEXT = 300;
const nsId = (v: unknown) => (typeof v === "string" && /^[1-9]\d{0,17}$/.test(v) ? v : "");
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
  const extra: Partial<VendorPick> = {
    productLineId: nsId(p.productLineId), typeId: nsId(p.typeId), typeName: str(p.typeName),
    collection: str(p.collection), description: str(p.description), category: str(p.category),
  };
  for (const [k, v] of Object.entries(extra)) if (v) (pick as unknown as Record<string, unknown>)[k] = v;
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

// The product line a pick belongs to: the one chosen in the extension when its site has several (and it is one of
// them), else the only line on that site. Null when the rep has to choose.
export function productLineForPick(pick: VendorPick, lines: SpecialOrderProductLine[]): SpecialOrderProductLine | null {
  const candidates = productLinesForPick(pick, lines);
  const chosen = pick.productLineId ? candidates.find(l => l.id === pick.productLineId) : undefined;
  return chosen ?? (candidates.length === 1 ? candidates[0] : null);
}

// What the extension needs to know where to run (each product line's vendor website), and since 1.3.0 the product
// line's special-order Types, which its panel offers.
export function vendorSites(lines: SpecialOrderProductLine[]) {
  return lines
    .filter(l => !!l.websiteUrl)
    .map(l => ({
      websiteUrl: l.websiteUrl, productLineId: l.id, productLineName: l.name, netsuiteItemId: l.netsuiteItemId,
      types: (l.types ?? []).map(t => ({ id: t.id, name: t.name, requiresAttachment: t.requiresAttachment })),
    }));
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
    // netsuiteItemId: candidates.length === 1 ? candidates[0].netsuiteItemId : undefined,
    netsuiteItemId: productLineForPick(pick, lines)?.netsuiteItemId,
    candidateNames: candidates.map(c => c.name),
    model: pick.model,
    // description: pick.name,
    description: collDesc(pick.collection, pick.description || pick.name),
    color: pick.color,
    listPrice: pick.price,
    quantity: pick.quantity,
    sourceUrl: pick.pageUrl,
  };
}

// ---- Picks go straight onto the quote list (Gib, 2026-11-04) ------------------------------------------------------

export interface PickTypeOption {
  id: string;
  name: string;
  requiresAttachment: boolean;
}

// Words, singular: "Pull-Down Kitchen Faucets" -> pull, down, kitchen, faucet.
function words(s: string): string[] {
  return s.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 1).map(w => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

// The product line's special-order Type that fits the pick, from the product name (counts double) and the vendor's
// address: "Single Handle Pull-Down Kitchen Faucet" on /kitchen/ -> KITCHEN FAUCET, "Modern Metal Pull" -> PULL.
// No guess when two Types fit equally well (Elkay's "Undermount Sink": KITCHEN SINK or BATH SINK), and never an
// order-form Type or MISCELLANEOUS; the rep chooses those.
// The vendor's breadcrumbs ("Kitchen / Sink Faucets / Pull-Down") count like the address. The extension uses the same
// rule (suggestType in extract.js) to preselect the Type in its panel.
export function suggestType(pick: Pick<VendorPick, "name" | "pageUrl"> & { category?: string }, types: PickTypeOption[]): PickTypeOption | null {
  let path = "";
  try {
    path = decodeURIComponent(new URL(pick.pageUrl).pathname);
  } catch {
    path = "";
  }
  const nameWords = new Set(words(pick.name));
  const pathWords = new Set([...words(path), ...words(pick.category ?? "")]);
  const scored = types
    .filter(t => !t.requiresAttachment && !/^misc/i.test(t.name.trim()))
    .map(t => {
      const tw = [...new Set(words(t.name))];
      const score = tw.reduce((s, w) => s + (nameWords.has(w) ? 2 : pathWords.has(w) ? 1 : 0), 0);
      return { t, score };
    })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0 || (scored.length > 1 && scored[1].score === scored[0].score)) return null;
  return scored[0].t;
}

// What a pick added to the quote list remembers about where it came from.
export interface VendorPickSource {
  id: string;
  pageUrl: string;
  vendorDomain: string;
  imageUrl: string;
  priceMissing: boolean; // the vendor page showed no price; the rep enters the list price
}

// The quote-list line for a pick on a product line. Whatever the vendor page did not give (Type, Model, Color, list
// price) stays blank for the rep to fill in on the quote list; missingDetails() lists it.
// NetSuite's Coll/Desc, the way reps fill it: the collection, then the description ("Cassidy Two Handle Widespread
// Bathroom Faucet"). Not repeated when the description already starts with it ("Cairn 27-1/2 inch ... sink").
export function collDesc(collection: string | undefined, description: string): string {
  const c = (collection ?? "").replace(/[®™]/g, "").trim();
  const d = description.trim();
  if (!c) return d.slice(0, 300);
  if (d.replace(/[®™]/g, "").toLowerCase().startsWith(c.toLowerCase())) return d.slice(0, 300);
  return `${c} ${d}`.trim().slice(0, 300);
}

export function quoteInputFromPick(pick: VendorPick, line: SpecialOrderProductLine, types: PickTypeOption[]): SpecialOrderInput {
  // const type = suggestType(pick, types);
  // The Type chosen in the extension's panel when it is one of the line's; otherwise the guess.
  const chosen = pick.typeId ? types.find(t => t.id === pick.typeId && !t.requiresAttachment) : undefined;
  const type = chosen ?? suggestType(pick, types);
  return {
    netsuiteId: line.netsuiteItemId,
    sku: line.sku || null,
    quantity: pick.quantity,
    details: {
      productLineId: line.id,
      productLineName: line.name.trim(),
      typeId: type?.id ?? "",
      typeName: type?.name.trim() ?? "",
      model: pick.model,
      // description: pick.name,
      description: collDesc(pick.collection, pick.description || pick.name),
      color: pick.color,
      listPrice: pick.price ?? 0,
    },
    priceBasis: "retail",
    vendorPick: {
      id: pick.id,
      pageUrl: pick.pageUrl,
      vendorDomain: pick.vendorDomain,
      imageUrl: pick.imageUrl,
      priceMissing: pick.price == null,
    },
  };
}

// The details a special-order line still needs before it can go to an estimate (only picks can lack them).
export function missingDetails(item: { specialOrder?: SpecialOrderDetails; vendorPick?: VendorPickSource }): string[] {
  const so = item.specialOrder;
  if (!so) return [];
  const out: string[] = [];
  if (!so.typeId) out.push("Type");
  if (!so.model.trim()) out.push("Model");
  if (!so.color.trim()) out.push("Color");
  if (!so.description.trim()) out.push("Description");
  if (item.vendorPick?.priceMissing) out.push("List price");
  return out;
}

export function postToExtension(type: string, data: Record<string, unknown> = {}) {
  window.postMessage({ source: FROM_PAGE, type, ...data }, window.location.origin);
}
