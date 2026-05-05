import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Shield, ArrowLeft, BarChart3, X, ChevronUp, ChevronDown, ChevronsUpDown, Info } from "lucide-react";
import { Link } from "wouter";

interface AnalyticsSummary {
  range: string;
  totals: {
    events: number;
    sessions: number;
    users: number;
    addToList: number;
    pushToEstimate: number;
  };
  activeUsers: Array<{
    employeeId: string | null;
    employeeName: string | null;
    sessions: number;
    pageViews: number;
    addsToList: number;
    pushesToEstimate: number;
    events: number;
    lastSeen: string;
  }>;
  anonymous: { sessions: number; pageViews: number; events: number; lastSeen: string | null };
  topCategories: Array<{ categoryId: number | null; name: string; views: number }>;
  topProducts: Array<{
    productId: number | null;
    name: string;
    sku: string | null;
    modalOpens: number;
  }>;
  topAddedItems: Array<{
    productId: number | null;
    name: string;
    sku: string | null;
    adds: number;
    qtyAdded: number;
    users: number;
  }>;
  recentEstimates: Array<{
    createdAt: string;
    employeeId: string | null;
    employeeName: string | null;
    estimateId: number | string | null;
    tranId: string | null;
    itemCount: number | null;
    lineCount: number | null;
    totalValue: number | null;
  }>;
  dailyPageViews: Array<{ day: string; views: number }>;
}

function fmtUsd(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}


interface RecentEvent {
  id: number;
  createdAt: string;
  eventType: string;
  path: string | null;
  sessionId: string;
  employeeId: string | null;
  employeeName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  productId: number | null;
  productName: string | null;
  productSku: string | null;
  metadata: Record<string, unknown> | null;
}

interface RecentActivityResponse {
  limit: number;
  events: RecentEvent[];
}

interface UserActivityResponse {
  employeeId: string;
  employeeName: string;
  limit: number;
  truncated: boolean;
  events: Array<{
    id: number;
    createdAt: string;
    eventType: string;
    path: string | null;
    sessionId: string;
    categoryId: number | null;
    categoryName: string | null;
    productId: number | null;
    productName: string | null;
    productSku: string | null;
    metadata: Record<string, unknown> | null;
  }>;
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  page_view: "Page View",
  category_view: "Category View",
  product_modal_open: "Product Modal",
  search: "Search",
  add_to_list: "Add to List",
  push_to_estimate: "Sent to Estimate",
};

const EVENT_TYPE_COLOR: Record<string, string> = {
  page_view: "bg-blue-50 text-blue-700",
  category_view: "bg-purple-50 text-purple-700",
  product_modal_open: "bg-amber-50 text-amber-700",
  search: "bg-gray-100 text-gray-700",
  add_to_list: "bg-amber-50 text-amber-700",
  push_to_estimate: "bg-emerald-50 text-emerald-700",
};

