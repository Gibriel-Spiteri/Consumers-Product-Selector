import { useState } from "react";
import { Link } from "wouter";
import { ChevronRight, Trash2, Minus, Plus, ClipboardList, Search, Loader2, Send, Check, AlertCircle, ImageOff, X } from "lucide-react";
import { useQuoteList } from "@/context/quote-list-context";
import { cn, fmtPrice } from "@/lib/utils";

interface Estimate {
  id: number;
  tranId: string;
  customerName: string;
  status: string;
  date: string;
  total: number | null;
}

function ProductImage({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-300">
        <ImageOff size={16} />
      </div>
    );
  }
  return <img src={src} alt={name} onError={() => setFailed(true)} className="w-full h-full object-contain" />;
}

function EstimateSearch({ onPush, pushResult, setPushResult }: {
  onPush: (estimateId: number, tranId: string) => Promise<void>;
  pushResult: { success: boolean; message: string } | null;
  setPushResult: (r: { success: boolean; message: string } | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Estimate[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Estimate | null>(null);
  const [pushing, setPushing] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSelected(null);
    setPushResult(null);
    try {
      const res = await fetch(`/api/estimates/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (res.ok) {
        setResults(data.estimates ?? []);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handlePush = async () => {
    if (!selected) return;
    setPushing(true);
    setPushResult(null);
    try {
      await onPush(selected.id, selected.tranId);
    } catch (err: any) {
      setPushResult({ success: false, message: err?.message ?? "Failed to add items to estimate" });
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <div className="px-6 py-5 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-[15px] mb-1">Push to NetSuite Estimate</h3>
        <p className="text-[13px] text-gray-400">Search for an existing estimate to add these items to it.</p>
      </div>

      <div className="px-6 py-4">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by estimate # or customer name..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 focus:bg-white transition-all"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
        </div>

        {results.length > 0 && (
          <div className="border border-gray-100 rounded-xl overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left w-8"></th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left">Estimate #</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left">Customer</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left">Status</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-left">Date</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {results.map(est => {
                  const isOpen = est.status.toLowerCase().includes("open");
                  const isSelected = selected?.id === est.id;
                  return (
                    <tr
                      key={est.id}
                      onClick={() => isOpen && setSelected(est)}
                      className={cn(
                        "transition-colors",
                        isOpen ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                        isSelected ? "bg-amber-50" : isOpen ? "hover:bg-gray-50" : ""
                      )}
                      title={isOpen ? undefined : "Only open estimates can receive items"}
                    >
                      <td className="px-4 py-2.5">
                        {isOpen ? (
                          <span className={cn(
                            "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                            isSelected ? "bg-amber-500 border-amber-500" : "border-gray-300"
                          )}>
                            {isSelected && <Check size={10} className="text-white" />}
                          </span>
                        ) : (
                          <span className="w-4 h-4 rounded-full border-2 border-gray-200 bg-gray-100 flex items-center justify-center shrink-0" />
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-medium text-gray-900">{est.tranId}</td>
                      <td className="px-4 py-2.5 text-gray-700">{est.customerName}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn(
                          "text-[11px] font-medium px-2 py-0.5 rounded-full",
                          isOpen ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                        )}>
                          {est.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">{est.date}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                        {est.total != null ? `$${fmtPrice(est.total)}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {results.length === 0 && !searching && query.trim() && (
          <p className="text-sm text-gray-400 text-center py-4">No estimates found for "{query}"</p>
        )}

        {selected && (
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <div className="text-sm">
              <span className="text-gray-500">Selected: </span>
              <span className="font-medium text-gray-900">{selected.tranId}</span>
              <span className="text-gray-400"> — {selected.customerName}</span>
            </div>
            <button
              onClick={handlePush}
              disabled={pushing}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {pushing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Push Items to Estimate
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default function QuoteListPage() {
  const { items, removeItem, updateQuantity, clearList, totalItems, totalLineItems, grandTotal } = useQuoteList();
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string } | null>(null);

  const itemsMissingNsId = items.filter(i => !i.netsuiteId);

  const handlePushToEstimate = async (estimateId: number, tranId: string) => {
    const pushableItems = items.filter(i => i.netsuiteId);
    if (pushableItems.length === 0) {
      throw new Error("No items with valid NetSuite IDs to push");
    }
    const payload = {
      items: pushableItems.map(i => ({
        netsuiteId: i.netsuiteId,
        quantity: i.quantity,
      })),
    };

    const res = await fetch(`/api/estimates/${estimateId}/add-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const invalidIds: string[] = data?.invalidNetsuiteIds ?? [];
      if (invalidIds.length > 0) {
        const skuList = invalidIds
          .map(id => pushableItems.find(i => String(i.netsuiteId) === String(id))?.sku ?? `NetSuite ID ${id}`)
          .join(", ");
        throw new Error(`These items no longer exist in NetSuite and need to be removed from the list: ${skuList}`);
      }
      throw new Error(data.error ?? "Failed to add items to estimate");
    }

    const skipped: string[] = data?.skippedNetsuiteIds ?? [];
    const added = data?.itemsAdded ?? pushableItems.length;
    let msg = `Successfully added ${added} item${added === 1 ? "" : "s"} to estimate ${tranId}`;
    if (skipped.length > 0) {
      const skuList = skipped
        .map(id => pushableItems.find(i => String(i.netsuiteId) === String(id))?.sku ?? `NetSuite ID ${id}`)
        .join(", ");
      msg += ` — skipped (no longer in NetSuite): ${skuList}`;
    }
    setPushResult({ success: true, message: msg });
    clearList();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-10">
      <nav className="flex items-center gap-1 text-[12px] text-gray-400 mb-6">
        <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
        <ChevronRight size={11} className="text-gray-300" />
        <span className="text-gray-600">Quote List</span>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList size={24} className="text-amber-500" />
            Quote List
          </h1>
        </div>
        {items.length > 0 && (
          <button
            onClick={clearList}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <Trash2 size={12} />
            Clear List
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="space-y-6">
          {pushResult && (
            <div className={cn(
              "flex items-center gap-2 px-5 py-4 rounded-2xl text-sm font-medium",
              pushResult.success ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
            )}>
              {pushResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{pushResult.message}</span>
              <button onClick={() => setPushResult(null)} className="ml-auto p-1 hover:opacity-70 transition-opacity">
                <X size={14} />
              </button>
            </div>
          )}
          <div className="py-32 text-center bg-white rounded-2xl shadow-sm flex flex-col items-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-5">
              {pushResult?.success ? (
                <Check size={24} className="text-emerald-400" />
              ) : (
                <ClipboardList size={24} className="text-gray-300" />
              )}
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">
              {pushResult?.success ? "Items submitted successfully" : "Your quote list is empty"}
            </h3>
            <p className="text-sm text-gray-400 max-w-xs mx-auto mb-6">
              {pushResult?.success
                ? "Your items have been added to the estimate. Start a new list or continue browsing."
                : "Browse products and add them to your list to create a quote."}
            </p>
            <Link
              href="/"
              className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
            >
              Browse Products
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 w-16"></th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Product</th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 w-[120px]">SKU</th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-right w-[100px]">Price</th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-center w-[140px]">Qty</th>
                    <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-right w-[100px]">Total</th>
                    <th className="px-5 py-3.5 w-[50px]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map(item => (
                    <tr key={item.productId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                          <ProductImage src={item.imageUrl} name={item.name} />
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900 text-[14px]">{item.name}</p>
                      </td>
                      <td className="px-5 py-3">
                        {item.sku ? (
                          <span className="font-mono text-[12px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{item.sku}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {item.price != null ? (
                          <span className="font-medium text-gray-900">${fmtPrice(item.price)}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center">
                          <div className="flex items-center border border-gray-200 rounded-lg">
                            <button
                              onClick={() => item.quantity <= 1 ? removeItem(item.productId) : updateQuantity(item.productId, item.quantity - 1)}
                              className="px-2 py-1.5 hover:bg-gray-50 text-gray-500 transition-colors rounded-l-lg"
                            >
                              <Minus size={12} />
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={e => {
                                const v = parseInt(e.target.value);
                                if (v >= 1) updateQuantity(item.productId, v);
                              }}
                              className="w-12 text-center text-sm font-medium text-gray-900 border-x border-gray-200 py-1.5 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                              className="px-2 py-1.5 hover:bg-gray-50 text-gray-500 transition-colors rounded-r-lg"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {item.price != null ? (
                          <span className="font-semibold text-gray-900">${fmtPrice(item.price * item.quantity)}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Remove item"
                        >
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={4} className="px-5 py-4 text-right">
                      <span className="text-[13px] font-semibold uppercase tracking-widest text-gray-500">Grand Total</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-sm font-semibold text-gray-900">{totalItems} units</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-lg font-bold text-gray-900">${fmtPrice(grandTotal)}</span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {pushResult && !pushResult.success && (
            <div className="flex items-center gap-2 px-5 py-4 rounded-2xl text-sm font-medium bg-red-50 text-red-700 border border-red-200">
              <AlertCircle size={16} />
              <span>{pushResult.message}</span>
              <button onClick={() => setPushResult(null)} className="ml-auto p-1 hover:opacity-70 transition-opacity">
                <X size={14} />
              </button>
            </div>
          )}

          {itemsMissingNsId.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
              <AlertCircle size={14} className="shrink-0" />
              {itemsMissingNsId.length} {itemsMissingNsId.length === 1 ? "item" : "items"} missing NetSuite ID and will be skipped when pushing to an estimate.
            </div>
          )}

          <EstimateSearch onPush={handlePushToEstimate} pushResult={pushResult} setPushResult={setPushResult} />
        </div>
      )}
    </div>
  );
}
