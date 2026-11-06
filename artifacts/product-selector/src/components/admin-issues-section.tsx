import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, ChevronLeft, ChevronRight, ImageOff, ExternalLink, Inbox } from "lucide-react";
import { useGetAdminIssues, getGetAdminIssuesQueryKey } from "@workspace/api-client-react";
import type { AdminIssue } from "@workspace/api-client-react";
import { authHeaders } from "@/context/auth-context";
import AdminCollapsibleSection from "@/components/admin-collapsible-section";

const STALE_MS = 5 * 60 * 1000;

function formatDateTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }) + " ET";
}

function safeHttpUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function statusTone(status: string | null) {
  const s = (status ?? "").toLowerCase();
  if (!s) return "bg-gray-100 text-gray-600 border-gray-200";
  if (/(closed|resolved|complete)/.test(s)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (/(escalat|urgent|reopen)/.test(s)) return "bg-red-50 text-red-700 border-red-200";
  if (/(progress|assigned|working)/.test(s)) return "bg-sky-50 text-sky-700 border-sky-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function IssueScreenshot({ issue }: { issue: AdminIssue }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [attempt, setAttempt] = useState(0);
  const path = issue.screenshotUrl;

  useEffect(() => {
    if (!path) return;
    let created: string | null = null;
    const controller = new AbortController();
    setState("loading");
    fetch(path, { headers: authHeaders(), signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(String(r.status));
        return r.blob();
      })
      .then(blob => {
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
        setState("ready");
      })
      .catch(err => {
        if ((err as Error).name !== "AbortError") setState("error");
      });
    return () => {
      controller.abort();
      if (created) URL.revokeObjectURL(created);
      setObjectUrl(null);
    };
  }, [path, attempt]);

  if (!path) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-500" data-testid={`text-screenshot-missing-${issue.id}`}>
        <ImageOff size={14} className="mt-0.5 shrink-0 text-gray-400" />
        <span>{issue.captureError || "No screenshot."}</span>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        <span>Could not load screenshot.</span>
        <button onClick={() => setAttempt(a => a + 1)} className="font-medium underline underline-offset-2" data-testid={`button-retry-screenshot-${issue.id}`}>Retry</button>
      </div>
    );
  }
  if (state !== "ready" || !objectUrl) {
    return <div className="h-40 w-full animate-pulse rounded-lg bg-gray-100" />;
  }
  return (
    <div>
      <a href={objectUrl} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-gray-200 bg-gray-50 hover:border-amber-300" data-testid={`link-screenshot-${issue.id}`}>
        <img src={objectUrl} alt={`Screenshot for ${issue.subject}`} className="max-h-64 w-full object-contain object-top" />
      </a>
      <a href={objectUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700">
        View full size <ExternalLink size={11} />
      </a>
    </div>
  );
}

function Label({ children }: { children: string }) {
  return <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{children}</div>;
}

