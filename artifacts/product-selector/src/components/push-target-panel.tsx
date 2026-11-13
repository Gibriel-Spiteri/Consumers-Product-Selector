import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ExternalLink, Loader2, RefreshCw, Search } from "lucide-react";
import type { EstimateLineInput } from "@workspace/api-client-react";
import { authHeaders } from "@/context/auth-context";
import type { QuoteItem } from "@/context/quote-list-context";
import { cn } from "@/lib/utils";
import type { SorResult } from "@/components/sor-push-panel";
import { useNewEstimate, type NewEstimateCreated } from "@/hooks/use-new-estimate";
import { useNewSor, type NewSorCreated } from "@/hooks/use-new-sor";
import { loadRecent, recentWhen, saveRecent, searchableQuery, splitCustomer, withRecent, type RecentTarget } from "@/lib/push-ui";

/*
 * "Send to NetSuite" in one search box (2026-11-13). Gib, asking for the Push to section "more elegant and or
 * intuitive", then picked variant B of https://claude.ai/artifact/XVP62opudtXRsG2HTq6vRp.
 *
 * The four Push to choices were two questions (estimate or Sales Order, existing or new). Here the rep types any
 * record number or the customer's name; every estimate and Sales Order found says what it can take (Add here, Add to
 * SOR61, Start a revision, or why not), grouped by customer, with Start a new estimate always there. A black bar says
 * exactly what will happen before anything is sent. The sends themselves are the existing ones: the estimate push,
 * the SOR push, New SOR (hooks/use-new-sor.ts) and New Estimate (hooks/use-new-estimate.ts). Behind ?pushui=new.
 */
interface EstimateTarget {
  id: string; tranId: string; customerId: string | null; customerName: string;
  customerCategoryId: string; customerCategory: string; status: string; date: string; total: number | null; open: boolean;
}
interface OrderTarget {
  id: string; tranId: string; customerId?: string | null; customerName: string; status: string; statusText: string;
  customerCategoryId: string | null; customerCategory: string | null;
  openSor: SorResult | null; blocked: string | null; offer: SorResult | null;
}

type Target =
  | { key: string; kind: "estimate"; label: string; estimateId: number; customer: string; category: string | null; categoryId: string | null }
  | { key: string; kind: "sor"; label: string; sor: SorResult; customer: string; category: string | null; categoryId: string | null }
  | { key: string; kind: "newsor"; label: string; order: { id: string; tranId: string }; customer: string; category: string | null; categoryId: string | null }
  | { key: string; kind: "newestimate"; label: string; customer: string; category: null; categoryId: null };

interface Row { key: string; title: string; meta: string; action: string; ok: boolean; target: Target | null }
interface Group { key: string; name: string; number: string | null; category: string | null; rows: Row[] }

