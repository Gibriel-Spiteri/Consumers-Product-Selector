import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Search, Loader2, RefreshCw, AlertCircle, Database, ChevronRight, Package, Folders, Copy, Check, BookOpen, Camera, Flag } from "lucide-react";
import { useGetCategories, useGetNetSuiteStatus, useTriggerNetSuiteSync, getGetCategoriesQueryKey, getGetNetSuiteStatusQueryKey, useSearchProducts, getSearchProductsQueryKey } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

function SyncStatus() {
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
    <div className="flex items-center gap-4">
      {status?.connected ? (
         <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-foreground bg-secondary px-3 py-1.5 rounded-full border border-border">
           <Database size={14} className="text-green-600" />
           NetSuite Connected
         </div>
      ) : (
         <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-destructive bg-destructive/10 px-3 py-1.5 rounded-full border border-destructive/20">
           <AlertCircle size={14} />
           Setup Required
         </div>
      )}
      <button
        onClick={handleSync}
        disabled={isPending}
        className="text-xs font-bold text-primary hover:text-accent transition-all duration-200 flex items-center gap-2 px-4 py-2 border-2 border-primary/20 rounded-full hover:border-accent/40 hover:bg-secondary disabled:opacity-50 hover:shadow-md hover:-translate-y-0.5"
      >
        <RefreshCw size={14} className={cn(isPending && "animate-spin")} />
        {isPending ? "Syncing..." : "Sync NetSuite"}
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
    <div className="min-h-screen flex flex-col bg-secondary/30">
      {/* System Status Banner */}
      <AnimatePresence>
        {showMockBanner && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs text-center py-2 px-4 flex items-center justify-center gap-2"
          >
            <AlertCircle size={12} className="text-gray-400 shrink-0" />
            Sample data — NetSuite not connected. Add credentials to view live data.
          </motion.div>
        )}
      </AnimatePresence>
      {/* Main Header */}
      <header className="bg-white py-4 shadow-sm relative z-40">
        <div className="w-full pl-4 lg:pl-6 pr-4 lg:pr-8 flex flex-row items-center justify-between gap-6">
          <Link href="/" className="flex items-baseline gap-2 cursor-pointer group w-fit">
            <h1 className="font-display font-bold lg:text-3xl text-primary uppercase tracking-tight text-[26px]">
              Consumers
            </h1>
            <span className="font-display text-lg lg:text-xl text-amber-500 leading-none font-normal">
              Product Selector
            </span>
          </Link>

          <div className="flex-1 max-w-2xl relative w-full" ref={searchContainerRef}>
            <form onSubmit={handleSearch} className="relative flex items-center">
              <Search size={15} className="absolute left-4 text-muted-foreground pointer-events-none z-10" />
              <input
                type="search"
                placeholder="Search for products, categories, or SKUs..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setDropdownOpen(true);
                  setHighlightedIndex(-1);
                }}
                onFocus={() => setDropdownOpen(true)}
                onKeyDown={handleKeyDown}
                autoComplete="off"
                className="w-full pl-10 pr-28 py-2.5 bg-gray-100 border border-gray-200 rounded-full focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-none transition-all text-sm placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className="absolute right-1.5 bg-primary hover:bg-primary/90 text-white px-5 py-1.5 rounded-full font-semibold text-sm transition-colors flex items-center gap-1.5 flex-shrink-0"
              >
                {isSearching && <Loader2 size={13} className="animate-spin" />}
                Search
              </button>
            </form>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl shadow-black/15 border border-border overflow-hidden z-50"
                >
                  {isSearching && !hasResults ? (
                    <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                      <Loader2 size={14} className="animate-spin" />
                      Searching...
                    </div>
                  ) : !hasResults ? (
                    <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                      <Package size={14} />
                      No results found for "{debouncedQuery}"
                    </div>
                  ) : (
                    <div>
                      {/* Products section */}
                      {productSuggestions.length > 0 && (
                        <div>
                          <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                            <Package size={11} className="text-muted-foreground" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Products</span>
                          </div>
                          <ul>
                            {productSuggestions.map((product, idx) => {
                              const globalIdx = idx;
                              const categoryName = product.categoryId
                                ? (parentCategoryMap.get(product.categoryId) ?? categoryMap.get(product.categoryId))
                                : null;
                              return (
                                <li key={product.id}>
                                  <button
                                    type="button"
                                    onMouseDown={e => { e.preventDefault(); handleSelectProduct(product); }}
                                    onMouseEnter={() => setHighlightedIndex(globalIdx)}
                                    className={cn(
                                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                                      highlightedIndex === globalIdx ? "bg-accent/5" : "hover:bg-secondary/50"
                                    )}
                                  >
                                    <span className="flex-1 min-w-0">
                                      <span className="block text-sm font-semibold text-foreground truncate">{product.name}</span>
                                      {categoryName && (
                                        <span className="text-[11px] text-muted-foreground truncate block">{categoryName}</span>
                                      )}
                                    </span>
                                    <span className="flex items-center gap-2 flex-shrink-0">
                                      {product.sku && (
                                        <button
                                          type="button"
                                          onMouseDown={e => handleCopySku(e, product.sku!)}
                                          title="Copy SKU"
                                          className={cn(
                                            "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium border transition-all",
                                            copiedSku === product.sku
                                              ? "bg-green-50 border-green-200 text-green-700"
                                              : "bg-secondary border-border text-muted-foreground hover:border-accent/40 hover:text-accent hover:bg-accent/5"
                                          )}
                                        >
                                          {copiedSku === product.sku
                                            ? <><Check size={10} /> {product.sku}</>
                                            : <><Copy size={10} /> {product.sku}</>}
                                        </button>
                                      )}
                                      {product.price != null && (
                                        <span className="text-sm font-bold text-accent">${product.price.toFixed(2)}</span>
                                      )}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {/* Categories section */}
                      {categorySuggestions.length > 0 && (
                        <div className={cn(productSuggestions.length > 0 && "border-t border-border/60 mt-1")}>
                          <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                            <Folders size={11} className="text-muted-foreground" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Categories</span>
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
                                      highlightedIndex === globalIdx ? "bg-accent/5" : "hover:bg-secondary/50"
                                    )}
                                  >
                                    <Folders size={13} className="text-accent flex-shrink-0" />
                                    <span className="text-sm font-medium text-foreground truncate">{cat.name}</span>
                                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/70 flex-shrink-0">
                                      {cat.level === 1 ? "Top Level" : cat.level === 2 ? "Category" : "Subcategory"}
                                    </span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {/* See all results footer */}
                      <div className="border-t border-border">
                        <button
                          type="button"
                          onMouseDown={e => { e.preventDefault(); handleSearch(e as unknown as React.FormEvent); }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-accent hover:bg-accent/5 transition-colors"
                        >
                          <Search size={12} />
                          See all results for "{debouncedQuery}"
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden md:block">
            <SyncStatus />
          </div>
        </div>
      </header>
      {/* Navigation Bar */}
      <nav
        className="bg-white relative z-30"
        onMouseLeave={handleMouseLeaveNav}
      >
        <div className="w-full pl-4 lg:pl-6 pr-4 lg:pr-8">
          {isLoadingCategories ? (
            <div className="flex items-center gap-2 py-3 text-muted-foreground text-sm">
              <Loader2 size={14} className="animate-spin" />
              Loading catalog...
            </div>
          ) : (
            <ul className="flex items-center overflow-x-auto hide-scrollbar">
              {topLevelCategories.map(cat => (
                <li key={cat.id} className="flex-shrink-0">
                  <Link
                    href={`/category/${cat.id}`}
                    onMouseEnter={() => handleMouseEnterTab(cat.id)}
                    onClick={() => {
                      setIsHoveringNav(false);
                      setActiveTab(null);
                    }}
                    className={cn(
                      "block px-4 lg:px-5 py-5 cursor-pointer font-semibold transition-all text-xs uppercase tracking-wider relative",
                      activeTab === cat.id ? "text-primary" : "text-gray-500 hover:text-primary"
                    )}
                  >
                    {cat.name}
                    {activeTab === cat.id && (
                      <span className="absolute bottom-0 left-0 w-full h-0.5 bg-amber-500" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Mega Menu Dropdown */}
        <AnimatePresence>
          {activeTab && isHoveringNav && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, transition: { duration: 0.1 } }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute top-full left-0 w-full bg-white text-foreground shadow-2xl shadow-black/10 border-b border-border max-h-[75vh] overflow-y-auto"
            >
              <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
                <div className="flex flex-wrap gap-x-16 gap-y-12">
                  {categories.find(c => c.id === activeTab)?.children?.map(subCat => (
                    <div key={subCat.id} className="min-w-[180px] max-w-[260px] flex-1">
                      <h3 className="font-display font-bold text-accent uppercase text-base mb-5 tracking-widest border-b-2 border-accent/20 pb-2">
                        {subCat.name}
                      </h3>
                      <ul className="space-y-2.5">
                        {subCat.children?.map(item => (
                          <li key={item.id}>
                            <Link 
                              href={`/products/${item.id}`} 
                              onClick={() => {
                                setIsHoveringNav(false);
                                setActiveTab(null);
                              }}
                              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center group/link py-0.5"
                            >
                              <ChevronRight size={14} className="opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all text-accent mr-1" />
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
      </nav>
      {/* Main Content Area */}
      <main className="flex-1 relative z-10">
        {children}
      </main>
      {/* Footer */}
      <footer className="bg-primary text-primary-foreground py-12 border-t-4 border-accent mt-auto relative z-10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h2 className="font-display font-bold text-2xl uppercase tracking-tight mb-2">Consumers</h2>
            <p className="text-primary-foreground/60 text-sm">© {new Date().getFullYear()} Consumers Product Selector. All rights reserved.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 text-sm">
            <a href="#" className="flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors">
              <BookOpen size={15} />
              PRD Product Reference Directory
            </a>
            <a href="#" className="flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors">
              <Camera size={15} />
              Kitchen Photoshoot Showcase
            </a>
            <a href="#" className="flex items-center gap-2 text-primary-foreground/70 hover:text-primary-foreground transition-colors">
              <Flag size={15} />
              Report an Issue
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
