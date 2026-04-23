import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2, ImageOff, LayoutList, LayoutGrid, Copy, Check, PackageX, Plus, Search, X } from "lucide-react";
import ProductModal from "@/components/product-modal";
import { cn, fmtPrice } from "@/lib/utils";
import { useQuoteList } from "@/context/quote-list-context";
import { PprPriceTooltip } from "@/components/ppr-price-tooltip";

interface Product {
  id: number;
  name: string;
  sku: string | null;
  price: number | null;
  retailPrice?: number | null;
  categoryId?: number | null;
  categoryParentId?: number | null;
  categoryParentName?: string | null;
  netsuiteId?: string | null;
  imageUrl?: string | null;
  fullImageUrl?: string | null;
  quantityAvailable?: number | null;
  hasActivePpr?: boolean;
  pprPriceReductionRetail?: number | null;
  isSpecialOrderStock?: boolean;
  atpDate?: string | null;
}

function formatAtpDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function FlagBadges({ noReorder, isSpecialOrderStock }: { noReorder?: boolean; isSpecialOrderStock?: boolean }) {
  if (!noReorder && !isSpecialOrderStock) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {noReorder && (
        <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-50 text-rose-600" title="No Reorders">
          NRO
        </span>
      )}
      {isSpecialOrderStock && (
        <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-600" title="Special Order Stock">
          SOS
        </span>
      )}
    </span>
  );
}

function StockBadge({ qty, isSpecialOrderStock, atpDate, noReorder, showFlags = true }: { qty: number | null | undefined; isSpecialOrderStock?: boolean; atpDate?: string | null; noReorder?: boolean; showFlags?: boolean }) {
  const stock = (() => {
    if (qty == null) return null;
    if (qty >= 1) return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 cursor-default">
        In Stock ({qty})
      </span>
    );
    if (isSpecialOrderStock) return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
        Non-Stock
      </span>
    );
    const atp = formatAtpDate(atpDate);
    return (
      <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
        {atp ? `EST: ${atp}` : "Out of Stock"}
      </span>
    );
  })();

  return (
    <span className="inline-flex flex-wrap items-center gap-1 justify-end">
      {stock}
      {showFlags && <FlagBadges noReorder={noReorder} isSpecialOrderStock={isSpecialOrderStock} />}
    </span>
  );
}

function ProductImage({ imageUrl, name, className }: { imageUrl?: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!imageUrl || failed) {
    return (
      <div className={cn("flex items-center justify-center text-muted-foreground/30", className)}>
        <ImageOff size={20} />
      </div>
    );
  }
  return (
    <img
      src={imageUrl}
      alt={name}
      onError={() => setFailed(true)}
      className={cn("object-contain", className)}
    />
  );
}

function CopySkuButton({ sku }: { sku: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sku).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy model number"
      className="flex items-center gap-1.5 font-mono bg-gray-100 hover:bg-gray-200 hover:text-gray-700 px-2 py-0.5 rounded-full transition-all text-[12px] text-[#1f2630]"
    >
      {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
      {sku}
    </button>
  );
}

function AddToListButton({ product }: { product: Product }) {
  const { addItem, isInList } = useQuoteList();
  const [justAdded, setJustAdded] = useState(false);
  const inList = isInList(product.id);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inList) return;
    addItem({
      productId: product.id,
      netsuiteId: product.netsuiteId ?? "",
      name: product.name,
      sku: product.sku,
      price: product.price ? Number(product.price) : null,
      imageUrl: product.imageUrl ?? null,
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
  };

  if (inList) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
        <Check size={10} /> On List
      </span>
    );
  }

  return (
    <button
      onClick={handleAdd}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-full transition-all",
        justAdded
          ? "bg-emerald-50 text-emerald-600"
          : "bg-gray-100 text-gray-500 hover:bg-amber-50 hover:text-amber-600"
      )}
    >
      {justAdded ? <><Check size={10} /> Added</> : <><Plus size={10} /> Add</>}
    </button>
  );
}