function IssueRow({ issue }: { issue: AdminIssue }) {
  const url = safeHttpUrl(issue.pageUrl);
  const errors = issue.browserLogs.filter(l => l.level === "error").length;
  const warns = issue.browserLogs.length - errors;
  const failed = !issue.caseId && issue.submissionState !== "pending";

  return (
    <details className="group/issue border-b border-gray-200 last:border-b-0" data-testid={`row-issue-${issue.id}`}>
      <summary className="flex cursor-pointer list-none items-start gap-3 px-3 py-3 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 [&::-webkit-details-marker]:hidden">
        <ChevronRight size={14} className="mt-1 shrink-0 text-gray-400 transition-transform group-open/issue:rotate-90" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-gray-900 break-words">{issue.subject}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
            <span>{issue.employeeName}</span>
            <span>{formatDateTime(issue.createdAt)}</span>
            {issue.browserLogs.length > 0 && (
              <span className={errors ? "text-red-600" : "text-amber-600"}>
                {errors} error{errors !== 1 ? "s" : ""}, {warns} warning{warns !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {issue.caseNumber || issue.caseId ? (
            <>
              <div className="font-mono text-xs font-semibold text-gray-800" data-testid={`text-case-number-${issue.id}`}>
                {issue.caseNumber ? `Case ${issue.caseNumber}` : `Case number pending (ID ${issue.caseId})`}
              </div>
              <span className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${statusTone(issue.caseStatus)}`} data-testid={`status-case-${issue.id}`}>
                {issue.caseStatus ?? "Status unknown"}
              </span>
            </>
          ) : (
            <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-medium ${failed ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-100 text-gray-600 border-gray-200"}`} data-testid={`status-submission-${issue.id}`}>
              {failed ? "Case unconfirmed" : "Creating case"}
            </span>
          )}
        </div>
      </summary>

      <div className="space-y-4 px-3 pb-4 pl-9">
        {issue.submissionError && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 break-words">Submission error: {issue.submissionError}</div>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 min-w-0">
            <div>
              <Label>Detail</Label>
              <p className="whitespace-pre-wrap break-words text-sm text-gray-700">{issue.detail}</p>
            </div>
            <div>
              <Label>Page URL</Label>
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-amber-700 hover:underline" data-testid={`link-page-url-${issue.id}`}>{url}</a>
              ) : (
                <span className="break-all text-xs text-gray-500">{issue.pageUrl || "Not recorded"}</span>
              )}
            </div>
            <div>
              <Label>Browser</Label>
              <p className="break-words text-xs text-gray-600">{issue.browserInfo || "Not recorded"}</p>
            </div>
            {issue.statusCheckedAt && (
              <div className="text-[11px] text-gray-400">Status checked {formatDateTime(issue.statusCheckedAt)}</div>
            )}
          </div>
          <div className="min-w-0">
            <Label>Screenshot</Label>
            <IssueScreenshot issue={issue} />
          </div>
        </div>
        <div>
          <Label>Recent browser warnings / errors</Label>
          {issue.browserLogs.length === 0 ? (
            <p className="text-xs text-gray-500">None captured.</p>
          ) : (
            <ul className="max-h-60 overflow-auto rounded-lg border border-gray-200 bg-gray-50 font-mono text-[11px]">
              {issue.browserLogs.map((log, i) => (
                <li key={i} className="flex gap-2 border-b border-gray-200 px-2 py-1.5 last:border-b-0">
                  <span className={`shrink-0 font-semibold uppercase ${log.level === "error" ? "text-red-600" : "text-amber-600"}`}>{log.level}</span>
                  <span className="shrink-0 text-gray-400">{log.timestamp}</span>
                  <span className="min-w-0 whitespace-pre-wrap break-words text-gray-700">{log.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </details>
  );
}

export default function AdminIssuesSection() {
  const [page, setPage] = useState(1);
  const params = { page };
  const query = useGetAdminIssues(params, {
    query: { queryKey: getGetAdminIssuesQueryKey(params), refetchInterval: 60000, staleTime: 0 },
  });
  const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } = query;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / Math.max(1, data.pageSize))) : 1;
  const stale = !!data && dataUpdatedAt > 0 && Date.now() - dataUpdatedAt > STALE_MS;

  const preview = (
    <span className="text-xs text-gray-500">
      {isLoading ? "Loading…" : isError ? "Unavailable" : `${data?.total ?? 0} report${data?.total === 1 ? "" : "s"}`}
    </span>
  );

  return (
    <AdminCollapsibleSection title="Issues & Bugs" preview={preview}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">Reported issues with NetSuite case numbers and statuses. Refreshes every 60 seconds.</p>
        <button
          onClick={() => void refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          data-testid="button-refresh-issues"
        >
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
          {isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {data?.statusSyncError && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="text-status-sync-error">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>Case statuses could not be refreshed from NetSuite and may be out of date: {data.statusSyncError}</span>
        </div>
      )}
      {stale && !isError && (
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">This list was last updated {formatDateTime(new Date(dataUpdatedAt).toISOString())}.</div>
      )}
      {isError && data && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">Latest refresh failed; showing earlier results.</div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />)}
        </div>
      ) : isError && !data ? (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" data-testid="text-issues-error">
          <span>Could not load reported issues.</span>
          <button onClick={() => void refetch()} className="font-medium underline underline-offset-2" data-testid="button-retry-issues">Try again</button>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg bg-gray-50 py-10 text-center text-gray-400" data-testid="text-issues-empty">
          <Inbox size={28} className="mb-2" />
          <span className="text-sm font-medium text-gray-600">No issues reported</span>
          <span className="text-xs">New reports will appear here.</span>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            {data.items.map(issue => <IssueRow key={issue.id} issue={issue} />)}
          </div>
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
              <span>Page {data.page} of {totalPages} ({data.total} total)</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 hover:bg-gray-50 disabled:opacity-40" data-testid="button-issues-prev">
                  <ChevronLeft size={12} /> Prev
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 hover:bg-gray-50 disabled:opacity-40" data-testid="button-issues-next">
                  Next <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </AdminCollapsibleSection>
  );
}
