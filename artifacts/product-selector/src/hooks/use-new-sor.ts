import { useCallback, useEffect, useState } from "react";
import type { EstimateLineInput } from "@workspace/api-client-react";
import { authHeaders } from "@/context/auth-context";
import type { QuoteItem } from "@/context/quote-list-context";
import { clearPendingSor, loadPendingSor, newAttemptId, savePendingSor, type PendingNewSor } from "@/lib/new-sor";

/*
 * The New SOR flow (2026-11-12, components/new-sor-panel.tsx explains it), as a hook since 2026-11-13 so the classic
 * panel and the one search box (Push to redesign, variant B) run the same code. Moved here unchanged.
 */
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

export function useNewSor({ buildItems, onCreated, setPushResult, describe, onPending, onRefused, onSuccess }: {
  buildItems: () => { items: EstimateLineInput[]; snapshot: QuoteItem[] };
  onCreated: (created: NewSorCreated, pushed: QuoteItem[]) => Promise<void>;
  setPushResult: (r: { success: boolean; message: string; link?: { href: string; label: string } } | null) => void;
  describe: (snapshot: QuoteItem[], netsuiteId: string) => string;
  onPending?: () => void;
  /** The server refused the order (it changed since the search): search it again. */
  onRefused?: (soTranId: string) => void;
  onSuccess?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingNewSor<QuoteItem> | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const finishCreated = useCallback(async (data: NewSorCreated, p: PendingNewSor<QuoteItem>) => {
    clearPendingSor();
    setPending(null);
    setNote(null);
    onSuccess?.();
    const skipped = (data.skippedNetsuiteIds ?? []).map(String);
    await onCreated(data, p.snapshot.filter(i => !skipped.includes(String(i.netsuiteId))));
  }, [onCreated, onSuccess]);

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

  const create = async (order: { id: string; tranId: string }) => {
    if (busy || pending) return;
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
      attemptId: newAttemptId(), soId: order.id, soTranId: order.tranId, snapshot: built.snapshot, startedAt: Date.now(),
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
    if (data?.offer || res.status === 409) onRefused?.(p.soTranId);
  };

  return {
    busy, pending, note, create, checkPending,
    startOver: () => { clearPendingSor(); setPending(null); setNote(null); },
  };
}
