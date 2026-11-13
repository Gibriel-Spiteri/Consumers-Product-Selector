import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, Search, Send } from "lucide-react";
import { authHeaders } from "@/context/auth-context";
import { cn, fmtPrice } from "@/lib/utils";
import { sorDigits } from "@/lib/sor-push";

/*
 * Push to a Sales Order Revision (2026-11-09, Gib: "We'd like for the CPS to also be able to add items to SORs").
 * The rep finds the revision by its SOR number or its Sales Order number. Only a Draft revision that is not signed
 * or out for signature takes items; the server says why for every other one (api-server lib/sorPush.ts).
 */
export interface SorResult {
  id: string;
  number: string;
  status: string;
  statusText: string;
  soId: string;
  soTranId: string;
  customerName: string;
  customerCategoryId: string | null;
  customerCategory: string | null;
  created: string | null;
  lastPrinted: string | null;
  signing: string | null;
  newTotal: number | null;
  blocked: string | null;
  warning: string | null;
}

const MIN_DIGITS = 3;

const STATUS_LABEL: Record<string, string> = { "1": "Draft", "2": "Submitted", "3": "Processed", "5": "Cancelled", "6": "Check PO", "7": "Approved" };

export default function SorPushPanel({ onPush, setPushResult, warnFor }: {
  onPush: (sor: SorResult) => Promise<unknown>; // was Promise<void>; the push now answers whether it worked (2026-11-13)
  setPushResult: (r: null) => void;
  warnFor?: (sor: { tranId: string; customerCategory?: string; customerCategoryId?: string }) => string | null;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SorResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SorResult | null>(null);
  const [pushing, setPushing] = useState(false);
  const latest = useRef(0);

  const digits = sorDigits(query);
  const canSearch = digits !== null && digits.length >= MIN_DIGITS;

  const runSearch = useCallback(async (d: string) => {
    const id = ++latest.current;
    setSearching(true);
    setSearchError(null);
    setSelected(null);
    setPushResult(null);
    try {
      const res = await fetch(`/api/sors/search?q=${encodeURIComponent(d)}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (id !== latest.current) return;
      if (res.ok) setResults(Array.isArray(data.sors) ? data.sors : []);
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
  }, [setPushResult]);

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

  const handlePush = async () => {
    if (!selected) return;
    setPushing(true);
    setPushResult(null);
    try {
      await onPush(selected);
      // The revision changed: search again so its total and printed note are current.
      if (digits && canSearch) runSearch(digits);
    } finally {
      setPushing(false);
    }
  };

  const basis = selected && warnFor?.({
    tranId: selected.number,
    customerCategory: selected.customerCategory ?? undefined,
    customerCategoryId: selected.customerCategoryId ?? undefined,
  });

  return (
    <div className="px-6 py-4" data-testid="panel-sor-push">
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="SOR # or Sales Order #, e.g. SOR230 or SO714882"
            inputMode="search"
            aria-label="SOR or Sales Order number"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && canSearch && digits !== null && runSearch(digits)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 focus:bg-white transition-all"
            data-testid="input-sor-search"
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
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left">SOR #</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left">Sales Order</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left">Customer</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left">Status</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-right">Proposed Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {results.map(sor => {
                const open = !sor.blocked;
                const isSelected = selected?.id === sor.id;
                return (
                  <tr
                    key={sor.id}
                    onClick={() => open && setSelected(sor)}
                    className={cn("transition-colors", open ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                      isSelected ? "bg-amber-50" : open ? "hover:bg-gray-50" : "")}
                    title={sor.blocked ?? undefined}
                    data-testid={`row-sor-${sor.id}`}
                  >
                    <td className="px-4 py-2.5">
                      <span className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                        !open ? "border-gray-200 bg-gray-100" : isSelected ? "bg-amber-500 border-amber-500" : "border-gray-300")}>
                        {isSelected && <Check size={10} className="text-white" />}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono font-medium text-gray-900">{sor.number}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-700">{sor.soTranId}</td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {sor.customerName}
                      {sor.customerCategory && (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">{sor.customerCategory}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full",
                        open ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500")}>
                        {STATUS_LABEL[sor.status] ?? sor.statusText}
                        {sor.status === "1" && sor.signing === "signed" ? ", signed" : ""}
                        {sor.status === "1" && (sor.signing === "sent" || sor.signing === "opened") ? ", out for signature" : ""}
                        {sor.status === "1" && !sor.signing && sor.lastPrinted ? ", printed" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                      {sor.newTotal != null ? `$${fmtPrice(sor.newTotal)}` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {query.trim() && digits === null && (
        <p className="text-sm text-gray-400 text-center py-4">Enter an SOR or Sales Order number, like SOR230 or SO714882.</p>
      )}
      {digits !== null && query.trim() && digits.length < MIN_DIGITS && (
        <p className="text-sm text-gray-400 text-center py-4">Type at least {MIN_DIGITS} digits of the SOR or Sales Order number.</p>
      )}
      {searchError && canSearch && !searching && (
        <p className="text-sm text-red-600 text-center py-4" role="alert">{searchError}</p>
      )}
      {results.length === 0 && !searching && !searchError && canSearch && searchedFor === digits && (
        <p className="text-sm text-gray-400 text-center py-4">No revisions found for "{query.trim()}". Start the revision on the Sales Order in NetSuite first.</p>
      )}
      {results.length > 0 && results.every(r => r.blocked) && !searching && (
        <p className="text-sm text-gray-500 text-center pb-2" data-testid="text-sor-none-open">
          None of these revisions can take items: {results[0].blocked}
        </p>
      )}

      {selected && (
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
          <div className="text-sm">
            <span className="text-gray-500">Selected: </span>
            <span className="font-medium text-gray-900">{selected.number}</span>
            <span className="text-gray-400"> - {selected.soTranId} - {selected.customerName}{selected.customerCategory ? ` (${selected.customerCategory})` : ""}</span>
          </div>
          <button
            onClick={handlePush}
            disabled={pushing}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            data-testid="button-push-sor"
          >
            {pushing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Push Items to SOR
          </button>
        </div>
      )}
      {selected?.warning && (
        <div className="mt-2 flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-800" role="status">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{selected.warning}</span>
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
