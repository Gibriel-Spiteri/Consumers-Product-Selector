import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, ArrowLeft, Globe } from "lucide-react";
import {
  useGetAnalyticsDrilldown,
  getGetAnalyticsDrilldownQueryKey,
} from "@workspace/api-client-react";
import type {
  GetAnalyticsDrilldownParams,
  AnalyticsAction,
} from "@workspace/api-client-react";

export type DrilldownEventType =
  | "add_to_list"
  | "push_to_estimate"
  | "vendor_site_visit"
  | "quickadd_capture";

type Range = "today" | "yesterday" | "7d" | "30d" | "90d";

// Sentinel the drilldown endpoint uses for events with no employee attached.
const ANONYMOUS_ID = "anonymous";

const META: Record<DrilldownEventType, { title: string; accent: string; note: string }> = {
  add_to_list: {
    title: "Added to List",
    accent: "text-amber-700",
    note: "Each row is one add action. Unattributed adds came from signed-out or older sessions.",
  },
  push_to_estimate: {
    title: "Estimates Sent",
    accent: "text-emerald-700",
    note: "Each row is one send action; one estimate sent twice counts twice.",
  },
  vendor_site_visit: {
    title: "Special-Order Site Visits",
    accent: "text-sky-700",
    note: "Outbound vendor website opens from CPS special-order links (source cps_link). Tracked starting with this update.",
  },
  quickadd_capture: {
    title: "QuickAdd Captures",
    accent: "text-violet-700",
    note: "Products captured by the QuickAdd browser extension (source quickadd). Tracked starting with this update.",
  },
};

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  const ts = /Z$|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z";
  return new Date(ts).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function str(m: Record<string, unknown> | null, k: string): string | null {
  const v = m?.[k];
  return typeof v === "string" || typeof v === "number" ? String(v) : null;
}

function describe(e: AnalyticsAction) {
  const m = (e.metadata ?? null) as Record<string, unknown> | null;
  const main =
    e.productName ?? str(m, "productName") ?? str(m, "productLineName") ??
    (str(m, "tranId") ? `Estimate ${str(m, "tranId")}` : null) ??
    str(m, "vendorDomain") ?? "—";
  const bits = [
    str(m, "sku"),
    str(m, "productLineName") !== main ? str(m, "productLineName") : null,
    str(m, "vendorDomain") !== main ? str(m, "vendorDomain") : null,
    str(m, "quantity") ? `qty ${str(m, "quantity")}` : null,
    str(m, "itemCount") ? `${str(m, "itemCount")} items` : null,
    str(m, "tranId") && !main.includes(str(m, "tranId")!) ? str(m, "tranId") : null,
    str(m, "source") ? `source ${str(m, "source")}` : null,
    str(m, "extensionVersion") ? `ext v${str(m, "extensionVersion")}` : null,
  ].filter(Boolean) as string[];
  return { main, bits, url: str(m, "pageUrl") };
}

