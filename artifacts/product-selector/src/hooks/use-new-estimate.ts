import { useCallback, useEffect, useRef, useState } from "react";
import type { EstimateLineInput } from "@workspace/api-client-react";
import { authHeaders } from "@/context/auth-context";
import type { QuoteItem } from "@/context/quote-list-context";
import { getAnalyticsSessionId } from "@/lib/analytics";
import { clearPending, loadPending, POPUP_NAME, popupFeatures, readEstimateCreatedMessage, savePending } from "@/lib/new-estimate";

/*
 * The New Estimate flow (2026-11-11, components/new-estimate-panel.tsx explains it), as a hook since 2026-11-13 so the
 * classic panel and the one search box (Push to redesign, variant B) run the same code. Moved here unchanged.
 */
export interface NewEstimateCreated {
  estimateId: number;
  tranId: string;
  customerName: string;
}

export interface EstimateHandoff {
  token: string;
  netsuiteOrigin: string;
  snapshot: QuoteItem[];
  skipped: string[];
  startedAt: number;
}

export type NewEstimatePhase = "idle" | "starting" | "open" | "closed";

export function useNewEstimate({ buildItems, onCreated, setPushResult, describe, onPending }: {
  buildItems: () => { items: EstimateLineInput[]; snapshot: QuoteItem[] };
  onCreated: (created: NewEstimateCreated, pushed: QuoteItem[], skipped: string[]) => Promise<void>;
  setPushResult: (r: { success: boolean; message: string } | null) => void;
  describe: (snapshot: QuoteItem[], netsuiteId: string) => string;
  onPending?: () => void;
}) {
  const [phase, setPhase] = useState<NewEstimatePhase>("idle");
  const [handoff, setHandoff] = useState<EstimateHandoff | null>(null);
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
  const confirm = useCallback(async (h: EstimateHandoff, why: "message" | "closed" | "button") => {
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

  // Must run straight from a click: the pop-up is opened before anything is awaited, or the browser blocks it.
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
      const h: EstimateHandoff = {
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

  return {
    phase, handoff, checking, note,
    busy: phase === "starting" || checking,
    start, confirm, finish,
    focusPopup: () => win.current?.focus(),
  };
}