function GridView({ products, onSelect }: { products: Product[]; onSelect: (p: Product) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
      {products.map(p => (
        <div
          key={p.id}
          onClick={() => onSelect(p)}
          className="bg-white rounded-2xl overflow-hidden cursor-pointer group hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/8 transition-all duration-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
        >
          <div className="bg-white h-[196px] flex items-center justify-center p-2">
            <ProductImage imageUrl={p.imageUrl} name={p.name} className="max-w-[180px] max-h-[180px]" />
          </div>
          <div className="px-5 pb-5 pt-0">
            <p className="text-[14px] font-medium text-gray-900 leading-snug line-clamp-2 mb-2.5 group-hover:text-primary transition-colors">
              {p.name}
            </p>
            {p.sku && (
              <div className="mb-3">
                <CopySkuButton sku={p.sku} />
              </div>
            )}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                {p.price ? (
                  <PprPriceTooltip price={Number(p.price)} pprPriceReductionRetail={p.pprPriceReductionRetail} hasActivePpr={true}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">Clearance</p>
                    <p className="font-semibold text-emerald-600">${fmtPrice(Number(p.price))}</p>
                    {p.retailPrice != null && (
                      <p className="text-[11px] text-gray-400">Retail <span className="line-through">${fmtPrice(Number(p.retailPrice))}</span></p>
                    )}
                    {p.pprPriceReductionRetail != null && (
                      <p className="text-[11px] text-emerald-600">You Saved ${fmtPrice(Number(p.pprPriceReductionRetail))}</p>
                    )}
                  </PprPriceTooltip>
                ) : (
                  <span className="text-gray-300 font-normal text-sm">—</span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <StockBadge qty={p.quantityAvailable} isSpecialOrderStock={p.isSpecialOrderStock} atpDate={p.atpDate} noReorder={p.noReorder} />
                <AddToListButton product={p} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ListView({ products, onSelect }: { products: Product[]; onSelect: (p: Product) => void }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 w-16"></th>
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 w-[140px]">SKU</th>
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Product</th>
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 w-[120px]">Stock</th>
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 w-[90px]">Flags</th>
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-emerald-600 text-right w-[120px]">Clearance</th>
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 w-[80px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map(p => (
              <tr
                key={p.id}
                onClick={() => onSelect(p)}
                className="hover:bg-gray-50 transition-colors group cursor-pointer"
              >
                <td className="px-5 py-3">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0">
                    <ProductImage imageUrl={p.imageUrl} name={p.name} className="max-w-[46px] max-h-[46px]" />
                  </div>
                </td>
                <td className="px-5 py-3 whitespace-nowrap">
                  {p.sku ? <CopySkuButton sku={p.sku} /> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-5 py-3 font-medium text-gray-900 group-hover:text-primary transition-colors">
                  {p.name}
                </td>
                <td className="px-5 py-3 whitespace-nowrap">
                  <StockBadge qty={p.quantityAvailable} isSpecialOrderStock={p.isSpecialOrderStock} atpDate={p.atpDate} noReorder={p.noReorder} showFlags={false} />
                </td>
                <td className="px-5 py-3 whitespace-nowrap">
                  <FlagBadges noReorder={p.noReorder} isSpecialOrderStock={p.isSpecialOrderStock} />
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  {p.price ? (
                    <PprPriceTooltip price={Number(p.price)} pprPriceReductionRetail={p.pprPriceReductionRetail} hasActivePpr={true}>
                      <p className="font-semibold text-emerald-600">${fmtPrice(Number(p.price))}</p>
                      {p.retailPrice != null && (
                        <p className="text-[11px] text-gray-400">Retail <span className="line-through">${fmtPrice(Number(p.retailPrice))}</span></p>
                      )}
                      {p.pprPriceReductionRetail != null && (
                        <p className="text-[11px] text-emerald-600">You Saved ${fmtPrice(Number(p.pprPriceReductionRetail))}</p>
                      )}
                    </PprPriceTooltip>
                  ) : <span className="text-gray-300 font-normal">—</span>}
                </td>
                <td className="px-5 py-3 whitespace-nowrap">
                  <AddToListButton product={p} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ClearancePage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [refineQuery, setRefineQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["clearanceProducts"],
    queryFn: async () => {
      const res = await fetch("/api/products/clearance");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json() as Promise<{ products: Product[] }>;
    },
  });

  const products = data?.products ?? [];

  const parentCategories = useMemo(() => {
    const displayNames: Record<string, string> = {
      "Bathroom Sinks": "Sinks",
      "Toilets": "Fixtures",
    };
    const map = new Map<number, { id: number; name: string; count: number }>();
    for (const p of products) {
      if (p.categoryParentId && p.categoryParentName) {
        const existing = map.get(p.categoryParentId);
        if (existing) {
          existing.count++;
        } else {
          const label = displayNames[p.categoryParentName] ?? p.categoryParentName;
          map.set(p.categoryParentId, { id: p.categoryParentId, name: label, count: 1 });
        }
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  let filtered = products;
  if (activeCategoryId) filtered = filtered.filter(p => p.categoryParentId === activeCategoryId);
  if (inStockOnly) filtered = filtered.filter(p => (p.quantityAvailable ?? 0) >= 1);
  if (refineQuery.trim()) {
    const q = refineQuery.trim().toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    );
  }

  filtered = [...filtered].sort((a, b) => {
    const ac = a.categoryParentName ?? "\uffff";
    const bc = b.categoryParentName ?? "\uffff";
    const byCat = ac.localeCompare(bc);
    if (byCat !== 0) return byCat;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  if (isLoading) {
    return (
      <div className="max-w-screen-xl mx-auto px-6 py-16 flex flex-col items-center gap-3 text-gray-400">
        <Loader2 className="animate-spin" size={28} />
        <p className="text-sm">Loading clearance items…</p>
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-8">
      <nav className="flex items-center gap-1.5 text-[13px] text-gray-400 mb-6">
        <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
        <ChevronRight size={12} />
        <span className="text-emerald-600 font-medium">Clearance</span>
      </nav>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-emerald-600">Clearance</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} item{filtered.length !== 1 ? "s" : ""} with active promotional pricing
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setInStockOnly(!inStockOnly)}
            className={cn(
              "flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-full transition-all border",
              inStockOnly
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", inStockOnly ? "bg-emerald-500" : "bg-gray-300")} />
            In Stock Only
          </button>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-all",
                viewMode === "list" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <LayoutList size={14} /> List
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-all",
                viewMode === "grid" ? "bg-gray-100 text-gray-900" : "text-gray-400 hover:text-gray-600"
              )}
            >
              <LayoutGrid size={14} /> Grid
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {parentCategories.length > 1 && (
          <>
            <button
              onClick={() => setActiveCategoryId(null)}
              className={cn(
                "flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-full transition-all border whitespace-nowrap",
                activeCategoryId === null
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-600"
              )}
            >
              All
              <span className={cn("text-[11px] font-semibold rounded-full px-1.5 py-0.5", activeCategoryId === null ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400")}>
                {products.length}
              </span>
            </button>
            {parentCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategoryId(activeCategoryId === cat.id ? null : cat.id)}
                className={cn(
                  "flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-full transition-all border whitespace-nowrap",
                  activeCategoryId === cat.id
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-600"
                )}
              >
                {cat.name}
                <span className={cn("text-[11px] font-semibold rounded-full px-1.5 py-0.5", activeCategoryId === cat.id ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400")}>
                  {cat.count}
                </span>
              </button>
            ))}
          </>
        )}
        <div className="relative w-64 ml-auto shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Refine results..."
            value={refineQuery}
            onChange={e => setRefineQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-all placeholder:text-gray-300"
          />
          {refineQuery && (
            <button
              onClick={() => setRefineQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <PackageX size={40} className="mb-3" />
          <p className="text-lg font-medium text-gray-500">No clearance items</p>
          <p className="text-sm mt-1">There are no products with active promotional pricing right now.</p>
        </div>
      ) : viewMode === "grid" ? (
        <GridView products={filtered} onSelect={setSelectedProduct} />
      ) : (
        <ListView products={filtered} onSelect={setSelectedProduct} />
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