export function ActionDrilldownModal({
  eventType, range, rangeLabel, includeAdmins, onClose,
}: {
  eventType: DrilldownEventType;
  range: Range;
  rangeLabel: string;
  includeAdmins: boolean;
  onClose: () => void;
}) {
  const [actor, setActor] = useState<{ id: string; name: string } | null>(null);
  const [domain, setDomain] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const hasSites = eventType === "vendor_site_visit" || eventType === "quickadd_capture";
  const meta = META[eventType];

  const params: GetAnalyticsDrilldownParams = {
    range,
    includeAdmins: includeAdmins ? "1" : "0",
    eventType,
    page,
    ...(actor ? { employeeId: actor.id } : {}),
    ...(domain ? { vendorDomain: domain } : {}),
  };
  const { data, isLoading, isError, isFetching, refetch } = useGetAnalyticsDrilldown(params, {
    query: { queryKey: getGetAnalyticsDrilldownQueryKey(params), staleTime: 0, refetchOnMount: "always", refetchInterval: 30000 },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pages = data ? Math.max(1, Math.ceil(data.total / Math.max(1, data.pageSize))) : 1;
  const actorTotal = data?.actors.reduce((s, a) => s + a.count, 0) ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[88vh] flex flex-col" onClick={(e) => e.stopPropagation()} data-testid={`modal-drilldown-${eventType}`}>
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <h3 className={`text-lg font-semibold ${meta.accent}`}>{meta.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {rangeLabel} · {includeAdmins ? "admins included" : "admins hidden"}
              {domain ? <> · site <span className="font-mono">{domain}</span></> : null}
              {actor ? <> · {actor.name}</> : null}
            </p>
            <p className="text-[11px] text-gray-400 mt-1 max-w-2xl">
              {meta.note} Counts are actions, not distinct users or estimates. Older unattributed events cannot be assigned to a person.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100" aria-label="Close" data-testid="button-close-drilldown">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-auto flex-1 px-6 py-4 space-y-5">
          {isLoading ? (
            <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-8 bg-gray-100 rounded animate-pulse" />)}</div>
          ) : isError || !data ? (
            <div className="py-10 text-center text-sm text-red-600">
              Failed to load breakdown.{" "}
              <button className="underline text-amber-700" onClick={() => refetch()} data-testid="button-retry-drilldown">Retry</button>
            </div>
          ) : (
            <>
              {hasSites && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Sites</div>
                    {domain && <button className="text-[11px] text-amber-700 hover:underline" onClick={() => { setDomain(null); setPage(1); }} data-testid="button-clear-domain">All sites</button>}
                  </div>
                  {data.sites.length === 0 ? (
                    <div className="text-sm text-gray-400 bg-gray-50 rounded-lg py-3 text-center">No sites recorded in this range.</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {data.sites.map((s) => (
                        <button key={s.domain} data-testid={`button-site-${s.domain}`}
                          onClick={() => { setDomain(domain === s.domain ? null : s.domain); setPage(1); }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition-colors ${domain === s.domain ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"}`}>
                          <Globe size={11} className="opacity-60" />
                          <span className="font-mono">{s.domain}</span>
                          <span className="tabular-nums opacity-70">{s.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    People ({data.actors.length}) · {actorTotal.toLocaleString()} actions
                  </div>
                  {actor && <button className="text-[11px] text-amber-700 hover:underline inline-flex items-center gap-1" onClick={() => { setActor(null); setPage(1); }} data-testid="button-clear-actor"><ArrowLeft size={11} /> Everyone</button>}
                </div>
                {data.actors.length === 0 ? (
                  <div className="text-sm text-gray-400 bg-gray-50 rounded-lg py-3 text-center">No actions in {rangeLabel.toLowerCase()}.</div>
                ) : (
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                        <tr><th className="px-3 py-2 text-left">Person</th><th className="px-3 py-2 text-right">Actions</th><th className="px-3 py-2 text-right">Last</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data.actors.map((a) => {
                          const id = a.employeeId ?? ANONYMOUS_ID;
                          const sel = actor?.id === id;
                          return (
                            <tr key={id} data-testid={`row-actor-${id}`} tabIndex={0} role="button" aria-pressed={sel}
                              onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActor(sel ? null : { id, name: a.employeeName }); setPage(1); } }}
                              onClick={() => { setActor(sel ? null : { id, name: a.employeeId ? a.employeeName : "Anonymous / unattributed" }); setPage(1); }}
                              className={`cursor-pointer ${sel ? "bg-amber-50" : "hover:bg-gray-50"}`}>
                              <td className="px-3 py-2">
                                {a.employeeId ? (
                                  <><span className="text-gray-900">{a.employeeName}</span><span className="text-[11px] text-gray-400 ml-1">#{a.employeeId}</span></>
                                ) : <span className="italic text-gray-500">Anonymous / unattributed</span>}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-medium">{a.count.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right text-gray-500 text-xs whitespace-nowrap">{fmtTime(a.lastSeen)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Action history{actor ? ` · ${actor.name}` : ""} ({data.total.toLocaleString()})
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <button disabled={page <= 1 || isFetching} onClick={() => setPage((p) => p - 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30" data-testid="button-prev-page" aria-label="Previous page"><ChevronLeft size={14} /></button>
                    <span className="tabular-nums" data-testid="text-page">{data.page} / {pages}</span>
                    <button disabled={page >= pages || isFetching} onClick={() => setPage((p) => p + 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30" data-testid="button-next-page" aria-label="Next page"><ChevronRight size={14} /></button>
                  </div>
                </div>
                {data.events.length === 0 ? (
                  <div className="text-sm text-gray-400 bg-gray-50 rounded-lg py-3 text-center">No actions match.</div>
                ) : (
                  <div className={`border border-gray-100 rounded-lg overflow-hidden ${isFetching ? "opacity-60" : ""}`}>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                        <tr><th className="px-3 py-2 text-left">When</th><th className="px-3 py-2 text-left">Person</th><th className="px-3 py-2 text-left">Detail</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data.events.map((e) => {
                          const d = describe(e);
                          return (
                            <tr key={e.id} className="align-top hover:bg-gray-50" data-testid={`row-action-${e.id}`}>
                              <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{fmtTime(e.createdAt)}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{e.employeeId ? e.employeeName : <span className="italic text-gray-400">Anonymous</span>}</td>
                              <td className="px-3 py-2">
                                <div className="text-gray-900 break-words">{d.main}</div>
                                {d.bits.length > 0 && <div className="text-[11px] text-gray-400 mt-0.5">{d.bits.join(" · ")}</div>}
                                {d.url && <div className="text-[11px] text-gray-400 font-mono break-all mt-0.5">{d.url}</div>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