const money = (n: number | null) => (n == null ? "" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const NEW_ESTIMATE: Target = { key: "new-estimate", kind: "newestimate", label: "a new estimate", customer: "", category: null, categoryId: null };

function groupResults(estimates: EstimateTarget[], orders: OrderTarget[]): Group[] {
  const groups = new Map<string, Group>();
  const groupOf = (id: string | null | undefined, display: string, category: string | null) => {
    const key = id || display;
    let g = groups.get(key);
    if (!g) {
      const { name, number } = splitCustomer(display);
      g = { key, name, number, category, rows: [] };
      groups.set(key, g);
    }
    return g;
  };
  for (const e of estimates) {
    const g = groupOf(e.customerId, e.customerName, e.customerCategory || null);
    const customer = splitCustomer(e.customerName).name;
    g.rows.push({
      key: `es-${e.id}`, title: e.tranId,
      meta: ["Estimate", e.status, e.date, money(e.total)].filter(Boolean).join(", "),
      ok: e.open, action: e.open ? "Add here" : `${e.status || "Not open"}, can't take items`,
      target: e.open ? { key: `es-${e.id}`, kind: "estimate", label: e.tranId, estimateId: Number(e.id), customer, category: e.customerCategory || null, categoryId: e.customerCategoryId || null } : null,
    });
  }
  for (const o of orders) {
    const g = groupOf(o.customerId, o.customerName, o.customerCategory);
    const customer = splitCustomer(o.customerName).name;
    const base = { category: o.customerCategory, categoryId: o.customerCategoryId, customer };
    if (o.offer) {
      g.rows.push({
        key: `so-${o.id}`, title: o.tranId, meta: `Sales Order, ${o.statusText}, ${o.offer.number} open as a Draft`,
        ok: true, action: `Add to ${o.offer.number}`,
        target: { key: `so-${o.id}`, kind: "sor", label: o.offer.number, sor: o.offer, ...base },
      });
    } else if (!o.blocked) {
      g.rows.push({
        key: `so-${o.id}`, title: o.tranId, meta: `Sales Order, ${o.statusText}, no revision open`,
        ok: true, action: "Start a revision",
        target: { key: `so-${o.id}`, kind: "newsor", label: o.tranId, order: { id: o.id, tranId: o.tranId }, ...base },
      });
    } else {
      g.rows.push({ key: `so-${o.id}`, title: o.tranId, meta: o.blocked, ok: false, action: "Can't take items now", target: null });
    }
  }
  return [...groups.values()];
}

export default function PushTargetPanel({
  units, total, buildEstimateItems, buildSorItems, onPushToEstimate, onPushToSor, onEstimateCreated, onSorCreated,
  setPushResult, describe, warnFor, onClassic,
}: {
  units: number;
  total: number | null;
  buildEstimateItems: () => { items: EstimateLineInput[]; snapshot: QuoteItem[] };
  buildSorItems: () => { items: EstimateLineInput[]; snapshot: QuoteItem[] };
  /** The estimate push: throws with the message when nothing was added. */
  onPushToEstimate: (estimateId: number, tranId: string) => Promise<void>;
  /** The SOR push: true when the items went on. */
  onPushToSor: (sor: SorResult) => Promise<boolean>;
  onEstimateCreated: (created: NewEstimateCreated, pushed: QuoteItem[], skipped: string[]) => Promise<void>;
  onSorCreated: (created: NewSorCreated, pushed: QuoteItem[]) => Promise<void>;
  setPushResult: (r: { success: boolean; message: string; link?: { href: string; label: string } } | null) => void;
  describe: (snapshot: QuoteItem[], netsuiteId: string) => string;
  warnFor: (target: { tranId: string; customerCategory?: string; customerCategoryId?: string }) => string | null;
  onClassic: () => void;
}) {
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchedFor, setSearchedFor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Target | null>(null);
  const [sending, setSending] = useState(false);
  const [recent, setRecent] = useState<RecentTarget[]>(() => loadRecent());
  const latest = useRef(0);

  const searchable = searchableQuery(query);

  const runSearch = useCallback(async (q: string) => {
    const id = ++latest.current;
    setSearching(true);
    setSearchError(null);
    setSelected(null);
    try {
      const res = await fetch(`/api/push-targets/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (id !== latest.current) return;
      if (res.ok) setGroups(groupResults(Array.isArray(data.estimates) ? data.estimates : [], Array.isArray(data.orders) ? data.orders : []));
      else {
        setGroups([]);
        setSearchError(typeof data?.error === "string" ? data.error : `Search failed (${res.status}). Try again.`);
      }
      setSearchedFor(q);
    } catch {
      if (id !== latest.current) return;
      setGroups([]);
      setSearchError("Could not reach the server. Try again.");
      setSearchedFor(q);
    } finally {
      if (id === latest.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (!searchable) {
      latest.current++;
      setGroups([]);
      setSearchedFor(null);
      setSearchError(null);
      setSearching(false);
      return;
    }
    const t = setTimeout(() => runSearch(searchable), 350);
    return () => clearTimeout(t);
  }, [searchable, runSearch]);

  const remember = (label: string, customer: string) => {
    const next = withRecent(recent, { label, customer, at: Date.now() });
    setRecent(next);
    saveRecent(next);
  };

  const estimateFlow = useNewEstimate({
    buildItems: buildEstimateItems,
    onCreated: async (c, pushed, skipped) => { remember(c.tranId, splitCustomer(c.customerName).name); await onEstimateCreated(c, pushed, skipped); },
    setPushResult, describe,
  });
  const sorFlow = useNewSor({
    buildItems: buildSorItems,
    onCreated: async (c, pushed) => { remember(c.sorNumber, splitCustomer(c.customerName).name); await onSorCreated(c, pushed); },
    setPushResult, describe,
    onRefused: soTranId => { setQuery(soTranId); runSearch(soTranId); },
    onSuccess: () => setSelected(null),
  });

  const busy = sending || estimateFlow.busy || sorFlow.busy;
  const unitsText = `${units} item${units === 1 ? "" : "s"}`;

  // Started straight from the click: New Estimate opens its pop-up before anything is awaited.
  const send = async () => {
    const sel = selected;
    if (!sel || busy) return;
    if (sel.kind === "newestimate") { estimateFlow.start(); return; }
    if (sel.kind === "newsor") { sorFlow.create(sel.order); return; }
    setSending(true);
    setPushResult(null);
    try {
      if (sel.kind === "estimate") {
        await onPushToEstimate(sel.estimateId, sel.label);
        remember(sel.label, sel.customer);
        setSelected(null);
      } else if (await onPushToSor(sel.sor)) {
        remember(sel.label, sel.customer);
        setSelected(null);
      }
    } catch (err: any) {
      setPushResult({ success: false, message: err?.message ?? `Nothing was added to ${sel.label}.` });
    } finally {
      setSending(false);
    }
  };

  const confirmTitle = !selected ? "" :
    selected.kind === "newestimate" ? `Start a new estimate with ${unitsText}` :
    selected.kind === "newsor" ? `Start a revision on ${selected.label} with ${unitsText}` :
    `Add ${unitsText}${total != null ? `, ${money(total)},` : ""} to ${selected.label}`;
  const confirmSub = !selected ? "" :
    selected.kind === "newestimate" ? "NetSuite's Customer Search opens in a pop-up: pick or add the customer, then Create Estimate there." :
    selected.kind === "newsor" ? `${selected.customer}: NetSuite starts a Draft revision on the order with these items.` :
    selected.kind === "sor" ? `${selected.customer}: Draft revision on ${selected.sor.soTranId}. Reprint it and have it signed before Update Sales Order.` :
    `${selected.customer}: open estimate.`;
  const sendLabel = !selected ? "" :
    selected.kind === "newestimate" ? "Find the customer in NetSuite" :
    selected.kind === "newsor" ? (busy ? "Starting the revision..." : `Start SOR with ${unitsText}`) :
    busy ? `Adding ${unitsText}...` : `Add ${unitsText} to ${selected.label}`;
  const basis = selected && selected.kind !== "newestimate"
    ? warnFor({ tranId: selected.label, customerCategory: selected.category ?? undefined, customerCategoryId: selected.categoryId ?? undefined })
    : null;
  const sorWarning = selected?.kind === "sor" ? selected.sor.warning : null;

  const rowButton = (row: Row) => {
    const isSel = !!row.target && selected?.key === row.target.key;
    return (
      <li key={row.key} className="border-b border-gray-100 last:border-b-0">
        <button
          type="button"
          onClick={() => row.target && !busy && setSelected(row.target)}
          aria-pressed={isSel}
          aria-disabled={!row.ok}
          className={cn(
            "w-full flex items-center gap-3.5 px-6 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-700",
            isSel ? "bg-amber-50 shadow-[inset_0_0_0_2px_#f59e0b]" : row.ok ? "bg-white hover:bg-gray-50" : "bg-white cursor-default",
          )}
          data-testid={`row-target-${row.key}`}
        >
          <span aria-hidden="true" className={cn("w-[18px] h-[18px] shrink-0 rounded-full border-2 flex items-center justify-center",
            isSel ? "border-amber-500" : row.ok ? "border-gray-400" : "border-gray-200 bg-gray-100")}>
            {isSel && <span className="w-2 h-2 rounded-full bg-amber-500" />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold text-gray-900">{row.title}</span>
            <span className="block text-[13px] text-gray-500">{row.meta}</span>
          </span>
          <span className={cn("shrink-0 text-[13px] font-semibold px-2.5 py-1.5 rounded-lg",
            row.ok ? "text-gray-900 bg-gray-100" : "text-amber-800 bg-amber-50")}>{row.action}</span>
        </button>
      </li>
    );
  };

  const newEstimateRow = (
    <div className="flex flex-wrap items-center gap-3 px-6 py-4 bg-gray-50">
      <span className="flex-1 min-w-[220px] text-[14px] text-gray-700">
        No estimate yet? Start one with these items. For a new revision, search the Sales Order.
      </span>
      <button type="button" onClick={() => !busy && setSelected(NEW_ESTIMATE)}
        className={cn("h-10 px-4 rounded-xl border text-[14px] font-semibold bg-white",
          selected?.kind === "newestimate" ? "border-amber-500 shadow-[inset_0_0_0_1px_#f59e0b]" : "border-gray-400 hover:bg-gray-50")}
        data-testid="button-target-new-estimate">
        New estimate
      </button>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" data-testid="panel-push-target">
      <div className="px-6 pt-5 pb-4 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="font-semibold text-gray-900 text-[17px]">Send these {unitsText} to NetSuite</h3>
          {total != null && <span className="text-sm text-gray-500 tabular-nums">{unitsText}, {money(total)}</span>}
        </div>
        <label htmlFor="push-target-q" className="block text-[13px] font-medium text-gray-700">
          Find the estimate, Sales Order or revision, or the customer
        </label>
        <div className="relative">
          <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden="true" />
          <input
            id="push-target-q"
            type="search"
            inputMode="search"
            autoComplete="off"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && searchable) runSearch(searchable); }}
            placeholder="ES241762, SO714728, SOR61 or a name like Alvarez"
            className="w-full h-12 pl-11 pr-11 bg-white border border-gray-400 rounded-xl text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-sky-700"
            data-testid="input-push-target"
          />
          {searching && <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-gray-500" aria-label="Searching" />}
        </div>
      </div>

      {(estimateFlow.phase === "open" || estimateFlow.phase === "closed") && (
        <div className="mx-6 mb-4 flex flex-wrap items-center gap-2 px-4 py-3 bg-sky-50 border border-sky-200 rounded-xl text-[13px] text-sky-900" role="status">
          <span className="flex-1 min-w-[220px]">
            {estimateFlow.phase === "open"
              ? "Waiting for NetSuite: pick the customer and press Create Estimate in the pop-up."
              : estimateFlow.note ?? "The Customer Search pop-up is closed."}
          </span>
          {estimateFlow.phase === "open" && (
            <button type="button" onClick={estimateFlow.focusPopup} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-sky-300 rounded-lg font-medium">
              <ExternalLink size={13} /> Show pop-up
            </button>
          )}
          <button type="button" disabled={estimateFlow.checking} onClick={() => estimateFlow.handoff && estimateFlow.confirm(estimateFlow.handoff, "button")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-sky-300 rounded-lg font-medium disabled:opacity-50">
            {estimateFlow.checking ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Check NetSuite
          </button>
          {estimateFlow.phase === "closed" && (
            <button type="button" onClick={estimateFlow.finish} className="px-3 py-1.5 bg-white border border-sky-300 rounded-lg font-medium">Start over</button>
          )}
        </div>
      )}
      {sorFlow.pending && sorFlow.note && (
        <div className="mx-6 mb-4 flex flex-wrap items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-800" role="status">
          <AlertCircle size={14} className="shrink-0" />
          <span className="flex-1 min-w-[200px]">{sorFlow.note}</span>
          <button type="button" onClick={() => sorFlow.pending && sorFlow.checkPending(sorFlow.pending)} disabled={sorFlow.busy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 rounded-lg font-medium disabled:opacity-50">
            {sorFlow.busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Check again
          </button>
          <button type="button" onClick={sorFlow.startOver} disabled={sorFlow.busy} className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg font-medium disabled:opacity-50">Start over</button>
        </div>
      )}

      <div className="border-t border-gray-100 max-h-[440px] overflow-y-auto">
        {!searchable && (
          <>
            {query.trim() && (
              <p className="px-6 py-3 text-[13px] text-gray-500">Type 3 or more digits of the number, or 3 or more letters of the customer's name.</p>
            )}
            {recent.length > 0 && !query.trim() && (
              <>
                <div className="px-6 pt-4 pb-1 text-[14px] font-semibold text-gray-700">Sent to recently</div>
                <ul aria-label="Sent to recently">
                  {recent.map(r => (
                    <li key={r.label} className="border-b border-gray-100">
                      <button type="button" onClick={() => setQuery(r.label)} className="w-full flex items-center gap-3.5 px-6 py-3 text-left bg-white hover:bg-gray-50">
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] font-semibold text-gray-900">{r.label} <span className="font-normal text-gray-700">{r.customer}</span></span>
                          <span className="block text-[13px] text-gray-500">{recentWhen(r.at)}</span>
                        </span>
                        <span className="shrink-0 text-[13px] font-semibold px-2.5 py-1.5 rounded-lg text-gray-900 bg-gray-100">Find it</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {newEstimateRow}
          </>
        )}
        {searchable && searchError && !searching && (
          <p className="px-6 py-4 text-sm text-red-700" role="alert">{searchError}</p>
        )}
        {searchable && !searchError && groups.length > 0 && (
          <>
            {groups.map(g => (
              <div key={g.key}>
                <div className="px-6 pt-4 pb-1 flex items-center gap-2">
                  <span className="text-[15px] font-semibold text-gray-900">{g.name}</span>
                  {g.number && <span className="text-[13px] text-gray-500">#{g.number}</span>}
                  {g.category && <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">{g.category}</span>}
                </div>
                <ul aria-label={g.name}>{g.rows.map(rowButton)}</ul>
              </div>
            ))}
            {newEstimateRow}
          </>
        )}
        {searchable && !searchError && !searching && groups.length === 0 && searchedFor === searchable && (
          <>
            <p className="px-6 py-4 text-[14px] text-gray-700"><strong>Nothing matches "{query.trim()}".</strong> Check the number, or search the customer's last name.</p>
            {newEstimateRow}
          </>
        )}
      </div>

      {selected && (
        <div className="bg-gray-900 text-white px-6 py-4 space-y-2" role="region" aria-label="Ready to send">
          {(basis || sorWarning) && <p className="text-[13px] text-amber-200">{[basis, sorWarning].filter(Boolean).join(" ")}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[240px]">
              <div className="text-[17px] font-semibold">{confirmTitle}</div>
              <div className="text-[13px] text-gray-300 mt-0.5">{confirmSub}</div>
            </div>
            <button type="button" onClick={() => setSelected(null)} disabled={busy}
              className="h-11 px-4 rounded-xl border border-gray-600 text-[14px] font-medium hover:bg-gray-800 disabled:opacity-50">
              Change
            </button>
            <button type="button" onClick={send} disabled={busy}
              className="h-11 px-5 rounded-xl bg-white text-gray-900 text-[15px] font-semibold inline-flex items-center gap-2 hover:bg-gray-100 disabled:opacity-70"
              data-testid="button-send-target">
              {busy && <Loader2 size={15} className="animate-spin" />}
              {sendLabel}
            </button>
          </div>
        </div>
      )}

      <div className="px-6 py-2 text-right border-t border-gray-100">
        <button type="button" onClick={onClassic} className="text-[12px] text-gray-500 underline underline-offset-2 hover:text-gray-700">
          Back to the classic Push to
        </button>
      </div>
    </div>
  );
}
