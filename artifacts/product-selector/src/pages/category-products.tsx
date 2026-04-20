import { useState, useMemo, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useGetCategories, getGetCategoryProductsQueryOptions } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, PackageX, Loader2, ImageOff, LayoutList, LayoutGrid, Copy, Check, X, Filter, ChevronDown, Plus, Search } from "lucide-react";
import { useCategoryPath } from "@/hooks/use-category-path";
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
  netsuiteId?: string | null;
  imageUrl?: string | null;
  fullImageUrl?: string | null;
  quantityAvailable?: number | null;
  hasActivePpr?: boolean;
  pprPriceReductionRetail?: number | null;
  isSpecialOrderStock?: boolean;
  binNumber?: string | null;
  attributes?: Array<{ name: string; value: string }>;
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

function StockBadge({ qty, isSpecialOrderStock, atpDate, noReorder }: { qty: number | null | undefined; isSpecialOrderStock?: boolean; atpDate?: string | null; noReorder?: boolean }) {
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

  // TEMPORARY: surface NetSuite flags for debugging
  return (
    <span className="inline-flex flex-wrap items-center gap-1 justify-end">
      {stock}
      {noReorder && (
        <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-50 text-rose-600" title="custitem_noreorders = T">
          NRO
        </span>
      )}
      {isSpecialOrderStock && (
        <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-violet-50 text-violet-600" title="custitem_specord_stock = T">
          SOS
        </span>
      )}
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
            <ProductImage
              imageUrl={p.imageUrl}
              name={p.name}
              className="max-w-[180px] max-h-[180px]"
            />
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
                  <PprPriceTooltip price={Number(p.price)} pprPriceReductionRetail={p.pprPriceReductionRetail} hasActivePpr={p.hasActivePpr}>
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
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 w-[140px]">Stock</th>
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-right w-[120px]">MSRP</th>
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
                  <StockBadge qty={p.quantityAvailable} isSpecialOrderStock={p.isSpecialOrderStock} atpDate={p.atpDate} noReorder={p.noReorder} />
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

interface Facet {
  name: string;
  values: Array<{ value: string; count: number }>;
}

function FacetBar({ facets, activeFilters, onToggle, onClear }: {
  facets: Facet[];
  activeFilters: Map<string, Set<string>>;
  onToggle: (facetName: string, value: string) => void;
  onClear: () => void;
}) {
  const [expandedFacet, setExpandedFacet] = useState<string | null>(null);
  const totalActive = Array.from(activeFilters.values()).reduce((sum, s) => sum + s.size, 0);

  if (facets.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500 mr-1">
          <Filter size={13} />
          Filters
        </div>
        {facets.map((facet) => {
          const activeVals = activeFilters.get(facet.name);
          const isActive = activeVals && activeVals.size > 0;
          const isExpanded = expandedFacet === facet.name;

          return (
            <div key={facet.name} className="relative">
              <button
                onClick={() => setExpandedFacet(isExpanded ? null : facet.name)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border",
                  isActive
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                )}
              >
                {facet.name}
                {isActive && (
                  <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-0.5">
                    {activeVals!.size}
                  </span>
                )}
                <ChevronDown size={12} className={cn("transition-transform", isExpanded && "rotate-180")} />
              </button>

              {isExpanded && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setExpandedFacet(null)}
                  />
                  <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-xl shadow-xl shadow-black/10 border border-gray-100 py-2 min-w-[200px] max-h-[300px] overflow-y-auto">
                    {facet.values.map(({ value, count }) => {
                      const isChecked = activeVals?.has(value) ?? false;
                      return (
                        <button
                          key={value}
                          onClick={() => onToggle(facet.name, value)}
                          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 transition-colors text-left"
                        >
                          <span className={cn(
                            "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                            isChecked ? "bg-gray-900 border-gray-900" : "border-gray-300"
                          )}>
                            {isChecked && <Check size={10} className="text-white" />}
                          </span>
                          <span className="text-[13px] text-gray-700 flex-1">{value}</span>
                          <span className="text-[11px] text-gray-400">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {totalActive > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[12px] text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={12} />
            Clear all
          </button>
        )}
      </div>

      {totalActive > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          {Array.from(activeFilters.entries()).map(([facetName, vals]) =>
            Array.from(vals).map((val) => (
              <button
                key={`${facetName}:${val}`}
                onClick={() => onToggle(facetName, val)}
                className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-medium pl-2.5 pr-1.5 py-1 rounded-full transition-colors"
              >
                <span className="text-gray-400 mr-0.5">{facetName}:</span>
                {val}
                <X size={10} className="text-gray-400" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function CategoryProducts() {
  const { categoryId } = useParams();
  const id = Number(categoryId);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [view, setView] = useState<"list" | "grid">("grid");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Map<string, Set<string>>>(new Map());
  const [refineQuery, setRefineQuery] = useState("");
  const [activeLocation, setActiveLocation] = useState<string | null>(null);

  useEffect(() => {
    setActiveFilters(new Map());
    setInStockOnly(false);
    setRefineQuery("");
    setActiveLocation(null);
  }, [id]);

  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    ...getGetCategoryProductsQueryOptions(id),
    enabled: !!id,
  });

  const { data: categoriesData } = useGetCategories();
  const path = useCategoryPath(categoriesData?.categories || [], id);
  const categoryPath = path.map(c => c.name).join(" › ");

  const isDisplaysForSale = path.length > 0 && path[0].name.toLowerCase() === "displays for sale";

  const rawFacets: Facet[] = (productsData as any)?.facets ?? [];
  const facets: Facet[] = isDisplaysForSale
    ? rawFacets.filter(f => f.name.toLowerCase() !== "manufacturer")
    : rawFacets;

  const toggleFilter = (facetName: string, value: string) => {
    setActiveFilters(prev => {
      const next = new Map(prev);
      const vals = new Set(next.get(facetName) ?? []);
      if (vals.has(value)) vals.delete(value);
      else vals.add(value);
      if (vals.size === 0) next.delete(facetName);
      else next.set(facetName, vals);
      return next;
    });
  };

  const clearFilters = () => setActiveFilters(new Map());

  const allProducts: Product[] = useMemo(() => {
    const items: Product[] = productsData?.products ?? [];
    return [...items].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  }, [productsData]);

  const locationOptions = useMemo(() => {
    if (!isDisplaysForSale) return [] as Array<{ value: string; count: number }>;
    const counts = new Map<string, number>();
    for (const p of allProducts) {
      const loc = p.binNumber?.trim();
      if (!loc) continue;
      counts.set(loc, (counts.get(loc) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([value, count]) => ({ value, count }));
  }, [allProducts, isDisplaysForSale]);

  const products = useMemo(() => {
    let filtered = allProducts;

    if (isDisplaysForSale && activeLocation) {
      filtered = filtered.filter(p => p.binNumber?.trim() === activeLocation);
    }

    if (activeFilters.size > 0) {
      const filterEntries = Array.from(activeFilters.entries());
      filtered = filtered.filter(p => {
        const attrs = p.attributes ?? [];
        for (const [facetName, requiredVals] of filterEntries) {
          let hasMatch = false;
          for (const a of attrs) {
            if (a.name === facetName && requiredVals.has(a.value)) {
              hasMatch = true;
              break;
            }
          }
          if (!hasMatch) return false;
        }
        return true;
      });
    }

    if (inStockOnly) {
      filtered = filtered.filter(p => p.quantityAvailable != null && p.quantityAvailable > 0);
    }

    if (refineQuery.trim()) {
      const q = refineQuery.trim().toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q))
      );
    }

    return filtered;
  }, [allProducts, activeFilters, inStockOnly, refineQuery, activeLocation, isDisplaysForSale]);

  const hasActiveFilters = activeFilters.size > 0 || inStockOnly || refineQuery.trim().length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">

      <ProductModal
        product={selectedProduct}
        categoryPath={categoryPath}
        onClose={() => setSelectedProduct(null)}
      />

      {/* Page Header */}
      <div className="mb-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-[12px] text-gray-400 mb-4 overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
          {path.map((cat) => (
            <span key={cat.id} className="flex items-center gap-1">
              <ChevronRight size={11} className="text-gray-300" />
              <Link href={`/category/${cat.id}`} className="hover:text-gray-600 transition-colors">
                {cat.name}
              </Link>
            </span>
          ))}
        </nav>

        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {path.length > 0 ? path[path.length - 1].name : "Products"}
            </h1>
            {!isLoadingProducts && allProducts.length > 0 && (
              <p className="text-[13px] text-gray-400 mt-1">
                {hasActiveFilters
                  ? `${products.length} of ${allProducts.length} items`
                  : `${products.length} ${products.length === 1 ? "item" : "items"}`}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">

          <button
            onClick={() => setInStockOnly(!inStockOnly)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border",
              inStockOnly
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : "bg-white text-gray-400 border-gray-200 hover:text-gray-700"
            )}
          >
            <span className={cn(
              "w-2 h-2 rounded-full transition-colors",
              inStockOnly ? "bg-emerald-500" : "bg-gray-300"
            )} />
            In Stock Only
          </button>

          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView("list")}
              title="List view"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all",
                view === "list"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-400 hover:text-gray-700"
              )}
            >
              <LayoutList size={14} />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setView("grid")}
              title="Grid view"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all",
                view === "grid"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-400 hover:text-gray-700"
              )}
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">Grid</span>
            </button>
          </div>
          </div>
        </div>
      </div>

      {isDisplaysForSale && locationOptions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <button
            onClick={() => setActiveLocation(null)}
            className={cn(
              "flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-full transition-all border whitespace-nowrap",
              activeLocation === null
                ? "bg-amber-600 border-amber-600 text-white"
                : "bg-white border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-600"
            )}
          >
            All
            <span className={cn("text-[11px] font-semibold rounded-full px-1.5 py-0.5", activeLocation === null ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-400")}>
              {allProducts.length}
            </span>
          </button>
          {locationOptions.map(({ value, count }) => {
            const active = activeLocation === value;
            return (
              <button
                key={value}
                onClick={() => setActiveLocation(active ? null : value)}
                className={cn(
                  "flex items-center gap-1.5 text-[13px] font-medium px-4 py-2 rounded-full transition-all border whitespace-nowrap",
                  active
                    ? "bg-amber-600 border-amber-600 text-white"
                    : "bg-white border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-600"
                )}
              >
                {value}
                <span className={cn("text-[11px] font-semibold rounded-full px-1.5 py-0.5", active ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-400")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex-1 min-w-0">
          <FacetBar
            facets={facets}
            activeFilters={activeFilters}
            onToggle={toggleFilter}
            onClear={clearFilters}
          />
        </div>
        <div className="relative w-52 shrink-0 ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Refine results..."
            value={refineQuery}
            onChange={e => setRefineQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-all placeholder:text-gray-300"
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

      {/* Product List / Grid */}
      {isLoadingProducts ? (
        <div className="py-40 flex flex-col items-center justify-center bg-white rounded-2xl shadow-sm">
          <Loader2 className="animate-spin text-gray-300 mb-4" size={32} />
          <p className="text-sm text-gray-400">Loading products…</p>
        </div>
      ) : products.length === 0 ? (
        <div className="py-32 text-center bg-white rounded-2xl shadow-sm flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-5">
            <PackageX size={24} className="text-gray-300" />
          </div>
          {activeFilters.size > 0 || inStockOnly ? (
            <>
              <h3 className="text-base font-semibold text-gray-700 mb-1">No matching products</h3>
              <p className="text-sm text-gray-400 max-w-xs mx-auto mb-6">
                No items match the current filters. Try adjusting or clearing them.
              </p>
              <button
                onClick={() => { clearFilters(); setInStockOnly(false); setRefineQuery(""); }}
                className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
              >
                Clear All Filters
              </button>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold text-gray-700 mb-1">No products found</h3>
              <p className="text-sm text-gray-400 max-w-xs mx-auto mb-6">
                There are no items in this category yet. Try a different one.
              </p>
              <Link
                href="/"
                className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
              >
                Browse Categories
              </Link>
            </>
          )}
        </div>
      ) : view === "list" ? (
        <ListView products={products} onSelect={setSelectedProduct} />
      ) : (
        <GridView products={products} onSelect={setSelectedProduct} />
      )}
    </div>
  );
}
