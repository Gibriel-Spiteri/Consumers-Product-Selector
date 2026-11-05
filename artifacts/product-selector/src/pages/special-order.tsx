import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Check, ChevronRight, PackagePlus, Puzzle } from "lucide-react";
import { useGetSpecialOrderProductLines, getGetSpecialOrderProductLinesQueryKey } from "@workspace/api-client-react";
import SpecialOrderForm from "@/components/special-order-form";
import VendorPicksPanel from "@/components/vendor-picks-panel";
import { useQuoteList } from "@/context/quote-list-context";
import { useVendorPicks } from "@/context/vendor-picks-context";
import { specialOrderLookupRetry } from "@/lib/special-order-query";
import { prefillFromPick, type VendorPick } from "@/lib/vendor-picks";
import { quoteHelperStatus } from "@/lib/quote-helper";
import { useQuoteHelperInfo } from "@/hooks/use-quote-helper-info";

// Points to the Consumers QuickAdd (was Quote Helper) download when this browser does not have the extension, or has
// an older version.
function QuoteHelperPrompt() {
  const { extensionReady, extensionVersion } = useVendorPicks();
  const info = useQuoteHelperInfo();
  const status = quoteHelperStatus(extensionVersion, info.data?.version ?? null, extensionReady);
  if (status === "current" || status === "unknown") return null;
  return (
    <Link
      href="/quote-helper"
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-[12px] text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      data-testid="link-get-quote-helper"
    >
      <Puzzle size={13} className="text-[#7B4DA8]" />
      {/* {status === "outdated" ? `Update the Quote Helper to ${info.data?.version}` : "Get the Quote Helper for vendor websites"} */}
      {status === "outdated" ? `Update Consumers QuickAdd to ${info.data?.version}` : "Get Consumers QuickAdd for vendor websites"}
    </Link>
  );
}

export default function SpecialOrderPage() {
  const { addSpecialOrder } = useQuoteList();
  const [, navigate] = useLocation();
  const [formKey, setFormKey] = useState(0);
  const [added, setAdded] = useState(false);
  // A product picked on a vendor website, loaded into the form (Consumers Quote Helper extension).
  const { done } = useVendorPicks();
  const [activePick, setActivePick] = useState<VendorPick | null>(null);
  const lines = useGetSpecialOrderProductLines({ query: { queryKey: getGetSpecialOrderProductLinesQueryKey(), ...specialOrderLookupRetry } });
  const formTop = useRef<HTMLDivElement>(null);
  const loadPick = (pick: VendorPick) => {
    setActivePick(pick);
    setAdded(false);
    setFormKey(key => key + 1);
    setTimeout(() => formTop.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  useEffect(() => {
    const previous = document.title;
    document.title = "Special Order | Consumers Product Selector";
    return () => { document.title = previous; };
  }, []);

  return (
    <div className="max-w-screen-xl mx-auto px-4 md:px-8 py-10">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[12px] text-gray-400 mb-6">
        <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
        <ChevronRight size={11} className="text-gray-300" />
        <span className="text-gray-600">Special Order</span>
      </nav>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <PackagePlus size={24} className="text-[#7B4DA8]" />
          Special Order
        </h1>
        <QuoteHelperPrompt />
      </div>
      {added && (
        <div role="status" className="flex flex-wrap items-center gap-2 mb-5 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm">
          <Check size={16} />
          Special-order item added to your quote list.
          <Link href="/list" className="font-semibold underline ml-auto">View Quote List</Link>
        </div>
      )}
      <VendorPicksPanel activeId={activePick?.id ?? null} onUse={loadPick} />
      <div ref={formTop} className="scroll-mt-24" />
      <SpecialOrderForm
        key={formKey}
        collapsible
        categoriesAboveForm={!activePick}
        prefill={activePick ? prefillFromPick(activePick, lines.data ?? []) : undefined}
        onCancel={() => {
          // Cancelling a vendor pick returns to the blank form; the pick stays waiting.
          if (activePick) {
            setActivePick(null);
            setFormKey(key => key + 1);
            return;
          }
          navigate("/");
        }}
        onSubmit={input => {
          addSpecialOrder(input);
          if (activePick) done(activePick.id);
          setActivePick(null);
          setAdded(true);
          setFormKey(key => key + 1);
        }}
      />
    </div>
  );
}
