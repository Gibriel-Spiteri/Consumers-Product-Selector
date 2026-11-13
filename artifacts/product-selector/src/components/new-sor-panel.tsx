import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, FilePlus2, Loader2, RefreshCw, Search, Send } from "lucide-react";
import type { EstimateLineInput } from "@workspace/api-client-react";
import { authHeaders } from "@/context/auth-context";
import type { QuoteItem } from "@/context/quote-list-context";
import { cn } from "@/lib/utils";
import { orderDigits } from "@/lib/new-sor";
import { useNewSor, type NewSorCreated } from "@/hooks/use-new-sor";
import type { SorResult } from "@/components/sor-push-panel";

/*
 * New SOR (2026-11-12). Gib: "add 'New SOR' just like we have 'New Estimate' so they do not have to create and then
 * save a SOR just to be able to push their shopping cart to the SOR."
 *
 * The rep finds the Sales Order; Create SOR starts a Draft revision on it (as the order's New Revision button does)
 * with the Quote List lines already on it, priced as the SOR push prices them, then NetSuite recalculates it. Orders
 * that can't take a revision say why; when the reason is an open Draft revision, the rep can push to that one instead.
 */
export interface OrderResult {
  id: string;
  tranId: string;
  status: string;
  statusText: string;
  customerName: string;
  customerCategoryId: string | null;
  customerCategory: string | null;
  openSor: SorResult | null;
  blocked: string | null;
  offer: SorResult | null;
}

// Was: NewSorCreated was declared here; it lives in hooks/use-new-sor.ts now.
export type { NewSorCreated };

const MIN_DIGITS = 3;
// As the SOR push panel names them (NetSuite's list calls Draft "PENDING SUBMISSION").
const SOR_STATUS_LABEL: Record<string, string> = { "1": "Draft", "2": "Submitted", "3": "Processed", "5": "Cancelled", "6": "Check PO", "7": "Approved" };

