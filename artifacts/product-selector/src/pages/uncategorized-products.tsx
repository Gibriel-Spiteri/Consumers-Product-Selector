import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2, ImageOff, LayoutList, LayoutGrid, Copy, Check, PackageX } from "lucide-react";
import ProductModal from "@/components/product-modal";
import { cn, fmtPrice } from "@/lib/utils";
import { PprPriceTooltip } from "@/components/ppr-price-tooltip";

interface Product {
  id: number;
  name: string;
  sku: string | null;
  price: number | null;
  retailPrice?: number | null;
  categoryId?: number | null;
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

function StockBadge({ qty, isSpecialOrderStock, atpDate }: { qty: number | null | undefined; isSpecialOrderStock?: boolean; atpDate?: string | null }) {
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
  return (
    <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-50 text-red-500">
      Out of Stock
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
                  <PprPriceTooltip price={Number(p.price)} pprPriceReductionRetail={p.pprPriceReductionRetail} hasActivePpr={!!p.hasActivePpr}>
                    <p className={cn("text-[10px] font-semibold uppercase tracking-widest", p.hasActivePpr ? "text-emerald-600" : "text-gray-400")}>{p.hasActivePpr ? "Clearance" : "Our Price"}</p>
                    <p className={cn("font-semibold", p.hasActivePpr ? "text-emerald-600" : "text-gray-900")}>${fmtPrice(Number(p.price))}</p>
                    {p.retailPrice != null && (
                      <p className="text-[11px] text-gray-400">Retail <span className="line-through">${fmtPrice(Number(p.retailPrice))}</span></p>
                    )}
                    {p.hasActivePpr && p.pprPriceReductionRetail != null && (
                      <p className="text-[11px] text-emerald-600">You Saved ${fmtPrice(Number(p.pprPriceReductionRetail))}</p>
                    )}
                  </PprPriceTooltip>
                ) : (
                  <span className="text-gray-300 font-normal text-sm">—</span>
                )}
              </div>
              <StockBadge qty={p.quantityAvailable} isSpecialOrderStock={p.isSpecialOrderStock} atpDate={p.atpDate} />
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
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 w-[140px]">Stock</th>
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-right w-[120px]">MSRP</th>
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
                  <StockBadge qty={p.quantityAvailable} isSpecialOrderStock={p.isSpecialOrderStock} atpDate={p.atpDate} />
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  {p.price ? (
                    <PprPriceTooltip price={Number(p.price)} pprPriceReductionRetail={p.pprPriceReductionRetail} hasActivePpr={!!p.hasActivePpr}>
                      <p className={cn("font-semibold", p.hasActivePpr ? "text-emerald-600" : "text-gray-900")}>${fmtPrice(Number(p.price))}</p>
                      {p.retailPrice != null && (
                        <p className="text-[11px] text-gray-400">Retail <span className="line-through">${fmtPrice(Number(p.retailPrice))}</span></p>
                      )}
                      {p.hasActivePpr && p.pprPriceReductionRetail != null && (
                        <p className="text-[11px] text-emerald-600">You Saved ${fmtPrice(Number(p.pprPriceReductionRetail))}</p>
                      )}
                    </PprPriceTooltip>
                  ) : <span className="text-gray-300 font-normal">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function UncategorizedProducts() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["uncategorizedProducts"],
    queryFn: async () => {
      const res = await fetch("/api/products/uncategorized");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json() as Promise<{ products: Product[] }>;
    },
  });

  const products = data?.products ?? [];
  const filtered = inStockOnly ? products.filter(p => (p.quantityAvailable ?? 0) >= 1) : products;

  if (isLoading) {
    return (
      <div className="max-w-screen-xl mx-auto px-6 py-16 flex flex-col items-center gap-3 text-gray-400">
        <Loader2 className="animate-spin" size={28} />
        <p className="text-sm">Loading uncategorized products…</p>
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-8">
      <nav className="flex items-center gap-1.5 text-[13px] text-gray-400 mb-6">
        <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
        <ChevronRight size={12} />
        <span className="text-gray-900 font-medium">Uncategorized Products</span>
      </nav>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Uncategorized Products</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} item{filtered.length !== 1 ? "s" : ""} without a category assignment
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

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <PackageX size={40} className="mb-3" />
          <p className="text-lg font-medium text-gray-500">No uncategorized products</p>
          <p className="text-sm mt-1">All products have been assigned to categories.</p>
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
