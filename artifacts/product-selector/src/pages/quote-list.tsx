import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ChevronRight, Trash2, Minus, Plus, ClipboardList, Search, Loader2, Send, Check, AlertCircle, ImageOff, X, PackagePlus, Pencil } from "lucide-react";
import { useAddEstimateItems, useGetSpecialOrderProductLines, getGetSpecialOrderProductLinesQueryKey } from "@workspace/api-client-react";
import { specialOrderPrices, type SpecialOrderPrices } from "@/lib/special-order-pricing";
import { specialOrderLookupRetry } from "@/lib/special-order-query";
import type { EstimateLineInput } from "@workspace/api-client-react";
import SpecialOrderForm from "@/components/special-order-form";
import { useQuoteList, type PriceBasis, type QuoteItem } from "@/context/quote-list-context";
import { authHeaders } from "@/context/auth-context";
import { cn, fmtPrice } from "@/lib/utils";
import { getAnalyticsSessionId } from "@/lib/analytics";
import { missingDetails } from "@/lib/vendor-picks";

interface Estimate {
  id: number;
  tranId: string;
  customerName: string;
  status: string;
  date: string;
  total: number | null;
  customerCategory?: string; // "RETAIL", "CRD", ... (estimate's customer category)
  customerCategoryId?: string; // "1" = Retail; anything else is priced at CRD
}

function ProductImage({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-300">
        <ImageOff size={16} />
      </div>
    );
  }
  return <img src={src} alt={name} onError={() => setFailed(true)} className="w-full h-full object-contain" />;
}