export default function NewSorPanel({ buildItems, onCreated, onPushExisting, setPushResult, describe, warnFor, onPending }: {
  buildItems: () => { items: EstimateLineInput[]; snapshot: QuoteItem[] };
  onCreated: (created: NewSorCreated, pushed: QuoteItem[]) => Promise<void>;
  onPushExisting: (sor: SorResult) => Promise<unknown>; // was Promise<void> (2026-11-13)
  setPushResult: (r: { success: boolean; message: string; link?: { href: string; label: string } } | null) => void;
  describe: (snapshot: QuoteItem[], netsuiteId: string) => string;
  warnFor?: (order: { tranId: string; customerCategory?: string; customerCategoryId?: string }) => string | null;
  /** A Create from before the page was left or reloaded has no answer yet: show this panel. */
  onPending?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OrderResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OrderResult | null>(null);
  const [pushing, setPushing] = useState(false);
  const latest = useRef(0);

  const digits = orderDigits(query);
  const canSearch = digits !== null && digits.length >= MIN_DIGITS;

  const runSearch = useCallback(async (d: string) => {
    const id = ++latest.current;
    setSearching(true);
    setSearchError(null);
    setSelected(null);
    try {
      const res = await fetch(`/api/sors/orders/search?q=${encodeURIComponent(d)}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (id !== latest.current) return;
      if (res.ok) setResults(Array.isArray(data.orders) ? data.orders : []);
      else {
        setResults([]);
        setSearchError(typeof data?.error === "string" ? data.error : `Search failed (${res.status}). Try again.`);
      }
      setSearchedFor(d);
    } catch {
      if (id !== latest.current) return;
      setResults([]);
      setSearchError("Could not reach the server. Try again.");
      setSearchedFor(d);
    } finally {
      if (id === latest.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!canSearch || digits === null) {
      latest.current++;
      setResults([]);
      setSearchedFor(null);
      setSearchError(null);
      setSearching(false);
      return;
    }
    const t = setTimeout(() => runSearch(digits), 350);
    return () => clearTimeout(t);
  }, [digits, canSearch, runSearch]);

  // 2026-11-13: the create / check-again flow moved into hooks/use-new-sor.ts unchanged (the one search box uses it too).
  const newSor = useNewSor({
    buildItems, onCreated, setPushResult, describe, onPending,
    onRefused: soTranId => runSearch(orderDigits(soTranId) ?? digits ?? ""),
    onSuccess: () => setSelected(null),
  });
  const { pending, note, checkPending, startOver } = newSor;
  const busy = newSor.busy || pushing;
  const create = () => { if (selected && !selected.blocked) newSor.create(selected); };

  const pushExisting = async (sor: SorResult) => {
    setPushing(true);
    setPushResult(null);
    try {
      await onPushExisting(sor);
      if (digits && canSearch) runSearch(digits);
    } finally {
      setPushing(false);
    }
  };

  const basis = selected && !selected.blocked && warnFor?.({
    tranId: selected.tranId,
    customerCategory: selected.customerCategory ?? undefined,
    customerCategoryId: selected.customerCategoryId ?? undefined,
  });

  return (
    <div className="px-6 py-4" data-testid="panel-new-sor">
      {pending && note && (
        <div className="mb-4 flex flex-wrap items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-800" role="status">
          <AlertCircle size={14} className="shrink-0" />
          <span className="flex-1 min-w-[200px]">{note}</span>
          <button onClick={() => checkPending(pending)} disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 rounded-lg font-medium hover:bg-amber-100 disabled:opacity-50"
            data-testid="button-new-sor-check">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Check again
          </button>
          <button onClick={startOver} disabled={busy}
            className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg font-medium hover:bg-amber-100 disabled:opacity-50"
            data-testid="button-new-sor-start-over">
            Start over
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Sales Order #, e.g. SO714729 or 714729"
            inputMode="search"
            aria-label="Sales Order number"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && canSearch && digits !== null && runSearch(digits)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 focus:bg-white transition-all"
            data-testid="input-new-sor-search"
          />
        </div>
        <button
          onClick={() => canSearch && digits !== null && runSearch(digits)}
          disabled={searching || !canSearch}
          className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Search
        </button>
      </div>

      {results.length > 0 && (
        <div className="border border-gray-100 rounded-xl overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 w-8"></th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left">Sales Order</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left">Customer</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left">Order Status</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left">Open Revision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {results.map(order => {
                const ok = !order.blocked;
                const isSelected = selected?.id === order.id;
                return (
                  <tr
                    key={order.id}
                    onClick={() => setSelected(order)}
                    className={cn("cursor-pointer transition-colors", isSelected ? "bg-amber-50" : "hover:bg-gray-50", !ok && !isSelected ? "opacity-70" : "")}
                    title={order.blocked ?? undefined}
                    data-testid={`row-order-${order.id}`}
                  >
                    <td className="px-4 py-2.5">
                      <span className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                        isSelected ? "bg-amber-500 border-amber-500" : ok ? "border-gray-300" : "border-gray-200 bg-gray-100")}>
                        {isSelected && <Check size={10} className="text-white" />}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-medium text-gray-900">{order.tranId}</td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {order.customerName}
                      {order.customerCategory && (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">{order.customerCategory}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{order.statusText}</td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {order.openSor ? <span className="font-mono">{order.openSor.number}</span> : "-"}
                      {order.openSor && <span className="ml-1 text-[12px] text-gray-400">{SOR_STATUS_LABEL[order.openSor.status] ?? order.openSor.statusText}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {query.trim() && digits === null && (
        <p className="text-sm text-gray-400 text-center py-4">Enter a Sales Order number, like SO714729 or 714729.</p>
      )}
      {digits !== null && query.trim() && digits.length < MIN_DIGITS && (
        <p className="text-sm text-gray-400 text-center py-4">Type at least {MIN_DIGITS} digits of the Sales Order number.</p>
      )}
      {searchError && canSearch && !searching && (
        <p className="text-sm text-red-600 text-center py-4" role="alert">{searchError}</p>
      )}
      {results.length === 0 && !searching && !searchError && canSearch && searchedFor === digits && (
        <p className="text-sm text-gray-400 text-center py-4">No Sales Orders found for "{query.trim()}".</p>
      )}

      {selected && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 rounded-xl px-4 py-3">
          <div className="text-sm">
            <span className="text-gray-500">Selected: </span>
            <span className="font-medium text-gray-900">{selected.tranId}</span>
            <span className="text-gray-400"> - {selected.customerName}{selected.customerCategory ? ` (${selected.customerCategory})` : ""}</span>
          </div>
          {selected.offer ? (
            <button
              onClick={() => pushExisting(selected.offer!)}
              disabled={busy}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
              data-testid="button-new-sor-push-existing"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Push to {selected.offer.number} instead
            </button>
          ) : (
            <button
              onClick={create}
              disabled={busy || !!selected.blocked || !!pending}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
              data-testid="button-new-sor-create"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <FilePlus2 size={14} />}
              {busy ? "Starting the revision..." : "Create SOR with these items"}
            </button>
          )}
        </div>
      )}
      {selected?.blocked && (
        <div className="mt-2 flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-800" role="status" data-testid="text-new-sor-blocked">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{selected.blocked}{selected.offer?.warning ? ` ${selected.offer.warning}` : ""}</span>
        </div>
      )}
      {basis && (
        <div className="mt-2 flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-800" role="status">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{basis}</span>
        </div>
      )}
    </div>
  );
}
