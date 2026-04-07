import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Search, Loader2, ChevronRight, Package, Folders, Copy, Check, RefreshCw, ClipboardList } from "lucide-react";
import { useQuoteList } from "@/context/quote-list-context";
import { useGetCategories, useSearchProducts, getSearchProductsQueryKey } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useQueryClient, useQuery } from "@tanstack/react-query";

function SyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; detail: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const qc = useQueryClient();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => () => stopPolling(), []);

  return (
    <div className="ml-auto mr-4 relative">
      <button
        onClick={async () => {
          if (syncing) return;
          setSyncing(true);
          setResult(null);
          setProgress({ percent: 2, detail: "Starting…" });
          pollRef.current = setInterval(async () => {
            try {
              const r = await fetch("/api/dev/sync/progress");
              const p = await r.json();
              if (p.stage !== "idle") setProgress({ percent: p.percent, detail: p.detail });
            } catch {}
          }, 600);
          try {
            const res = await fetch("/api/dev/sync", { method: "POST" });
            const data = await res.json();
            stopPolling();
            if (data.status === "complete") {
              setProgress({ percent: 100, detail: "Complete!" });
              setResult(`Synced ${data.productsSynced} products`);
              qc.invalidateQueries();
            } else if (data.status === "already_running") {
              setResult("Sync already running");
            } else {
              setResult("Sync failed");
            }
          } catch {
            stopPolling();
            setResult("Sync failed");
          } finally {
            setSyncing(false);
            setTimeout(() => { setResult(null); setProgress(null); }, 4000);
          }
        }}
        disabled={syncing}
        className="flex items-center gap-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-60 relative overflow-hidden"
      >
        {syncing && progress && (
          <span
            className="absolute inset-y-0 left-0 bg-amber-300/40 transition-all duration-300 ease-out"
            style={{ width: `${progress.percent}%` }}
          />
        )}
        <span className="relative flex items-center gap-1.5">
          <RefreshCw size={12} className={syncing ? "animate-spin" : ""} />
          {result ?? (syncing && progress ? progress.detail : "Sync NetSuite")}
        </span>
      </button>
    </div>
  );
}

function ProductStatsDebug() {
  const { data, isLoading } = useQuery({
    queryKey: ["productStats"],
    queryFn: async () => {
      const res = await fetch("/api/products/stats");
      if (!res.ok) return null;
      return res.json() as Promise<{ totalProducts: number; productsWithoutCategory: number }>;
    },
    staleTime: 60000,
  });

  if (isLoading || !data) return null;

  return (
    <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-center gap-4 text-[11px] font-mono text-white/30">
      <span>Total Products: {data.totalProducts}</span>
      <span className="w-px h-3 bg-white/15" />
      <Link href="/uncategorized" className="text-amber-400/60 hover:text-amber-400 transition-colors cursor-pointer underline underline-offset-2 text-[14px]">
        Without Category: {data.productsWithoutCategory}
      </Link>
    </div>
  );
}

