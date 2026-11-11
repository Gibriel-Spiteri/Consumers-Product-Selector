import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, ExternalLink, Loader2, RefreshCw, UserSearch } from "lucide-react";
import type { EstimateLineInput } from "@workspace/api-client-react";
import { authHeaders } from "@/context/auth-context";
import type { QuoteItem } from "@/context/quote-list-context";
import { getAnalyticsSessionId } from "@/lib/analytics";
import { clearPending, loadPending, POPUP_NAME, popupFeatures, readEstimateCreatedMessage, savePending } from "@/lib/new-estimate";

/*
 * New estimate from the Quote List (2026-11-11). Gib: "Can you have a button for customer search on the CPS and when
 * clicked it pops open a window for the customer search app? And only after they search with a valid phone number or
 * email address, will we give them the option to create a new customer at that spot, otherwise they'll just keep
 * creating new customers."
 *
 * Customer Search opens NetSuite's customer search (the Sales Appointments one) in a pop-up, with this Quote List
 * handed over server to server. The rep picks the customer, or adds a new one after a search by full phone number
 * or email finds nobody, and presses Create Estimate there. NetSuite creates the estimate and tells this window; the
 * server confirms it in NetSuite, then the items leave the list and the discounts are recalculated, as after a push.
 */
export interface NewEstimateCreated {
  estimateId: number;
  tranId: string;
  customerName: string;
}

interface Handoff {
  token: string;
  netsuiteOrigin: string;
  snapshot: QuoteItem[];
  skipped: string[];
  startedAt: number;
}

type Phase = "idle" | "starting" | "open" | "closed";

