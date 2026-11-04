import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Check, ChevronRight, PackagePlus } from "lucide-react";
import { useGetSpecialOrderProductLines, getGetSpecialOrderProductLinesQueryKey } from "@workspace/api-client-react";
import SpecialOrderForm from "@/components/special-order-form";
import VendorPicksPanel from "@/components/vendor-picks-panel";
import { useQuoteList } from "@/context/quote-list-context";
import { useVendorPicks } from "@/context/vendor-picks-context";
import { specialOrderLookupRetry } from "@/lib/special-order-query";
import { prefillFromPick, type VendorPick } from "@/lib/vendor-picks";

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
      <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2 mb-8">
        <PackagePlus size={24} className="text-[#7B4DA8]" />
        Special Order
      </h1>
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
