import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, FilePlus2, Loader2, RefreshCw, Search, Send } from "lucide-react";
import type { EstimateLineInput } from "@workspace/api-client-react";
import { authHeaders } from "@/context/auth-context";
import type { QuoteItem } from "@/context/quote-list-context";
import { cn } from "@/lib/utils";
import { clearPendingSor, loadPendingSor, newAttemptId, orderDigits, savePendingSor, type PendingNewSor } from "@/lib/new-sor";
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

export interface NewSorCreated {
  sorId: string;
  sorNumber: string;
  soId: string;
  soTranId: string;
  customerName: string;
  itemsAdded: number;
  skippedNetsuiteIds: string[];
  workbenchUrl: string;
  specialOrderLines: Array<{ model: string; rate: number; quantity: number }>;
}

const MIN_DIGITS = 3;
// As the SOR push panel names them (NetSuite's list calls Draft "PENDING SUBMISSION").
const SOR_STATUS_LABEL: Record<string, string> = { "1": "Draft", "2": "Submitted", "3": "Processed", "5": "Cancelled", "6": "Check PO", "7": "Approved" };

export default function NewSorPanel({ buildItems, onCreated, onPushExisting, setPushResult, describe, warnFor, onPending }: {
  buildItems: () => { items: EstimateLineInput[]; snapshot: QuoteItem[] };
  onCreated: (created: NewSorCreated, pushed: QuoteItem[]) => Promise<void>;
  onPushExisting: (sor: SorResult) => Promise<void>;
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
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingNewSor<QuoteItem> | null>(null);
  const [note, setNote] = useState<string | null>(null);
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

  const finishCreated = useCallback(async (data: NewSorCreated, p: PendingNewSor<QuoteItem>) => {
    clearPendingSor();
    setPending(null);
    setNote(null);
    setSelected(null);
    const skipped = (data.skippedNetsuiteIds ?? []).map(String);
    await onCreated(data, p.snapshot.filter(i => !skipped.includes(String(i.netsuiteId))));
  }, [onCreated]);

  // Asks the server whether a Create whose answer was lost went through. Never guesses.
  const checkPending = useCallback(async (p: PendingNewSor<QuoteItem>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/sors/new/${encodeURIComponent(p.attemptId)}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) { await finishCreated(data, p); return; }
      if (data?.code === "NOT_FOUND") {
        setNote(`No new revision from your last Create on ${p.soTranId} yet, so your list is unchanged. If you just pressed it, check again in a moment; otherwise Start over.`);
        return;
      }
      setNote(typeof data?.error === "string" ? data.error : "Could not check. Try again.");
    } catch {
      setNote("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }, [finishCreated]);

  useEffect(() => {
    const p = loadPendingSor<QuoteItem>();
    if (!p) return;
    setPending(p);
    onPending?.();
    checkPending(p);
  }, []); // once, on mount

  const create = async () => {
    if (!selected || busy || selected.blocked) return;
    setPushResult(null);
    setNote(null);
    let built: { items: EstimateLineInput[]; snapshot: QuoteItem[] };
    try {
      built = buildItems();
    } catch (err: any) {
      setPushResult({ success: false, message: err?.message ?? "These items can't go on a revision yet." });
      return;
    }
    const p: PendingNewSor<QuoteItem> = {
      attemptId: newAttemptId(), soId: selected.id, soTranId: selected.tranId, snapshot: built.snapshot, startedAt: Date.now(),
    };
    savePendingSor(p);
    setPending(p);
    setBusy(true);
    let res: Response;
    try {
      res = await fetch("/api/sors/new", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ soId: p.soId, attemptId: p.attemptId, items: built.items }),
      });
    } catch {
      setBusy(false);
      setNote(`Lost contact with the server while starting the revision on ${p.soTranId}. Press Check again: your list changes only if NetSuite has the revision.`);
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) {
      setBusy(false);
      await finishCreated(data, p);
      return;
    }
    // A definite answer: nothing more is coming for this press.
    clearPendingSor();
    setPending(null);
    setBusy(false);
    const invalidIds: string[] = Array.isArray(data?.invalidNetsuiteIds) ? data.invalidNetsuiteIds : [];
    const message = invalidIds.length > 0
      ? `These items no longer exist in NetSuite and need to be removed from the list: ${invalidIds.map(id => describe(built.snapshot, id)).join(", ")}`
      : (typeof data?.error === "string" && data.error) || `No revision was started on ${p.soTranId}. Try again.`;
    setPushResult({
      success: false, message,
      ...(typeof data?.workbenchUrl === "string" && data.sorNumber ? { link: { href: data.workbenchUrl, label: `Open ${data.sorNumber} in NetSuite` } } : {}),
    });
    if (data?.offer || res.status === 409) runSearch(orderDigits(p.soTranId) ?? digits ?? "");
  };

  const pushExisting = async (sor: SorResult) => {
    setBusy(true);
    setPushResult(null);
    try {
      await onPushExisting(sor);
      if (digits && canSearch) runSearch(digits);
    } finally {
      setBusy(false);
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
          <button onClick={() => { clearPendingSor(); setPending(null); setNote(null); }} disabled={busy}
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
