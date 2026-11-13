import { AlertCircle, ExternalLink, Loader2, RefreshCw, UserSearch } from "lucide-react";
import type { EstimateLineInput } from "@workspace/api-client-react";
import type { QuoteItem } from "@/context/quote-list-context";
import { useNewEstimate, type NewEstimateCreated } from "@/hooks/use-new-estimate";

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
// Was: NewEstimateCreated, Handoff and Phase were declared here; they live in hooks/use-new-estimate.ts now.
export type { NewEstimateCreated };

export default function NewEstimatePanel({ buildItems, onCreated, setPushResult, describe, onPending }: {
  /** The Quote List items to hand over, or throws the reason they can't go yet. */
  buildItems: () => { items: EstimateLineInput[]; snapshot: QuoteItem[] };
  onCreated: (created: NewEstimateCreated, pushed: QuoteItem[], skipped: string[]) => Promise<void>;
  setPushResult: (r: { success: boolean; message: string } | null) => void;
  describe: (snapshot: QuoteItem[], netsuiteId: string) => string;
  /** A hand-off from before the page was left or reloaded is still open: show this panel. */
  onPending?: () => void;
}) {
  // 2026-11-13: the flow moved into hooks/use-new-estimate.ts unchanged (the one search box uses it too).
  const { phase, handoff, checking, note, busy, start, confirm, finish, focusPopup } =
    useNewEstimate({ buildItems, onCreated, setPushResult, describe, onPending });

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
                onClick={focusPopup}
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
