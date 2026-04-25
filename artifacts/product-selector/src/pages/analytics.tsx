import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Shield, ArrowLeft, BarChart3, X } from "lucide-react";
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

function fmtTimeAgo(iso: string | null) {
  if (!iso) return "—";
  const ts = iso.endsWith("Z") ? iso : iso + "Z";
  const date = new Date(ts);
  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

function fmtAbsTime(iso: string) {
  const ts = iso.endsWith("Z") ? iso : iso + "Z";
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
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

function AnalyticsSection({ employeeId }: { employeeId: string }) {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("7d");
  const [includeAdmins, setIncludeAdmins] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{
    employeeId: string;
    employeeName: string;
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
            {(["7d", "30d", "90d"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${range === r ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                Last {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "90 days"}
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

          {data.dailyPageViews.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Daily Page Views</div>
              <div className="flex items-end gap-1 h-28 bg-gray-50 rounded-lg p-3">
                {data.dailyPageViews.map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center justify-end" title={`${d.day}: ${d.views} views`}>
                    <div
                      className="w-full bg-amber-400 rounded-t-sm"
                      style={{ height: `${Math.max(2, (d.views / maxDaily) * 100)}%` }}
                    />
                    <div className="text-[9px] text-gray-400 mt-1 whitespace-nowrap">{d.day.slice(5)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                      <th className="px-3 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-right">Sessions</th>
                      <th className="px-3 py-2 text-right">Page Views</th>
                      <th className="px-3 py-2 text-right">Adds</th>
                      <th className="px-3 py-2 text-right">Estimates</th>
                      <th className="px-3 py-2 text-right">Events</th>
                      <th className="px-3 py-2 text-right">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.activeUsers.map((u) => {
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
                          <td className="px-3 py-2 text-right text-gray-500">{fmtTimeAgo(u.lastSeen)}</td>
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
                      {data.topAddedItems.map((p) => (
                        <tr key={p.productId ?? p.name} className="hover:bg-gray-50">
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900 line-clamp-1">{p.name}</div>
                            {p.sku && <div className="text-[11px] text-gray-400 font-mono">{p.sku}</div>}
                          </td>
                          <td className="px-3 py-2 text-right text-amber-700 font-medium">{p.adds}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{p.qtyAdded}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{p.users}</td>
                        </tr>
                      ))}
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
                      {data.recentEstimates.map((e, idx) => (
                        <tr key={`${e.estimateId ?? "x"}-${idx}`} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                            {fmtTimeAgo(e.createdAt)}
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
                      ))}
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
