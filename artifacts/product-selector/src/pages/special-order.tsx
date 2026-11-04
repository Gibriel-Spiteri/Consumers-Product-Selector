import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Check, ChevronRight, PackagePlus } from "lucide-react";
import SpecialOrderForm from "@/components/special-order-form";
import { useQuoteList } from "@/context/quote-list-context";

export default function SpecialOrderPage() {
  const { addSpecialOrder } = useQuoteList();
  const [, navigate] = useLocation();
  const [formKey, setFormKey] = useState(0);
  const [added, setAdded] = useState(false);

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
      <SpecialOrderForm
        key={formKey}
        categoriesAboveForm
        onCancel={() => navigate("/")}
        onSubmit={input => {
          addSpecialOrder(input);
          setAdded(true);
          setFormKey(key => key + 1);
        }}
      />
    </div>
  );
}