function fmtAbsTime(iso: string | null) {
  if (!iso) return "—";
  const ts = iso.endsWith("Z") ? iso : iso + "Z";
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function UserActivityModal({
  user,
  adminEmployeeId,
  onClose,
}: {
  user: { employeeId: string; employeeName: string };
  adminEmployeeId: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery<UserActivityResponse>({
    queryKey: ["adminUserActivity", user.employeeId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/analytics/user/${encodeURIComponent(user.employeeId)}`,
        { headers: { "X-Employee-Id": adminEmployeeId } },
      );
      if (!res.ok) throw new Error("Failed to load user activity");
      return res.json();
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const events = data?.events ?? [];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {user.employeeName || `Employee #${user.employeeId}`}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Recent activity · #{user.employeeId}
              {data ? ` · ${events.length} event${events.length === 1 ? "" : "s"}` : ""}
              {data?.truncated ? ` (last ${data.limit})` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-auto flex-1">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : isError ? (
            <div className="py-12 text-center text-sm text-red-600">
              Failed to load activity.
            </div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No recent activity for this user.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-400 font-semibold sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left">Time</th>
                  <th className="px-4 py-2 text-left">Event</th>
                  <th className="px-4 py-2 text-left">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((e) => {
                  const detail = e.productName
                    ? e.productName
                    : e.categoryName
                    ? e.categoryName
                    : e.eventType === "search" &&
                      e.metadata &&
                      typeof (e.metadata as { query?: unknown }).query === "string"
                    ? `"${(e.metadata as { query: string }).query}"`
                    : e.path ?? "—";
                  const subDetail =
                    e.productSku ??
                    (e.productName || e.categoryName ? e.path : null);
                  return (
                    <tr key={e.id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                        {fmtAbsTime(e.createdAt)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                            EVENT_TYPE_COLOR[e.eventType] ??
                            "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {EVENT_TYPE_LABEL[e.eventType] ?? e.eventType}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-gray-900 break-words">{detail}</div>
                        {subDetail && (
                          <div className="text-[11px] text-gray-400 font-mono break-all mt-0.5">
                            {subDetail}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProductAddsResponse {
  productId: number;
  name: string | null;
  sku: string | null;
  range: string;
  limit: number;
  truncated: boolean;
  events: Array<{
    id: number;
    createdAt: string;
    employeeId: string | null;
    employeeName: string | null;
    sessionId: string;
    quantity: number | null;
  }>;
}

interface EstimateDetailResponse {
  estimateId: number;
  events: Array<{
    id: number;
    createdAt: string;
    employeeId: string | null;
    employeeName: string | null;
    sessionId: string;
    tranId: string | null;
    itemCount: number | null;
    lineCount: number | null;
    totalValue: number | null;
  }>;
  netsuite: {
    tranId: string | null;
    customerName: string | null;
    status: string | null;
    tranDate: string | null;
    total: number | null;
    items: Array<{
      netsuiteId: number | null;
      name: string | null;
      sku: string | null;
      quantity: number | null;
      amount: number | null;
    }>;
  } | null;
  netsuiteError: string | null;
}

function ProductAddsModal({
  product,
  range,
  includeAdmins,
  adminEmployeeId,
  onClose,
}: {
  product: { productId: number; name: string; sku: string | null };
  range: "today" | "yesterday" | "7d" | "30d" | "90d";
  includeAdmins: boolean;
  adminEmployeeId: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery<ProductAddsResponse>({
    queryKey: ["adminProductAdds", product.productId, range, includeAdmins],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/analytics/product-adds/${product.productId}?range=${range}&includeAdmins=${includeAdmins ? "1" : "0"}`,
        { headers: { "X-Employee-Id": adminEmployeeId } },
      );
      if (!res.ok) throw new Error("Failed to load product adds");
      return res.json();
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const events = data?.events ?? [];
  const totalQty = events.reduce((sum, e) => sum + (e.quantity ?? 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
              {product.name}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">
              {product.sku ?? `Product #${product.productId}`}
            </p>
            {data && (
              <p className="text-xs text-gray-500 mt-1">
                {events.length} add{events.length === 1 ? "" : "s"} · {totalQty} units
                {data.truncated ? ` (last ${data.limit})` : ""} · last {range}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-auto flex-1">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : isError ? (
            <div className="py-12 text-center text-sm text-red-600">Failed to load adds.</div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No adds for this product in the selected range.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-400 font-semibold sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left">When</th>
                  <th className="px-4 py-2 text-left">User</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {fmtAbsTime(e.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-gray-900">
                      {e.employeeName ?? "Anonymous"}
                      {e.employeeId && (
                        <span className="text-[11px] text-gray-400 ml-1">#{e.employeeId}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-700">
                      {e.quantity ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function EstimateDetailModal({
  estimate,
  adminEmployeeId,
  onClose,
}: {
  estimate: { estimateId: number; tranId: string | null };
  adminEmployeeId: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery<EstimateDetailResponse>({
    queryKey: ["adminEstimateDetail", estimate.estimateId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/analytics/estimate-detail/${estimate.estimateId}`,
        { headers: { "X-Employee-Id": adminEmployeeId } },
      );
      if (!res.ok) throw new Error("Failed to load estimate detail");
      return res.json();
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const events = data?.events ?? [];
  const ns = data?.netsuite ?? null;
  const tranIdShown = ns?.tranId ?? estimate.tranId ?? `#${estimate.estimateId}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
              Estimate (NetSuite ES#)
            </div>
            <h3 className="text-lg font-semibold text-emerald-700 mt-0.5">
              {tranIdShown}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {ns?.customerName ? <>{ns.customerName} · </> : null}
              {ns?.status ?? null}
              {ns?.tranDate ? <> · {ns.tranDate}</> : null}
              {ns?.total != null ? <> · {fmtUsd(ns.total)}</> : null}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-auto flex-1 px-6 py-4 space-y-6">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
          ) : isError ? (
            <div className="py-12 text-center text-sm text-red-600">
              Failed to load estimate detail.
            </div>
          ) : (
            <>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                  Sent by
                </div>
                {events.length === 0 ? (
                  <div className="text-sm text-gray-400">No tracked send events.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {events.map((e) => (
                      <li key={e.id} className="text-sm flex items-center gap-3">
                        <span className="text-gray-500 text-xs whitespace-nowrap">
                          {fmtAbsTime(e.createdAt)}
                        </span>
                        <span className="text-gray-900">
                          {e.employeeName ?? "Anonymous"}
                          {e.employeeId && (
                            <span className="text-[11px] text-gray-400 ml-1">#{e.employeeId}</span>
                          )}
                        </span>
                        <span className="text-[11px] text-gray-400 ml-auto">
                          {e.itemCount ?? "?"} items · {e.lineCount ?? "?"} lines · {fmtUsd(e.totalValue)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                  Line items
                </div>
                {data?.netsuiteError ? (
                  <div className="text-sm text-amber-700 bg-amber-50 rounded p-3">
                    {data.netsuiteError}
                  </div>
                ) : !ns || ns.items.length === 0 ? (
                  <div className="text-sm text-gray-400">No items found.</div>
                ) : (
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                        <tr>
                          <th className="px-3 py-2 text-left">Item</th>
                          <th className="px-3 py-2 text-right">Qty</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {ns.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <div className="text-gray-900 line-clamp-1">
                                {it.name ?? `#${it.netsuiteId ?? "?"}`}
                              </div>
                              {it.sku && (
                                <div className="text-[11px] text-gray-400 font-mono">{it.sku}</div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {it.quantity ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {fmtUsd(it.amount)}
                            </td>
                          </tr>
                        ))}
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

type SortDir = "asc" | "desc";

function SortTh({
  label,
  sortKey,
  current,
  onSort,
  title,
  align = "right",
}: {
  label: string;
  sortKey: string;
  current: { key: string; dir: SortDir };
  onSort: (key: string) => void;
  title?: string;
  align?: "left" | "right";
}) {
  const active = current.key === sortKey;
  return (
    <th
      className={`px-3 py-2 text-${align} cursor-pointer select-none hover:text-gray-700 group`}
      title={title}
      onClick={() => onSort(sortKey)}
    >
      <span className={`inline-flex items-center gap-0.5 ${align === "right" ? "justify-end" : "justify-start"}`}>
        {label}
        {active ? (
          current.dir === "asc"
            ? <ChevronUp size={11} className="text-amber-500 shrink-0" />
            : <ChevronDown size={11} className="text-amber-500 shrink-0" />
        ) : (
          <ChevronsUpDown size={11} className="shrink-0 opacity-0 group-hover:opacity-50" />
        )}
      </span>
    </th>
  );
}

function AnalyticsSection({ employeeId }: { employeeId: string }) {
  const [range, setRange] = useState<"today" | "yesterday" | "7d" | "30d" | "90d">("7d");
  const [includeAdmins, setIncludeAdmins] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const [selectedUser, setSelectedUser] = useState<{
    employeeId: string;
    employeeName: string;
  } | null>(null);
  const [selectedAddedProduct, setSelectedAddedProduct] = useState<{
    productId: number;
    name: string;
    sku: string | null;
  } | null>(null);
  const [selectedEstimate, setSelectedEstimate] = useState<{
    estimateId: number;
    tranId: string | null;
  } | null>(null);
  const { data, isLoading, isError, refetch, isFetching } = useQuery<AnalyticsSummary>({
    queryKey: ["adminAnalytics", range, includeAdmins],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/analytics/summary?range=${range}&includeAdmins=${includeAdmins ? "1" : "0"}`,
        { headers: { "X-Employee-Id": employeeId } },
      );
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  const { data: recent } = useQuery<RecentActivityResponse>({
    queryKey: ["adminAnalyticsRecent", range, includeAdmins],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/analytics/recent?limit=50&range=${range}&includeAdmins=${includeAdmins ? "1" : "0"}`,
        { headers: { "X-Employee-Id": employeeId } },
      );
      if (!res.ok) throw new Error("Failed to load recent activity");
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  const [userSort, setUserSort] = useState<{ key: string; dir: SortDir }>({ key: "events", dir: "desc" });
  const [recentSort, setRecentSort] = useState<{ key: string; dir: SortDir }>({ key: "time", dir: "desc" });

  function handleUserSort(key: string) {
    setUserSort((prev) => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));
  }
  function handleRecentSort(key: string) {
    setRecentSort((prev) => ({ key, dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc" }));
  }

  const sortedActiveUsers = useMemo(() => {
    if (!data?.activeUsers) return [];
    return [...data.activeUsers].sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (userSort.key) {
        case "name": av = (a.employeeName ?? "").toLowerCase(); bv = (b.employeeName ?? "").toLowerCase(); break;
        case "sessions": av = a.sessions; bv = b.sessions; break;
        case "pageViews": av = a.pageViews; bv = b.pageViews; break;
        case "adds": av = a.addsToList; bv = b.addsToList; break;
        case "estimates": av = a.pushesToEstimate; bv = b.pushesToEstimate; break;
        case "lastSeen": av = new Date(a.lastSeen).getTime(); bv = new Date(b.lastSeen).getTime(); break;
        default: av = a.events; bv = b.events;
      }
      if (av < bv) return userSort.dir === "asc" ? -1 : 1;
      if (av > bv) return userSort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data?.activeUsers, userSort]);

  const sortedRecent = useMemo(() => {
    if (!recent?.events) return [];
    return [...recent.events].sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (recentSort.key) {
        case "user":
          av = (a.employeeName ?? (a.employeeId ? `Employee #${a.employeeId}` : "")).toLowerCase();
          bv = (b.employeeName ?? (b.employeeId ? `Employee #${b.employeeId}` : "")).toLowerCase();
          break;
        case "event": av = a.eventType; bv = b.eventType; break;
        case "detail":
          av = (a.productName ?? a.categoryName ?? a.path ?? "").toLowerCase();
          bv = (b.productName ?? b.categoryName ?? b.path ?? "").toLowerCase();
          break;
        default: av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime();
      }
      if (av < bv) return recentSort.dir === "asc" ? -1 : 1;
      if (av > bv) return recentSort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [recent?.events, recentSort]);

  const maxDaily = useMemo(
    () => Math.max(1, ...((data?.dailyPageViews ?? []).map((d) => d.views))),
    [data],
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-1 gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 size={18} className="text-amber-500" />
            Usage Analytics
            <span className="relative inline-flex">
              <button
                type="button"
                onClick={() => setInfoOpen((v) => !v)}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                aria-label="About this data"
              >
                <Info size={14} />
              </button>
              {infoOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setInfoOpen(false)} />
                  <div className="absolute left-0 top-6 z-20 w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-lg text-xs text-gray-600 leading-relaxed">
                    <div className="font-semibold text-gray-800 mb-2">About this data</div>
                    <ul className="space-y-1.5 list-disc list-inside">
                      <li>Tracks: category views, product opens, searches, adds to list, and estimate pushes.</li>
                      <li>Home page visits are not tracked.</li>
                      <li>Admin activity is hidden by default — use the <span className="font-medium">Include admins</span> toggle to see it.</li>
                      <li>Data is kept for <span className="font-medium">3 years</span>.</li>
                      <li>A background job runs every 24 hours and removes events older than 3 years.</li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => setInfoOpen(false)}
                      className="mt-3 text-amber-600 hover:text-amber-700 font-medium"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </span>
          </h3>
          <p className="text-sm text-gray-500">Who is using the selector and what they're viewing.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label
            className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg px-3 py-1.5 cursor-pointer select-none hover:bg-gray-200 transition-colors"
            title="Include analytics from admin users"
          >
            <input
              type="checkbox"
              checked={includeAdmins}
              onChange={(e) => setIncludeAdmins(e.target.checked)}
              className="h-3.5 w-3.5 accent-amber-500"
            />
            Include admins
          </label>
          <div className="inline-flex bg-gray-100 rounded-lg p-1">
            {(["today", "yesterday", "7d", "30d", "90d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${range === r ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                {r === "today" ? "Today" : r === "yesterday" ? "Yesterday" : r === "7d" ? "Last 7 days" : r === "30d" ? "Last 30 days" : "Last 90 days"}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-gray-400 hover:text-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
      ) : isError || !data ? (
        <div className="py-8 text-center text-sm text-red-600">Failed to load analytics.</div>
      ) : (
        <div className="mt-4 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Events</div>
              <div className="text-xl font-bold text-gray-900">{data.totals.events.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Sessions</div>
              <div className="text-xl font-bold text-gray-900">{data.totals.sessions.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Users</div>
              <div className="text-xl font-bold text-gray-900">{data.totals.users.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Anon Views</div>
              <div className="text-xl font-bold text-gray-900">{data.anonymous.pageViews.toLocaleString()}</div>
            </div>
            <div className="bg-amber-50 rounded-lg px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-amber-700 font-semibold">Added to List</div>
              <div className="text-xl font-bold text-gray-900">{(data.totals.addToList ?? 0).toLocaleString()}</div>
            </div>
            <div className="bg-emerald-50 rounded-lg px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">Estimates Sent</div>
              <div className="text-xl font-bold text-gray-900">{(data.totals.pushToEstimate ?? 0).toLocaleString()}</div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{(range === "today" || range === "yesterday") ? "Hourly Page Views" : "Daily Page Views"}</div>
              {!includeAdmins && (
                <div className="text-[11px] text-gray-400">
                  Admin activity hidden &middot;{" "}
                  <button
                    type="button"
                    onClick={() => setIncludeAdmins(true)}
                    className="text-amber-600 hover:text-amber-700 font-medium underline-offset-2 hover:underline"
                  >
                    Include admins
                  </button>
                </div>
              )}
            </div>
            {data.dailyPageViews.length > 0 ? (
              <div className="bg-gray-50 rounded-lg pt-3 pb-2 px-3">
                <div className="flex gap-2">
                  <div className="relative h-24 w-7 shrink-0 text-[9px] text-gray-400">
                    <div className="absolute right-0 top-0 -translate-y-1/2 tabular-nums">{maxDaily}</div>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 tabular-nums">{Math.round(maxDaily / 2)}</div>
                    <div className="absolute right-0 bottom-0 translate-y-1/2 tabular-nums">0</div>
                  </div>
                  <div className="flex-1 relative">
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                      <div className="border-t border-gray-200" />
                      <div className="border-t border-gray-200" />
                      <div className="border-t border-gray-200" />
                    </div>
                    <div className="relative flex items-end gap-1 h-24">
                      {data.dailyPageViews.map((d) => (
                        <div
                          key={d.day}
                          className="flex-1 bg-amber-400 rounded-t-sm min-h-[2px]"
                          style={{ height: `${(d.views / maxDaily) * 100}%` }}
                          title={`${(range === "today" || range === "yesterday") && d.day.includes("T") ? (() => { const h = parseInt(d.day.slice(11,13),10); return (h===0?"12a":h<12?`${h}a`:h===12?"12p":`${h-12}p`) + ":00"; })() : d.day.slice(5)}: ${d.views} views`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 mt-1 pl-9">
                  {data.dailyPageViews.map((d) => (
                    <div key={d.day} className="flex-1 text-[9px] text-gray-400 text-center whitespace-nowrap">
                      {(range === "today" || range === "yesterday") && d.day.includes("T")
                        ? (() => {
                            const h = parseInt(d.day.slice(11, 13), 10);
                            return h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`;
                          })()
                        : d.day.slice(5)}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-28 bg-gray-50 rounded-lg p-3 flex items-center justify-center text-sm text-gray-400 text-center">
                No page views in this range
                {!includeAdmins && (
                  <span className="ml-1">
                    (admin activity is hidden &mdash; toggle <span className="font-medium">Include admins</span> above to see it).
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Recent Activity{recent ? ` (${recent.events.length})` : ""}
            </div>
            {!recent ? (
              <div className="text-sm text-gray-400 py-4 text-center bg-gray-50 rounded-lg">Loading…</div>
            ) : recent.events.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center bg-gray-50 rounded-lg">No activity yet.</div>
            ) : (
              <div className="border border-gray-100 rounded-lg overflow-hidden max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-400 font-semibold sticky top-0">
                    <tr>
                      <SortTh label="Time" sortKey="time" current={recentSort} onSort={handleRecentSort} align="left" title="When this event was recorded." />
                      <SortTh label="User" sortKey="user" current={recentSort} onSort={handleRecentSort} align="left" title="The employee or anonymous visitor who triggered the event." />
                      <SortTh label="Event" sortKey="event" current={recentSort} onSort={handleRecentSort} align="left" title="Type of action: page view, category view, product open, search, add to list, or push to estimate." />
                      <SortTh label="Detail" sortKey="detail" current={recentSort} onSort={handleRecentSort} align="left" title="Additional context for the event — the page path, category name, product name, or search term." />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedRecent.map((e) => {
                      const detail = e.productName
                        ? e.productName
                        : e.categoryName
                        ? e.categoryName
                        : e.eventType === "search" &&
                          e.metadata &&
                          typeof (e.metadata as { query?: unknown }).query === "string"
                        ? `"${(e.metadata as { query: string }).query}"`
                        : e.path ?? "—";
                      const subDetail = e.productSku ?? null;
                      const userClickable = e.employeeId != null;
                      return (
                        <tr key={e.id} className="hover:bg-amber-50 align-top">
                          <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">
                            {fmtAbsTime(e.createdAt)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {userClickable ? (
                              <button
                                onClick={() =>
                                  setSelectedUser({
                                    employeeId: e.employeeId!,
                                    employeeName:
                                      e.employeeName ?? `Employee #${e.employeeId}`,
                                  })
                                }
                                className="text-gray-900 hover:text-amber-700 text-left"
                                title="View this user's recent activity"
                              >
                                {e.employeeName || `Employee #${e.employeeId}`}
                              </button>
                            ) : (
                              <span className="text-gray-400 italic">Anonymous</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                                EVENT_TYPE_COLOR[e.eventType] ?? "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {EVENT_TYPE_LABEL[e.eventType] ?? e.eventType}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-gray-900 break-words">{detail}</div>
                            {subDetail && (
                              <div className="text-[11px] text-gray-400 font-mono break-all mt-0.5">
                                {subDetail}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Active Users ({data.activeUsers.length})
            </div>
            {data.activeUsers.length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center bg-gray-50 rounded-lg">No signed-in activity yet.</div>
            ) : (
              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                    <tr>
                      <SortTh label="User" sortKey="name" current={userSort} onSort={handleUserSort} align="left" title="The employee (or anonymous visitor) who used the selector. Click a row to drill into their activity." />
                      <SortTh label="Sessions" sortKey="sessions" current={userSort} onSort={handleUserSort} title="Distinct browsing sessions in the selected range. A new session starts after a tab is closed or left idle." />
                      <SortTh label="Page Views" sortKey="pageViews" current={userSort} onSort={handleUserSort} title="Total pages this user loaded (category, search, product, and other selector pages)." />
                      <SortTh label="Adds" sortKey="adds" current={userSort} onSort={handleUserSort} title="Number of times this user added a product to their list." />
                      <SortTh label="Estimates" sortKey="estimates" current={userSort} onSort={handleUserSort} title="Number of times this user pushed a list to a NetSuite estimate." />
                      <SortTh label="Events" sortKey="events" current={userSort} onSort={handleUserSort} title="All tracked actions in the range: page views, category views, product opens, searches, adds, and estimate pushes." />
                      <SortTh label="Last Seen" sortKey="lastSeen" current={userSort} onSort={handleUserSort} title="Most recent tracked activity from this user." />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedActiveUsers.map((u) => {
                      const clickable = u.employeeId != null;
                      return (
                        <tr
                          key={u.employeeId ?? "unknown"}
                          onClick={() => {
                            if (!clickable) return;
                            setSelectedUser({
                              employeeId: u.employeeId!,
                              employeeName: u.employeeName ?? `Employee #${u.employeeId}`,
                            });
                          }}
                          className={`hover:bg-amber-50 ${clickable ? "cursor-pointer" : ""}`}
                          title={clickable ? "View recent activity" : undefined}
                        >
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900">{u.employeeName || "Unknown"}</div>
                            <div className="text-[11px] text-gray-400">#{u.employeeId}</div>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">{u.sessions}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{u.pageViews}</td>
                          <td className="px-3 py-2 text-right text-amber-700 font-medium">{u.addsToList}</td>
                          <td className="px-3 py-2 text-right text-emerald-700 font-medium">{u.pushesToEstimate}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{u.events}</td>
                          <td className="px-3 py-2 text-right text-gray-500">{fmtAbsTime(u.lastSeen)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Top Categories</div>
              {data.topCategories.length === 0 ? (
                <div className="text-sm text-gray-400 py-4 text-center bg-gray-50 rounded-lg">No category views yet.</div>
              ) : (
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                      <tr>
                        <th className="px-3 py-2 text-left">Category</th>
                        <th className="px-3 py-2 text-right">Views</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.topCategories.map((c) => (
                        <tr key={c.categoryId ?? c.name} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{c.name}</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">{c.views}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Top Products</div>
              {data.topProducts.length === 0 ? (
                <div className="text-sm text-gray-400 py-4 text-center bg-gray-50 rounded-lg">No product opens yet.</div>
              ) : (
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-right">Opens</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.topProducts.map((p) => (
                        <tr key={p.productId ?? p.name} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900 line-clamp-1">{p.name}</div>
                            {p.sku && <div className="text-[11px] text-gray-400 font-mono">{p.sku}</div>}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700">{p.modalOpens}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Top Added Items
              </div>
              {data.topAddedItems.length === 0 ? (
                <div className="text-sm text-gray-400 py-4 text-center bg-gray-50 rounded-lg">
                  No items added to lists yet.
                </div>
              ) : (
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                      <tr>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-right">Adds</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Users</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.topAddedItems.map((p) => {
                        const clickable = p.productId != null;
                        return (
                          <tr
                            key={p.productId ?? p.name}
                            className={`hover:bg-gray-50 ${clickable ? "cursor-pointer" : ""}`}
                            onClick={() => {
                              if (p.productId != null) {
                                setSelectedAddedProduct({
                                  productId: p.productId,
                                  name: p.name,
                                  sku: p.sku,
                                });
                              }
                            }}
                          >
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-900 line-clamp-1">{p.name}</div>
                              {p.sku && <div className="text-[11px] text-gray-400 font-mono">{p.sku}</div>}
                            </td>
                            <td className="px-3 py-2 text-right text-amber-700 font-medium">{p.adds}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{p.qtyAdded}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{p.users}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Recent Estimates Sent
              </div>
              {data.recentEstimates.length === 0 ? (
                <div className="text-sm text-gray-400 py-4 text-center bg-gray-50 rounded-lg">
                  No estimates sent yet.
                </div>
              ) : (
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
                      <tr>
                        <th className="px-3 py-2 text-left">When</th>
                        <th className="px-3 py-2 text-left">User</th>
                        <th className="px-3 py-2 text-left">Estimate</th>
                        <th className="px-3 py-2 text-right">Items</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.recentEstimates.map((e, idx) => {
                        const numericId =
                          typeof e.estimateId === "number"
                            ? e.estimateId
                            : typeof e.estimateId === "string" && /^\d+$/.test(e.estimateId)
                            ? Number(e.estimateId)
                            : null;
                        const clickable = numericId != null;
                        return (
                          <tr
                            key={`${e.estimateId ?? "x"}-${idx}`}
                            className={`hover:bg-gray-50 ${clickable ? "cursor-pointer" : ""}`}
                            onClick={() => {
                              if (numericId != null) {
                                setSelectedEstimate({ estimateId: numericId, tranId: e.tranId });
                              }
                            }}
                          >
                            <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                              {fmtAbsTime(e.createdAt)}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {e.employeeName || (e.employeeId ? `#${e.employeeId}` : "Unknown")}
                            </td>
                            <td className="px-3 py-2 text-emerald-700 font-medium">
                              {e.tranId ?? (e.estimateId != null ? `#${e.estimateId}` : "—")}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {e.itemCount ?? "—"}
                              {e.lineCount != null && (
                                <span className="text-[10px] text-gray-400 ml-1">({e.lineCount} lines)</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">{fmtUsd(e.totalValue)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedUser && (
        <UserActivityModal
          user={selectedUser}
          adminEmployeeId={employeeId}
          onClose={() => setSelectedUser(null)}
        />
      )}
      {selectedAddedProduct && (
        <ProductAddsModal
          product={selectedAddedProduct}
          range={range}
          includeAdmins={includeAdmins}
          adminEmployeeId={employeeId}
          onClose={() => setSelectedAddedProduct(null)}
        />
      )}
      {selectedEstimate && (
        <EstimateDetailModal
          estimate={selectedEstimate}
          adminEmployeeId={employeeId}
          onClose={() => setSelectedEstimate(null)}
        />
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const { employee } = useAuth();

  if (!employee?.isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <Shield size={48} className="mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-1">Access Denied</h2>
        <p className="text-sm">You don't have admin privileges.</p>
        <Link href="/" className="mt-4 text-sm text-amber-600 hover:text-amber-700 font-medium">
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usage Analytics</h1>
          <p className="text-sm text-gray-500">Activity, top content, and per-user drill-down.</p>
        </div>
      </div>

      <AnalyticsSection employeeId={employee.id} />
    </div>
  );
}