function SpecialOrderRow({ item, prices, pricingFallback, editing, onEdit, onRemove, onQty }: {
  item: QuoteItem;
  prices: SpecialOrderPrices | null;
  pricingFallback: string;
  editing: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onQty: (q: number) => void;
}) {
  const so = item.specialOrder!;
  const id = item.productId;
  const basis = item.priceBasis ?? "retail";
  const basisLabel = basis === "retail" ? "Retail" : "CRD";
  const pick = item.vendorPick;
  const missing = missingDetails(item);
  const priceMissing = !!pick?.priceMissing;
  const needed = <span className="text-amber-700 font-medium">Needed</span>;
  return (
    <tr className={cn("transition-colors align-top", editing ? "bg-amber-50/70" : "hover:bg-gray-50/50")} data-testid={`row-special-order-${id}`}>
      <td className="px-5 py-3">
        {/* <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
          <PackagePlus size={18} className="text-amber-500" />
        </div> */}
        {pick?.imageUrl ? (
          <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
            <ProductImage src={pick.imageUrl} name={so.description || so.model} />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <PackagePlus size={18} className="text-amber-500" />
          </div>
        )}
      </td>
      <td className="px-5 py-3">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <p className="font-medium text-gray-900 text-[14px]">{so.productLineName}</p>
          <span className="text-[10px] font-semibold uppercase tracking-widest bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Special Order</span>
          {missing.length > 0 && (
            <button
              type="button"
              onClick={onEdit}
              className="text-[11px] font-semibold text-white bg-amber-600 hover:bg-amber-700 px-2 py-0.5 rounded"
              title="Open the form to fill in what is missing"
              data-testid={`button-finish-so-${id}`}
            >
              Needs {missing.join(", ")}
            </button>
          )}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
          <dt className="text-gray-400">Type</dt><dd className="text-gray-700" data-testid={`text-so-type-${id}`}>{so.typeName || needed}</dd>
          <dt className="text-gray-400">Model</dt><dd className="text-gray-700 break-words" data-testid={`text-so-model-${id}`}>{so.model || needed}</dd>
          <dt className="text-gray-400">Color</dt><dd className="text-gray-700 break-words" data-testid={`text-so-color-${id}`}>{so.color || needed}</dd>
          {/* 2026-11-06 (Gib): labeled "Coll/Desc" as in NetSuite. Was:
          <dt className="text-gray-400">Collection</dt> */}
          <dt className="text-gray-400">Coll/Desc</dt><dd className="text-gray-700 break-words whitespace-pre-line" data-testid={`text-so-description-${id}`}>{so.description || needed}</dd>
        </dl>
        {pick && (
          <p className="mt-1 text-[11px] text-gray-400">
            Picked on{" "}
            <a href={pick.pageUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">{pick.vendorDomain}</a>
          </p>
        )}
      </td>
      <td className="px-5 py-3">
        {item.sku ? <span className="font-mono text-[12px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{item.sku}</span> : <span className="text-gray-300">—</span>}
      </td>
      <td className="px-5 py-3 text-right whitespace-nowrap">
        {/* 2026-11-03: selling price as NetSuite calculates it, with list underneath. Was list price only:
        <span className="font-medium text-gray-900" data-testid={`text-so-list-price-${id}`}>${fmtPrice(so.listPrice)}</span>
        <p className="text-[10px] uppercase tracking-widest text-gray-400">List</p> */}
        {/* 2026-11-04: only the price the line is toggled to (Retail or CRD). Was both:
            <span className="font-medium text-gray-900" data-testid={`text-so-retail-price-${id}`}>${fmtPrice(prices.retail)}</span>
            <p className="text-[10px] uppercase tracking-widest text-gray-400">Retail</p>
            <p className="text-[11px] text-gray-500 mt-0.5" data-testid={`text-so-crd-price-${id}`}>CRD ${fmtPrice(prices.crd)}</p> */}
        {priceMissing ? (
          <p className="text-[11px] text-amber-700 font-medium" data-testid={`text-so-list-price-${id}`}>List price needed</p>
        ) : (
          <>
            {prices ? (
              <>
                <span className="font-medium text-gray-900" data-testid={`text-so-price-${id}`}>${fmtPrice(prices[basis])}</span>
                <p className="text-[10px] uppercase tracking-widest text-gray-400">{basisLabel}</p>
              </>
            ) : (
              <p className="text-[11px] text-gray-400">{pricingFallback}</p>
            )}
            <p className="text-[11px] text-gray-400" data-testid={`text-so-list-price-${id}`}>List ${fmtPrice(so.listPrice)}</p>
          </>
        )}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-center">
          <div className="flex items-center border border-gray-200 rounded-lg">
            <button onClick={() => item.quantity > 1 && onQty(item.quantity - 1)} disabled={item.quantity <= 1} aria-label="Decrease quantity" className="px-2 py-1.5 hover:bg-gray-50 text-gray-500 transition-colors rounded-l-lg disabled:opacity-40">
              <Minus size={12} />
            </button>
            <input
              type="number"
              min={1}
              max={1000000}
              aria-label={`Quantity for ${so.productLineName} ${so.model}`}
              value={item.quantity}
              onChange={e => {
                const v = parseInt(e.target.value);
                if (v >= 1 && v <= 1000000) onQty(v);
              }}
              className="w-12 text-center text-sm font-medium text-gray-900 border-x border-gray-200 py-1.5 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              data-testid={`input-so-qty-${id}`}
            />
            <button onClick={() => item.quantity < 1000000 && onQty(item.quantity + 1)} aria-label="Increase quantity" className="px-2 py-1.5 hover:bg-gray-50 text-gray-500 transition-colors rounded-r-lg">
              <Plus size={12} />
            </button>
          </div>
        </div>
      </td>
      <td className="px-5 py-3 text-right whitespace-nowrap">
        {/* 2026-11-03: extended selling price (rate x qty, as NetSuite). Was extended list:
        <span className="font-semibold text-gray-900">${fmtPrice(so.listPrice * item.quantity)}</span>
        <p className="text-[10px] uppercase tracking-widest text-gray-400">Ext. list</p> */}
        {/* 2026-11-04: only the toggled price. Was both:
            <span className="font-semibold text-gray-900" data-testid={`text-so-retail-total-${id}`}>${fmtPrice(prices.retail * item.quantity)}</span>
            <p className="text-[10px] uppercase tracking-widest text-gray-400">Retail</p>
            <p className="text-[11px] text-gray-500 mt-0.5">CRD ${fmtPrice(prices.crd * item.quantity)}</p> */}
        {priceMissing ? (
          <p className="text-[11px] text-gray-400">-</p>
        ) : (
          <>
            {prices ? (
              <>
                <span className="font-semibold text-gray-900" data-testid={`text-so-total-${id}`}>${fmtPrice(prices[basis] * item.quantity)}</span>
                <p className="text-[10px] uppercase tracking-widest text-gray-400">{basisLabel}</p>
              </>
            ) : (
              <p className="text-[11px] text-gray-400">{pricingFallback}</p>
            )}
            <p className="text-[11px] text-gray-400">List ${fmtPrice(so.listPrice * item.quantity)}</p>
          </>
        )}
      </td>
      <td className="px-5 py-3">
        <div className="flex flex-col gap-1">
          <button onClick={onEdit} aria-label="Edit special order" title="Edit special order" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all" data-testid={`button-edit-so-${id}`}>
            <Pencil size={14} />
          </button>
          <button onClick={onRemove} aria-label="Remove special order" title="Remove special order" className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" data-testid={`button-remove-so-${id}`}>
            <X size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// Estimate search: the number with or without the "ES" prefix ("ES241762", "es 241762", "241762").
// It starts by itself once at least 3 digits are typed.
const MIN_SEARCH_DIGITS = 3;
function estimateDigits(q: string): string | null {
  const s = q.replace(/\s+/g, "").replace(/^es?/i, ""); // "E" alone is the prefix being typed
  return /^\d*$/.test(s) ? s : null;
}

function EstimateSearch({ onPush, pushResult, setPushResult, warnFor }: {
  onPush: (estimateId: number, tranId: string) => Promise<void>;
  pushResult: { success: boolean; message: string } | null;
  setPushResult: (r: { success: boolean; message: string } | null) => void;
  warnFor?: (est: Estimate) => string | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Estimate[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Estimate | null>(null);
  const [pushing, setPushing] = useState(false);
  // The digits of the last search that finished, and its error, so "No estimates found" only shows for a real search.
  const [searchedFor, setSearchedFor] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const latestSearch = useRef(0);

  const digits = estimateDigits(query);
  const canSearch = digits !== null && digits.length >= MIN_SEARCH_DIGITS;

  const runSearch = useCallback(async (d: string) => {
    const id = ++latestSearch.current;
    setSearching(true);
    setSearchError(null);
    setSelected(null);
    setPushResult(null);
    try {
      const res = await fetch(`/api/estimates/search?q=${encodeURIComponent(d)}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (id !== latestSearch.current) return; // a newer search replaced this one
      if (res.ok) {
        setResults(data.estimates ?? []);
      } else {
        setResults([]);
        setSearchError(typeof data?.error === "string" ? data.error : `Search failed (${res.status}). Try again.`);
      }
      setSearchedFor(d);
    } catch {
      if (id !== latestSearch.current) return;
      setResults([]);
      setSearchError("Could not reach the server. Try again.");
      setSearchedFor(d);
    } finally {
      if (id === latestSearch.current) setSearching(false);
    }
  }, [setPushResult]);

  // Search as you type, once 3 digits are in (short pause so each keystroke is not a NetSuite call).
  useEffect(() => {
    if (!canSearch || digits === null) {
      latestSearch.current++;
      setResults([]);
      setSearchedFor(null);
      setSearchError(null);
      setSearching(false);
      return;
    }
    const t = setTimeout(() => runSearch(digits), 350);
    return () => clearTimeout(t);
  }, [digits, canSearch, runSearch]);

  // Was: searched on Enter / button only, with any text; "No estimates found" showed while typing.
  // const handleSearch = async () => {
  //   if (!query.trim()) return;
  //   setSearching(true);
  //   setSelected(null);
  //   setPushResult(null);
  //   try {
  //     const res = await fetch(`/api/estimates/search?q=${encodeURIComponent(query.trim())}`, { headers: authHeaders() });
  //     const data = await res.json();
  //     if (res.ok) {
  //       setResults(data.estimates ?? []);
  //     } else {
  //       setResults([]);
  //       if (typeof data?.error === "string") setPushResult({ success: false, message: data.error });
  //     }
  //   } catch {
  //     setResults([]);
  //   } finally {
  //     setSearching(false);
  //   }
  // };
  const handleSearch = () => {
    if (canSearch && digits !== null) runSearch(digits);
  };

  const handlePush = async () => {
    if (!selected) return;
    setPushing(true);
    setPushResult(null);
    try {
      await onPush(selected.id, selected.tranId);
    } catch (err: any) {
      setPushResult({ success: false, message: err?.message ?? "Failed to add items to estimate" });
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="px-6 py-5 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-[15px] mb-1">Push to NetSuite Estimate</h3>
        <p className="text-[13px] text-gray-400">Search for an existing estimate to add these items to it.</p>
      </div>

      <div className="px-6 py-4">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Estimate # (ES optional), e.g. ES241762 or 241762"
              inputMode="search"
              aria-label="Estimate number"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 focus:bg-white transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !canSearch}
            className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
        </div>

        {results.length > 0 && (
          <div className="border border-gray-100 rounded-xl overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left w-8"></th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left">Estimate #</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left">Customer</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left">Status</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left">Date</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map(est => {
                  const isOpen = est.status.toLowerCase().includes("open");
                  const isSelected = selected?.id === est.id;
                  return (
                    <tr
                      key={est.id}
                      onClick={() => isOpen && setSelected(est)}
                      className={cn(
                        "transition-colors",
                        isOpen ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                        isSelected ? "bg-amber-50" : isOpen ? "hover:bg-gray-50" : ""
                      )}
                      title={isOpen ? undefined : "Only open estimates can receive items"}
                    >
                      <td className="px-4 py-2.5">
                        {isOpen ? (
                          <span className={cn(
                            "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                            isSelected ? "bg-amber-500 border-amber-500" : "border-gray-300"
                          )}>
                            {isSelected && <Check size={10} className="text-white" />}
                          </span>
                        ) : (
                          <span className="w-4 h-4 rounded-full border-2 border-gray-200 bg-gray-100 flex items-center justify-center shrink-0" />
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-medium text-gray-900">{est.tranId}</td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {est.customerName}
                        {est.customerCategory && (
                          <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400" data-testid={`text-estimate-category-${est.id}`}>{est.customerCategory}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn(
                          "text-[11px] font-medium px-2 py-0.5 rounded-full",
                          isOpen ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                        )}>
                          {est.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{est.date}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                        {est.total != null ? `$${fmtPrice(est.total)}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Was: shown whenever the box had text, before any search ran.
        {results.length === 0 && !searching && query.trim() && (
          <p className="text-sm text-gray-400 text-center py-4">No estimates found for "{query}"</p>
        )} */}
        {query.trim() && digits === null && (
          <p className="text-sm text-gray-400 text-center py-4" data-testid="text-estimate-search-hint">Enter an estimate number, like ES241762 or 241762.</p>
        )}
        {digits !== null && query.trim() && digits.length < MIN_SEARCH_DIGITS && (
          <p className="text-sm text-gray-400 text-center py-4" data-testid="text-estimate-search-hint">Type at least {MIN_SEARCH_DIGITS} digits of the estimate number to search (the ES is optional).</p>
        )}
        {searchError && canSearch && !searching && (
          <p className="text-sm text-red-600 text-center py-4" role="alert" data-testid="text-estimate-search-error">{searchError}</p>
        )}
        {results.length === 0 && !searching && !searchError && canSearch && searchedFor === digits && (
          <p className="text-sm text-gray-400 text-center py-4">No estimates found for "{query.trim()}"</p>
        )}

        {selected && (
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <div className="text-sm">
              <span className="text-gray-500">Selected: </span>
              <span className="font-medium text-gray-900">{selected.tranId}</span>
              {/* Was: the customer name only, after a long-dash separator. */}
              <span className="text-gray-400"> - {selected.customerName}{selected.customerCategory ? ` (${selected.customerCategory})` : ""}</span>
            </div>
            <button
              onClick={handlePush}
              disabled={pushing}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {pushing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Push Items to Estimate
            </button>
          </div>
        )}
        {selected && warnFor?.(selected) && (
          <div className="mt-2 flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-800" role="status" data-testid="text-price-basis-warning">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{warnFor(selected)}</span>
          </div>
        )}

      </div>
    </div>
  );
}

export default function QuoteListPage() {
  const { items, removeItem, updateQuantity, clearList, totalItems, grandTotal, addSpecialOrder, updateSpecialOrder, removeExactItems } = useQuoteList();
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null);
  const [formMode, setFormMode] = useState<{ kind: "add" } | { kind: "edit"; item: QuoteItem } | null>(null);
  const addEstimateItems = useAddEstimateItems();

  const itemsMissingNsId = items.filter(i => !i.netsuiteId);
  const specialItems = items.filter(i => i.specialOrder);
  const specialListTotal = specialItems.reduce((s, i) => s + (i.specialOrder?.listPrice ?? 0) * i.quantity, 0);

  // Special-order selling prices, from the product lines' NetSuite multipliers (same math as the push).
  const productLines = useGetSpecialOrderProductLines({
    query: { queryKey: getGetSpecialOrderProductLinesQueryKey(), enabled: specialItems.length > 0, ...specialOrderLookupRetry },
  });
  const pricesFor = (item: QuoteItem): SpecialOrderPrices | null => {
    const so = item.specialOrder;
    const line = so && productLines.data?.find(l => l.id === so.productLineId && l.netsuiteItemId === item.netsuiteId);
    return so && line ? specialOrderPrices(so.listPrice, line) : null;
  };
  const pricingFallback = productLines.isLoading ? "Pricing..." : "Price unavailable";
  const cents = (n: number) => Math.round(n * 100) / 100;
  const specialPriced = specialItems.map(i => ({ item: i, prices: pricesFor(i) }));
  const allSpecialsPriced = specialPriced.every(p => p.prices);
  // 2026-11-04: each line at the price it is toggled to (Retail or CRD). Was separate Retail and CRD totals:
  // const specialRetailTotal = specialPriced.reduce((s, p) => s + (p.prices ? cents(p.prices.retail * p.item.quantity) : 0), 0);
  // const specialCrdTotal = specialPriced.reduce((s, p) => s + (p.prices ? cents(p.prices.crd * p.item.quantity) : 0), 0);
  const specialTotal = specialPriced.reduce(
    (s, p) => s + (p.prices ? cents(p.prices[p.item.priceBasis ?? "retail"] * p.item.quantity) : 0), 0);

  // Before a push: lines toggled to the other price than the chosen estimate's customer gets in NetSuite.
  const basisWarning = (est: Estimate): string | null => {
    if (!est.customerCategoryId) return null;
    const estimateBasis: PriceBasis = est.customerCategoryId === "1" ? "retail" : "crd";
    const off = specialItems.filter(i => (i.priceBasis ?? "retail") !== estimateBasis);
    if (off.length === 0) return null;
    const label = estimateBasis === "retail" ? "Retail" : "CRD";
    return `${est.tranId} is a ${est.customerCategory || label} customer, so NetSuite prices special orders at ${label}. ` +
      `${off.length} special order${off.length === 1 ? " is" : "s are"} shown at the other price here and will be pushed at ${label}.`;
  };

  const describe =(snapshot: QuoteItem[], id: string) => {
    const matches = snapshot.filter(i => String(i.netsuiteId) === String(id));
    if (matches.length === 0) return `NetSuite ID ${id}`;
    return matches.map(i => i.specialOrder ? `${i.specialOrder.productLineName} special order (${i.specialOrder.model})` : (i.sku ?? i.name)).join(", ");
  };

  // Special orders added from vendor websites that still lack a Type, Model, Color or list price.
  const unfinished = specialItems.filter(i => missingDetails(i).length > 0);
  const unfinishedText = `${unfinished.length} special order${unfinished.length === 1 ? "" : "s"} from vendor websites need${unfinished.length === 1 ? "s" : ""} details`;

  const handlePushToEstimate = async (estimateId: number, tranId: string) => {
    if (unfinished.length > 0) {
      throw new Error(`${unfinishedText} before pushing: click the amber "Needs ..." on each one and fill in what is missing.`);
    }
    const snapshot = items.filter(i => i.netsuiteId);
    if (snapshot.length === 0) {
      throw new Error("No items with valid NetSuite IDs to push");
    }
    const payloadItems: EstimateLineInput[] = snapshot.map(i => ({
      netsuiteId: i.netsuiteId,
      quantity: i.quantity,
      ...(i.price != null ? { analyticsUnitPrice: i.price } : {}),
      ...(i.specialOrder && i.vendorPick ? { analyticsVendorPick: {
        pickId: i.vendorPick.id, visitId: i.vendorPick.visitId,
        vendorDomain: i.vendorPick.vendorDomain,
      } } : {}),
      ...(i.specialOrder ? { specialOrder: { ...i.specialOrder } } : {}),
    }));

    let data;
    try {
      data = await addEstimateItems.mutateAsync({
        estimateId,
        data: { items: payloadItems, analyticsSessionId: getAnalyticsSessionId() },
      });
    } catch (err: any) {
      const body = err?.data ?? {};
      const invalidIds: string[] = Array.isArray(body?.invalidNetsuiteIds) ? body.invalidNetsuiteIds : [];
      if (invalidIds.length > 0) {
        throw new Error(`These items no longer exist in NetSuite and need to be removed from the list: ${invalidIds.map(id => describe(snapshot, id)).join(", ")}`);
      }
      throw new Error((typeof body?.error === "string" && body.error) || err?.message || "Failed to add items to estimate");
    }

    const skipped = (data?.skippedNetsuiteIds ?? []).map(String);
    const pushed = snapshot.filter(i => !skipped.includes(String(i.netsuiteId)));
    const added = data?.itemsAdded ?? pushed.length;
    let msg = `Successfully added ${added} item${added === 1 ? "" : "s"} to estimate ${data?.tranId || tranId}`;
    if (skipped.length > 0) {
      msg += ` - skipped (no longer in NetSuite, kept in your list):${skipped.map(id => describe(snapshot, id)).join(", ")}`;
    }
    const pricedSpecials = data?.specialOrderLines ?? [];
    if (pricedSpecials.length > 0) {
      msg += `. Special orders priced at ${pricedSpecials.map(l => `${l.model} $${fmtPrice(l.rate)}${l.quantity > 1 ? ` x ${l.quantity}` : ""}`).join(", ")}`;
    }
    setPushResult({ success: true, message: msg });
    removeExactItems(pushed);
  };

  const formPanel = formMode && (
    <SpecialOrderForm
      key={formMode.kind === "edit" ? formMode.item.productId : "add"}
      initial={formMode.kind === "edit" ? formMode.item : undefined}
      onCancel={() => setFormMode(null)}
      onSubmit={input => {
        if (formMode.kind === "edit") updateSpecialOrder(formMode.item.productId, input);
        else addSpecialOrder(input);
        setFormMode(null);
      }}
    />
  );

  const addSpecialButton = (
    <button
      onClick={() => setFormMode({ kind: "add" })}
      disabled={formMode?.kind === "add"}
      className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50"
      data-testid="button-add-special-order"
    >
      <PackagePlus size={14} className="text-amber-500" />
      Add Special Order
    </button>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-10">
      <nav className="flex items-center gap-1 text-[12px] text-gray-400 mb-6">
        <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
        <ChevronRight size={11} className="text-gray-300" />
        <span className="text-gray-600">Quote List</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList size={24} className="text-amber-500" />
            Quote List
          </h1>
        </div>
        <div className="flex items-center gap-2">
        {addSpecialButton}
        {items.length > 0 && (
          <button
            onClick={clearList}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <Trash2 size={12} />
            Clear List
          </button>
        )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="space-y-6">
          {pushResult && (
            <div className={cn(
              "flex items-center gap-2 px-5 py-4 rounded-2xl text-sm font-medium",
              pushResult.success ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
            )}>
              {pushResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{pushResult.message}</span>
              <button onClick={() => setPushResult(null)} className="ml-auto p-1 hover:opacity-70 transition-opacity">
                <X size={14} />
              </button>
            </div>
          )}
          {formPanel}
          <div className="py-32 text-center bg-white rounded-2xl shadow-sm flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-5">
              {pushResult?.success ? (
                <Check size={24} className="text-emerald-400" />
              ) : (
                <ClipboardList size={24} className="text-gray-300" />
              )}
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">
              {pushResult?.success ? "Items submitted successfully" : "Your quote list is empty"}
            </h3>
            <p className="text-sm text-gray-400 max-w-xs mx-auto mb-6">
              {pushResult?.success
                ? "Your items have been added to the estimate. Start a new list or continue browsing."
                : "Browse products and add them to your list to create a quote."}
            </p>
            <Link
              href="/"
              className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
            >
              Browse Products
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {pushResult?.success && (
            <div className="flex items-center gap-2 px-5 py-4 rounded-2xl text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200" role="status">
              <Check size={16} className="shrink-0" />
              <span>{pushResult.message}</span>
              <button onClick={() => setPushResult(null)} aria-label="Dismiss message" className="ml-auto p-1 hover:opacity-70 transition-opacity">
                <X size={14} />
              </button>
            </div>
          )}
          {formPanel}
          {unfinished.length > 0 && (
            <div className="flex items-start gap-2 px-5 py-3 rounded-2xl text-sm bg-amber-50 text-amber-900 border border-amber-200" role="status" data-testid="banner-unfinished-special-orders">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>
                {unfinishedText}. The vendor page did not show everything NetSuite needs: click the amber <b>Needs ...</b> on
                each one, fill in what is missing and click <b>Save Changes</b>. They can be pushed to an estimate after that.
              </span>
            </div>
          )}
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 w-16"></th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Product</th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 w-[120px]">SKU</th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-right w-[100px]">Price</th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-center w-[140px]">Qty</th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-right w-[100px]">Total</th>
                    <th className="px-5 py-3.5 w-[50px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map(item => item.specialOrder ? (
                    <SpecialOrderRow
                      key={item.productId}
                      item={item}
                      prices={pricesFor(item)}
                      pricingFallback={pricingFallback}
                      editing={formMode?.kind === "edit" && formMode.item.productId === item.productId}
                      onEdit={() => setFormMode({ kind: "edit", item })}
                      onRemove={() => { removeItem(item.productId); if (formMode?.kind === "edit" && formMode.item.productId === item.productId) setFormMode(null); }}
                      onQty={q => updateQuantity(item.productId, q)}
                    />
                  ) : (
                    <tr key={item.productId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                          <ProductImage src={item.imageUrl} name={item.name} />
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900 text-[14px]">{item.name}</p>
                      </td>
                      <td className="px-5 py-3">
                        {item.sku ? (
                          <span className="font-mono text-[12px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{item.sku}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {item.price != null ? (
                          <span className="font-medium text-gray-900">${fmtPrice(item.price)}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center">
                          <div className="flex items-center border border-gray-200 rounded-lg">
                            <button
                              onClick={() => item.quantity <= 1 ? removeItem(item.productId) : updateQuantity(item.productId, item.quantity - 1)}
                              className="px-2 py-1.5 hover:bg-gray-50 text-gray-500 transition-colors rounded-l-lg"
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={e => {
                                const v = parseInt(e.target.value);
                                if (v >= 1) updateQuantity(item.productId, v);
                              }}
                              className="w-12 text-center text-sm font-medium text-gray-900 border-x border-gray-200 py-1.5 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                              className="px-2 py-1.5 hover:bg-gray-50 text-gray-500 transition-colors rounded-r-lg"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {item.price != null ? (
                          <span className="font-semibold text-gray-900">${fmtPrice(item.price * item.quantity)}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Remove item"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  {/* 2026-11-04: one Grand Total row (Gib: "remove catalog total"). Was a Catalog Total row (catalog items
                      only, "Grand Total" when there were no special orders) plus a separate Grand Total row below:
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={4} className="px-5 py-4 text-right">
                      <span className="text-[13px] font-semibold uppercase tracking-widest text-gray-500">{specialItems.length > 0 ? "Catalog Total" : "Grand Total"}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-sm font-semibold text-gray-900">{totalItems} units</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-lg font-bold text-gray-900">${fmtPrice(grandTotal)}</span>
                    </td>
                    <td></td>
                  </tr> */}
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={4} className="px-5 py-4 text-right">
                      <span className="text-[13px] font-semibold uppercase tracking-widest text-gray-500">Grand Total</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-sm font-semibold text-gray-900">{totalItems} units</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {/* Catalog items plus special orders at each line's Retail / CRD price. */}
                      {allSpecialsPriced ? (
                        <span className="text-lg font-bold text-gray-900" data-testid="text-grand-total">${fmtPrice(grandTotal + specialTotal)}</span>
                      ) : (
                        <span className="text-sm text-gray-400">{pricingFallback}</span>
                      )}
                    </td>
                    <td></td>
                  </tr>
                  {/* 2026-11-03: special orders shown at NetSuite's selling price and added to the total. Was list only:
                  {specialItems.length > 0 && (
                    <tr className="bg-amber-50/60">
                      <td colSpan={5} className="px-5 py-3 text-right text-[12px] text-amber-800">
                        Special orders: {specialItems.length} line{specialItems.length === 1 ? "" : "s"}, list amount ${fmtPrice(specialListTotal)} (not included above). Selling prices are calculated from the customer's Retail or CRD multipliers when pushed to an estimate.
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-medium text-amber-900 whitespace-nowrap">${fmtPrice(specialListTotal)} list</td>
                      <td></td>
                    </tr>
                  )} */}
                  {/* 2026-11-04: special-orders summary row removed (Gib); each line shows its own price instead.
                  {specialItems.length > 0 && (
                    <tr className="bg-amber-50/60">
                      <td colSpan={5} className="px-5 py-3 text-right text-[12px] text-amber-800" data-testid="text-special-order-summary">
                        Special orders: {specialItems.length} line{specialItems.length === 1 ? "" : "s"}, priced the same as NetSuite (list ${fmtPrice(specialListTotal)} x product line multipliers).
                        {allSpecialsPriced
                          ? ` Retail $${fmtPrice(specialRetailTotal)}, CRD $${fmtPrice(specialCrdTotal)}. A CRD customer's estimate gets the CRD price.`
                          : " Some prices are not available yet."}
                      </td>
                      <td className="px-5 py-3 text-right text-sm font-medium text-amber-900 whitespace-nowrap">
                        {allSpecialsPriced ? `$${fmtPrice(specialRetailTotal)}` : `$${fmtPrice(specialListTotal)} list`}
                      </td>
                      <td></td>
                    </tr>
                  )} */}
                  {/* 2026-11-04: folded into the single Grand Total row above.
                  {specialItems.length > 0 && allSpecialsPriced && (
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={5} className="px-5 py-4 text-right">
                        <span className="text-[13px] font-semibold uppercase tracking-widest text-gray-500">Grand Total</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="text-lg font-bold text-gray-900" data-testid="text-grand-total">${fmtPrice(grandTotal + specialTotal)}</span>
                      </td>
                      <td></td>
                    </tr>
                  )} */}
                </tfoot>
              </table>
            </div>
          </div>

          {pushResult && (
            <div className={cn(
              "flex items-center gap-2 px-5 py-4 rounded-2xl text-sm font-medium border",
              pushResult.success ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200",
            )}>
              {pushResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{pushResult.message}</span>
              <button onClick={() => setPushResult(null)} className="ml-auto p-1 hover:opacity-70 transition-opacity">
                <X size={14} />
              </button>
            </div>
          )}

          {itemsMissingNsId.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
              <AlertCircle size={14} className="shrink-0" />
              {itemsMissingNsId.length} {itemsMissingNsId.length === 1 ? "item" : "items"} missing NetSuite ID and will be skipped when pushing to an estimate.
            </div>
          )}

          <EstimateSearch onPush={handlePushToEstimate} pushResult={pushResult} setPushResult={setPushResult} warnFor={basisWarning} />
        </div>
      )}
    </div>
  );
}