function QuoteListBadge() {
  const { totalLineItems } = useQuoteList();
  return (
    <Link href="/list" className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors mr-3 group" title="Quote List">
      <ClipboardList size={18} className="text-gray-500 group-hover:text-gray-700 transition-colors" />
      {totalLineItems > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-amber-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
          {totalLineItems > 99 ? "99+" : totalLineItems}
        </span>
      )}
    </Link>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [isHoveringNav, setIsHoveringNav] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [copiedSku, setCopiedSku] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const { data: categoryData, isLoading: isLoadingCategories } = useGetCategories();

  const categories = categoryData?.categories || [];
  const topLevelCategories = categories.filter(c => c.level === 1);

  const flatCategories = useMemo(() => {
    const result: Array<{ id: number; name: string; level: number; parentId: number | null }> = [];
    const flatten = (nodes: typeof categories) => {
      for (const node of nodes) {
        result.push({ id: node.id, name: node.name, level: node.level, parentId: node.parentId ?? null });
        if (node.children?.length) flatten(node.children as typeof categories);
      }
    };
    flatten(categories);
    return result;
  }, [categories]);

  const categoryMap = useMemo(() => new Map(flatCategories.map(c => [c.id, c.name])), [flatCategories]);

  const parentCategoryMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const cat of flatCategories) {
      if (cat.parentId !== null) {
        const parentName = categoryMap.get(cat.parentId);
        if (parentName) map.set(cat.id, parentName);
      }
    }
    return map;
  }, [flatCategories, categoryMap]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const isSearchEnabled = debouncedQuery.trim().length >= 2;

  const { data: searchData, isFetching: isSearching } = useSearchProducts(
    { q: debouncedQuery },
    { query: { enabled: isSearchEnabled, queryKey: getSearchProductsQueryKey({ q: debouncedQuery }) } }
  );

  const productSuggestions = searchData?.products?.slice(0, 6) ?? [];

  const categorySuggestions = useMemo(() => {
    if (!isSearchEnabled) return [];
    const lower = debouncedQuery.toLowerCase();
    return flatCategories.filter(c => c.name.toLowerCase().includes(lower)).slice(0, 3);
  }, [flatCategories, debouncedQuery, isSearchEnabled]);

  const allItems = useMemo(() => [
    ...productSuggestions.map(p => ({ type: "product" as const, data: p })),
    ...categorySuggestions.map(c => ({ type: "category" as const, data: c })),
  ], [productSuggestions, categorySuggestions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const closeSearch = () => {
    setSearchQuery("");
    setDebouncedQuery("");
    setDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/search/${encodeURIComponent(searchQuery.trim())}`);
      closeSearch();
      setIsHoveringNav(false);
      setActiveTab(null);
    }
  };

  const handleSelectProduct = (product: { categoryId: number | null }) => {
    setLocation(`/products/${product.categoryId}`);
    closeSearch();
  };

  const handleSelectCategory = (cat: { id: number; level: number }) => {
    const fullCat = flatCategories.find(c => c.id === cat.id);
    const hasChildren = categories.some(top =>
      top.children?.some(mid =>
        mid.id === cat.id ? (mid.children?.length ?? 0) > 0 :
        mid.children?.some(sub => sub.id === cat.id && ((sub as any).children?.length ?? 0) > 0)
      ) || top.id === cat.id
    );
    setLocation(hasChildren && cat.level < 3 ? `/category/${cat.id}` : `/products/${cat.id}`);
    closeSearch();
  };

  const handleCopySku = (e: React.MouseEvent, sku: string) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const textarea = document.createElement("textarea");
      textarea.value = sku;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedSku(sku);
      setTimeout(() => setCopiedSku(null), 1500);
    } catch {
      navigator.clipboard.writeText(sku).then(() => {
        setCopiedSku(sku);
        setTimeout(() => setCopiedSku(null), 1500);
      }).catch(() => {});
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen || allItems.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      const item = allItems[highlightedIndex];
      if (item.type === "product") handleSelectProduct(item.data);
      else handleSelectCategory(item.data);
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const handleMouseEnterTab = (id: number) => {
    setActiveTab(id);
    setIsHoveringNav(true);
  };

  const handleMouseLeaveNav = () => {
    setIsHoveringNav(false);
    setActiveTab(null);
  };

  const showDropdown = dropdownOpen && isSearchEnabled;
  const hasResults = productSuggestions.length > 0 || categorySuggestions.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Unified Header */}
      <header
        className="bg-white border-b border-gray-200 sticky top-0 z-40"
        onMouseLeave={handleMouseLeaveNav}
      >
        {/* Top row: logo + search (centered) + actions */}
        <div className="max-w-screen-xl mx-auto px-6 h-[65px] flex items-center relative">
          <Link href="/" className="flex items-baseline gap-2 shrink-0 group">
            <span className="font-bold text-gray-900 tracking-tight group-hover:text-primary transition-colors text-[20px]">
              CONSUMERS
            </span>
            <span className="font-semibold text-amber-500 tracking-widest uppercase hidden sm:block text-[16px]">
              Product Selector
            </span>
          </Link>

          <SyncButton />

          <QuoteListBadge />

          <div className="w-[500px]" ref={searchContainerRef}>
            <form onSubmit={handleSearch} className="relative flex items-center">
              <Search size={14} className="absolute left-3 text-gray-400 pointer-events-none z-10" />
              <input
                type="search"
                placeholder="Search products, categories, SKUs…"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setDropdownOpen(true);
                  setHighlightedIndex(-1);
                }}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                className="w-full pl-9 pr-20 py-2 bg-gray-100 border-0 rounded-lg focus:bg-white focus:ring-1 focus:ring-gray-300 focus:outline-none transition-all text-sm placeholder:text-gray-400 text-gray-800"
              />
              <button
                type="submit"
                className="absolute right-1.5 bg-gray-900 hover:bg-gray-700 text-white px-3 py-1 rounded-md font-medium text-[12px] transition-colors flex items-center gap-1 flex-shrink-0"
              >
                {isSearching && <Loader2 size={11} className="animate-spin" />}
                Search
              </button>
            </form>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full right-0 w-[800px] mt-1.5 bg-white rounded-xl shadow-xl shadow-black/10 border border-gray-100 overflow-hidden z-50"
                >
                  {isSearching && !hasResults ? (
                    <div className="flex items-center gap-2 px-4 py-3.5 text-sm text-gray-400">
                      <Loader2 size={13} className="animate-spin" />
                      Searching…
                    </div>
                  ) : !hasResults ? (
                    <div className="flex items-center gap-2 px-4 py-3.5 text-sm text-gray-400">
                      <Package size={13} />
                      No results for "{debouncedQuery}"
                    </div>
                  ) : (
                    <div>
                      {productSuggestions.length > 0 && (
                        <div>
                          <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                            <Package size={10} className="text-gray-300" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Products</span>
                          </div>
                          <div className="grid grid-cols-[36px_1fr_100px_130px_70px] items-center gap-x-3 text-[10px] uppercase tracking-widest text-gray-300 font-semibold px-4 pt-1 pb-1 border-b border-gray-50">
                            <span></span>
                            <span>Product</span>
                            <span className="text-center">Stock</span>
                            <span>SKU</span>
                            <span className="text-right">Price</span>
                          </div>
                          <ul>
                            {productSuggestions.map((product, idx) => {
                              const categoryName = product.categoryId
                                ? (parentCategoryMap.get(product.categoryId) ?? categoryMap.get(product.categoryId))
                                : null;
                              return (
                                <li key={product.id}>
                                  <button
                                    type="button"
                                    onMouseDown={e => { e.preventDefault(); handleSelectProduct(product); }}
                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                    className={cn(
                                      "w-full grid grid-cols-[36px_1fr_100px_130px_70px] items-center gap-x-3 px-4 py-2 text-left transition-colors",
                                      highlightedIndex === idx ? "bg-gray-50" : "hover:bg-gray-50"
                                    )}
                                  >
                                    <div className="w-9 h-9 rounded bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                      {product.imageUrl ? (
                                        <img src={product.imageUrl} alt="" className="w-full h-full object-contain" />
                                      ) : (
                                        <Package size={14} className="text-gray-300" />
                                      )}
                                    </div>
                                    <span className="min-w-0">
                                      <span className="block text-sm font-medium text-gray-900 truncate">{product.name}</span>
                                      {categoryName && (
                                        <span className="text-[11px] text-gray-400 block truncate">{categoryName}</span>
                                      )}
                                    </span>
                                    <span className="text-center">
                                      {product.quantityAvailable != null && (
                                        product.quantityAvailable >= 1 ? (
                                          <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">In Stock</span>
                                        ) : (
                                          <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-50 text-red-500">Out of Stock</span>
                                        )
                                      )}
                                    </span>
                                    <span className="truncate">
                                      {product.sku ? (
                                        <span
                                          role="button"
                                          onMouseDown={e => handleCopySku(e, product.sku!)}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono border transition-all cursor-pointer border-emerald-200 text-[12px] bg-[#e5e7eb] border-t-[#364153] border-r-[#364153] border-b-[#364153] border-l-[#364153] text-[#364153] border-t-[0px] border-r-[0px] border-b-[0px] border-l-[0px]"
                                        >
                                          {copiedSku === product.sku
                                            ? <><Check size={10} /> {product.sku}</>
                                            : <><Copy size={10} /> {product.sku}</>}
                                        </span>
                                      ) : <span className="text-gray-300">—</span>}
                                    </span>
                                    <span className="text-right">
                                      {product.price != null ? (
                                        <span className="text-sm font-semibold text-gray-900">${product.price.toFixed(2)}</span>
                                      ) : <span className="text-gray-300">—</span>}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {categorySuggestions.length > 0 && (
                        <div className={cn(productSuggestions.length > 0 && "border-t border-gray-100")}>
                          <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                            <Folders size={10} className="text-gray-300" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Categories</span>
                          </div>
                          <ul>
                            {categorySuggestions.map((cat, idx) => {
                              const globalIdx = productSuggestions.length + idx;
                              return (
                                <li key={cat.id}>
                                  <button
                                    type="button"
                                    onMouseDown={e => { e.preventDefault(); handleSelectCategory(cat); }}
                                    onMouseEnter={() => setHighlightedIndex(globalIdx)}
                                    className={cn(
                                      "w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors",
                                      highlightedIndex === globalIdx ? "bg-gray-50" : "hover:bg-gray-50"
                                    )}
                                  >
                                    <Folders size={12} className="text-gray-300 flex-shrink-0" />
                                    <span className="text-sm font-medium text-gray-700 truncate">{cat.name}</span>
                                    <span className="ml-auto text-[10px] text-gray-300 flex-shrink-0">
                                      {cat.level === 3 ? "Subcategory" : cat.level === 2 ? "Category" : "Section"}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      <div className="border-t border-gray-100">
                        <button
                          type="button"
                          onMouseDown={e => { e.preventDefault(); handleSearch(e as unknown as React.FormEvent); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <Search size={11} />
                          See all results for "{debouncedQuery}"
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* Bottom row: nav tabs (visually part of the same header) */}
        <div className="border-t border-gray-100">
          <div className="max-w-screen-xl mx-auto px-4">
            {isLoadingCategories ? (
              <div className="flex items-center gap-2 h-[50px] text-gray-300 text-xs">
                <Loader2 size={12} className="animate-spin" />
                Loading…
              </div>
            ) : (
              <ul className="flex items-center overflow-x-auto">
                {topLevelCategories.map(cat => (
                  <li key={cat.id} className="flex-shrink-0 relative">
                    <Link
                      href={`/category/${cat.id}`}
                      onMouseEnter={() => handleMouseEnterTab(cat.id)}
                      onClick={() => { setIsHoveringNav(false); setActiveTab(null); }}
                      className="flex items-center h-[50px] px-4 font-semibold uppercase tracking-widest transition-colors relative text-gray-900 text-[13px]"
                    >
                      {cat.name}
                      {activeTab === cat.id && (
                        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-amber-400 rounded-full" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Mega Menu */}
          <AnimatePresence>
            {activeTab && isHoveringNav && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, transition: { duration: 0.1 } }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute top-full left-0 w-full bg-white border-b border-gray-200 shadow-xl shadow-black/5 max-h-[70vh] overflow-y-auto"
              >
                <div className="max-w-screen-xl mx-auto px-6 py-10">
                  <div className="flex flex-wrap gap-x-16 gap-y-10">
                    {categories.find(c => c.id === activeTab)?.children?.map(subCat => (
                      <div key={subCat.id} className="min-w-[160px] max-w-[240px] flex-1">
                        <Link
                          href={subCat.children && subCat.children.length > 0 ? `/category/${subCat.id}` : `/products/${subCat.id}`}
                          onClick={() => { setIsHoveringNav(false); setActiveTab(null); }}
                          className="block font-semibold uppercase tracking-widest text-amber-500 hover:text-amber-600 mb-4 pb-2 border-b border-gray-100 text-[12px] transition-colors"
                        >
                          {subCat.name}
                        </Link>
                        {subCat.children && subCat.children.length > 0 && (
                          <ul className="space-y-2">
                            {subCat.children.map(item => (
                              <li key={item.id}>
                                <Link
                                  href={(item as any).children && (item as any).children.length > 0 ? `/category/${item.id}` : `/products/${item.id}`}
                                  onClick={() => { setIsHoveringNav(false); setActiveTab(null); }}
                                  className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center group/link gap-1.5 py-0.5"
                                >
                                  <ChevronRight size={12} className="opacity-0 -translate-x-1 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all text-amber-400" />
                                  {item.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>
      {/* Content */}
      <main>
        {children}
      </main>
      {/* Footer */}
      <footer className="bg-black">
        <div className="max-w-screen-xl mx-auto px-6 py-5">
          <p className="text-white/50 text-[14px] text-center">© {new Date().getFullYear()} All rights reserved.</p>
          <ProductStatsDebug />
        </div>
      </footer>
    </div>
  );
}
