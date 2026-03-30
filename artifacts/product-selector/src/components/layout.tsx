import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Search, Loader2, RefreshCw, AlertCircle, ChevronRight, Package, Folders, Copy, Check, BookOpen, Camera, Flag, Database } from "lucide-react";
import { useGetCategories, useGetNetSuiteStatus, useTriggerNetSuiteSync, getGetCategoriesQueryKey, getGetNetSuiteStatusQueryKey, useSearchProducts, getSearchProductsQueryKey } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

function SyncButton() {
  const { data: status } = useGetNetSuiteStatus();
  const { mutate: sync, isPending } = useTriggerNetSuiteSync();
  const queryClient = useQueryClient();

  const handleSync = () => {
    sync(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetNetSuiteStatusQueryKey() });
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      {status?.connected ? (
        <span className="hidden sm:flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
          <Database size={11} />
          Connected
        </span>
      ) : (
        <span className="hidden sm:flex items-center gap-1 text-[11px] font-medium text-red-500 bg-red-50 px-2.5 py-1 rounded-full">
          <AlertCircle size={11} />
          Not connected
        </span>
      )}
      <button
        onClick={handleSync}
        disabled={isPending}
        className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
      >
        <RefreshCw size={12} className={cn(isPending && "animate-spin")} />
        {isPending ? "Syncing…" : "Sync NetSuite"}
      </button>
    </div>
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
  const { data: status } = useGetNetSuiteStatus();

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
    setLocation(cat.level === 3 ? `/products/${cat.id}` : `/category/${cat.id}`);
    closeSearch();
  };

  const handleCopySku = (e: React.MouseEvent, sku: string) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(sku).then(() => {
      setCopiedSku(sku);
      setTimeout(() => setCopiedSku(null), 1500);
    });
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

  const showMockBanner = categoryData?.usingMockData || (status && !status.connected);
  const showDropdown = dropdownOpen && isSearchEnabled;
  const hasResults = productSuggestions.length > 0 || categorySuggestions.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-white">

      {/* Status Banner */}
      <AnimatePresence>
        {showMockBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="bg-gray-50 border-b border-gray-100 text-gray-400 text-[11px] text-center py-1.5 px-4 flex items-center justify-center gap-1.5"
          >
            <AlertCircle size={11} className="shrink-0" />
            Sample data — NetSuite credentials not configured
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unified Header */}
      <header
        className="bg-white border-b border-gray-200 sticky top-0 z-40"
        onMouseLeave={handleMouseLeaveNav}
      >
        {/* Top row: logo + search (centered) + actions */}
        <div className="max-w-screen-xl mx-auto px-6 h-[52px] flex items-center relative">
          <Link href="/" className="flex items-baseline gap-2 shrink-0 group">
            <span className="font-bold text-gray-900 text-lg tracking-tight group-hover:text-primary transition-colors">
              CONSUMERS
            </span>
            <span className="font-semibold text-amber-500 tracking-widest uppercase hidden sm:block text-[14px]">
              Product Selector
            </span>
          </Link>

          {/* Search — absolutely centered in the bar */}
          <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-md" ref={searchContainerRef}>
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
                  className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl shadow-black/10 border border-gray-100 overflow-hidden z-50"
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
                                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                                      highlightedIndex === idx ? "bg-gray-50" : "hover:bg-gray-50"
                                    )}
                                  >
                                    <span className="flex-1 min-w-0">
                                      <span className="block text-sm font-medium text-gray-900 truncate">{product.name}</span>
                                      {categoryName && (
                                        <span className="text-[11px] text-gray-400 block">{categoryName}</span>
                                      )}
                                    </span>
                                    <span className="flex items-center gap-2 flex-shrink-0">
                                      {product.sku && (
                                        <button
                                          type="button"
                                          onMouseDown={e => handleCopySku(e, product.sku!)}
                                          className={cn(
                                            "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border transition-all",
                                            copiedSku === product.sku
                                              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                              : "bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-700"
                                          )}
                                        >
                                          {copiedSku === product.sku
                                            ? <><Check size={10} /> {product.sku}</>
                                            : <><Copy size={10} /> {product.sku}</>}
                                        </button>
                                      )}
                                      {product.price != null && (
                                        <span className="text-sm font-semibold text-gray-900">${product.price.toFixed(2)}</span>
                                      )}
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

          <div className="ml-auto">
            <SyncButton />
          </div>
        </div>

        {/* Bottom row: nav tabs (visually part of the same header) */}
        <div className="border-t border-gray-100">
          <div className="max-w-screen-xl mx-auto px-4">
            {isLoadingCategories ? (
              <div className="flex items-center gap-2 h-10 text-gray-300 text-xs">
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
                      className={cn(
                        "block px-4 py-2.5 text-[12px] font-semibold uppercase tracking-widest transition-colors relative",
                        activeTab === cat.id
                          ? "text-gray-900"
                          : "text-gray-400 hover:text-gray-700"
                      )}
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
                        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-amber-500 mb-4 pb-2 border-b border-gray-100">
                          {subCat.name}
                        </h3>
                        <ul className="space-y-2">
                          {subCat.children?.map(item => (
                            <li key={item.id}>
                              <Link
                                href={`/products/${item.id}`}
                                onClick={() => { setIsHoveringNav(false); setActiveTab(null); }}
                                className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center group/link gap-1.5 py-0.5"
                              >
                                <ChevronRight size={12} className="opacity-0 -translate-x-1 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all text-amber-400" />
                                {item.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
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
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white mt-auto">
        <div className="max-w-screen-xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <p className="font-semibold text-gray-900 text-sm">CONSUMERS Product Selector</p>
            <p className="text-gray-400 text-xs mt-0.5">© {new Date().getFullYear()} All rights reserved.</p>
          </div>
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <a href="https://1212804.app.netsuite.com/app/site/hosting/scriptlet.nl?script=3701&deploy=1&script=3701&deploy=1&whence=&siaT=1774876085696&siaWhc=%2Fapp%2Fcenter%2Fcard.nl&siaNv=sc" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-gray-700 transition-colors">
              <BookOpen size={13} />
              PRD Reference
            </a>
            <a href="https://www.consumerskitchens.com/photo-shoots" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-gray-700 transition-colors">
              <Camera size={13} />
              Photoshoot Showcase
            </a>
            <a href="#" className="flex items-center gap-1.5 hover:text-gray-700 transition-colors">
              <Flag size={13} />
              Report Issue
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