export default function NewEstimatePanel({ buildItems, onCreated, setPushResult, describe, onPending }: {
  /** The Quote List items to hand over, or throws the reason they can't go yet. */
  buildItems: () => { items: EstimateLineInput[]; snapshot: QuoteItem[] };
  onCreated: (created: NewEstimateCreated, pushed: QuoteItem[], skipped: string[]) => Promise<void>;
  setPushResult: (r: { success: boolean; message: string } | null) => void;
  describe: (snapshot: QuoteItem[], netsuiteId: string) => string;
  /** A hand-off from before the page was left or reloaded is still open: show this panel. */
  onPending?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const win = useRef<Window | null>(null);
  const confirming = useRef(false);

  const finish = useCallback(() => {
    clearPending();
    setHandoff(null);
    setPhase("idle");
    setNote(null);
    win.current = null;
  }, []);

  // Asks the server whether NetSuite has the estimate. Never trusts the pop-up's word alone.
  const confirm = useCallback(async (h: Handoff, why: "message" | "closed" | "button") => {
    if (confirming.current) return;
    confirming.current = true;
    setChecking(true);
    try {
      const res = await fetch(`/api/estimates/handoff/${encodeURIComponent(h.token)}/confirm`, { method: "POST", headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        finish();
        await onCreated({ estimateId: Number(data.estimateId), tranId: String(data.tranId ?? ""), customerName: String(data.customerName ?? "") },
          h.snapshot, h.skipped);
        return;
      }
      if (data?.code === "NOT_CREATED") {
        setNote(why === "button" || why === "closed"
          ? "NetSuite has no estimate from this Quote List yet, so your list is unchanged. If you did press Create Estimate, press Check NetSuite again in a moment."
          : null);
        return;
      }
      setNote(typeof data?.error === "string" ? data.error : "Could not check NetSuite for the new estimate. Press Check NetSuite.");
    } catch {
      setNote("Could not reach the server. Press Check NetSuite.");
    } finally {
      confirming.current = false;
      setChecking(false);
    }
  }, [finish, onCreated]);

  // Back on the Quote List with a hand-off still open (the page was left or reloaded): check NetSuite for it first.
  useEffect(() => {
    const pending = loadPending<QuoteItem>();
    if (!pending) return;
    setHandoff(pending);
    setPhase("closed");
    onPending?.();
    confirm(pending, "closed");
  }, []); // once, on mount

  // The pop-up's message leads to a check for as long as the hand-off is open.
  useEffect(() => {
    if (!handoff) return;
    const onMessage = (event: MessageEvent) => {
      if (readEstimateCreatedMessage(event, { origin: handoff.netsuiteOrigin, token: handoff.token })) confirm(handoff, "message");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [handoff, confirm]);

  // So does the window closing (the rep may close it without waiting for the message).
  useEffect(() => {
    if (!handoff || phase !== "open") return;
    const timer = window.setInterval(() => {
      if (win.current && !win.current.closed) return;
      window.clearInterval(timer);
      setPhase("closed");
      confirm(handoff, "closed");
    }, 1000);
    return () => window.clearInterval(timer);
  }, [handoff, phase, confirm]);

  const start = async () => {
    setPushResult(null);
    setNote(null);
    let built: { items: EstimateLineInput[]; snapshot: QuoteItem[] };
    try {
      built = buildItems();
    } catch (err: any) {
      setPushResult({ success: false, message: err?.message ?? "These items can't go on an estimate yet." });
      return;
    }
    // Opened now, while the click still counts, or the browser blocks it; it goes to NetSuite once the server answers.
    const popup = window.open("", POPUP_NAME, popupFeatures(window.screen.availWidth, window.screen.availHeight));
    if (!popup) {
      setPushResult({ success: false, message: "Your browser blocked the pop-up. Allow pop-ups for the Product Selector and press Customer Search again." });
      return;
    }
    try {
      popup.document.title = "Customer Search";
      popup.document.body.innerHTML = '<p style="font-family:system-ui,sans-serif;padding:2rem;color:#334155">Opening NetSuite Customer Search...</p>';
    } catch { /* the pop-up was already on NetSuite from an earlier start */ }
    win.current = popup;
    setPhase("starting");
    try {
      const res = await fetch("/api/estimates/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ items: built.items, analyticsSessionId: getAnalyticsSessionId() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data?.url !== "string" || typeof data?.token !== "string") {
        const invalidIds: string[] = Array.isArray(data?.invalidNetsuiteIds) ? data.invalidNetsuiteIds : [];
        throw new Error(invalidIds.length > 0
          ? `These items no longer exist in NetSuite and need to be removed from the list: ${invalidIds.map(id => built.snapshot.length ? describe(built.snapshot, id) : id).join(", ")}`
          : (typeof data?.error === "string" && data.error) || "Could not start the new estimate. Try again.");
      }
      const skipped: string[] = Array.isArray(data.skippedNetsuiteIds) ? data.skippedNetsuiteIds.map(String) : [];
      const h: Handoff = {
        token: data.token,
        netsuiteOrigin: String(data.netsuiteOrigin ?? ""),
        snapshot: built.snapshot.filter(i => !skipped.includes(String(i.netsuiteId))),
        skipped,
        startedAt: Date.now(),
      };
      savePending(h);
      setHandoff(h);
      popup.location.href = data.url;
      popup.focus();
      setPhase("open");
    } catch (err: any) {
      popup.close();
      win.current = null;
      setPhase("idle");
      setPushResult({ success: false, message: err?.message ?? "Could not start the new estimate. Try again." });
    }
  };

  const busy = phase === "starting" || checking;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="px-6 py-5 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-[15px] mb-1">Start a New Estimate</h3>
        <p className="text-[13px] text-gray-400">
          Customer Search opens NetSuite's customer search in a pop-up. Pick the customer and press Create Estimate there. To add a new
          customer, search by their full 10-digit phone number or their email first; + Add New Customer shows only when nobody has it.
        </p>
      </div>
      <div className="px-6 py-4 space-y-3">
        {phase === "idle" || phase === "starting" ? (
          <button
            onClick={start}
            disabled={busy}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            data-testid="button-new-estimate-customer-search"
          >
            {phase === "starting" ? <Loader2 size={14} className="animate-spin" /> : <UserSearch size={14} />}
            Customer Search
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2" data-testid="panel-new-estimate-waiting">
            <span className="text-sm text-gray-600 mr-2 flex items-center gap-1.5">
              {phase === "open" && <Loader2 size={14} className="animate-spin" />}
              {phase === "open"
                ? "Waiting for NetSuite: pick the customer and press Create Estimate in the pop-up."
                : "The Customer Search pop-up is closed."}
            </span>
            {phase === "open" && (
              <button
                onClick={() => win.current?.focus()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 text-[13px] font-medium rounded-xl hover:bg-gray-50"
              >
                <ExternalLink size={13} /> Show pop-up
              </button>
            )}
            <button
              onClick={() => handoff && confirm(handoff, "button")}
              disabled={checking}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 text-[13px] font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50"
              data-testid="button-new-estimate-check"
            >
              {checking ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Check NetSuite
            </button>
            {phase === "closed" && (
              <button
                onClick={() => { finish(); }}
                disabled={checking}
                className="px-3.5 py-2 bg-white border border-gray-200 text-gray-700 text-[13px] font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50"
                data-testid="button-new-estimate-start-over"
              >
                Start over
              </button>
            )}
          </div>
        )}
        {note && (
          <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-800" role="status">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{note}</span>
          </div>
        )}
      </div>
    </div>
  );
}
