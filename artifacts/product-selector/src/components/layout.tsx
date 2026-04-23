import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Search, Loader2, ChevronRight, ChevronDown, Package, Folders, Copy, Check, ClipboardList, LogOut, Settings, BookOpen, Flag } from "lucide-react";
import { ReportIssueModal } from "@/components/report-issue-modal";
import { useQuoteList } from "@/context/quote-list-context";
import { useAuth } from "@/context/auth-context";
import { useGetCategories, useSearchProducts, getSearchProductsQueryKey } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn, fmtPrice } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import ProductModal from "@/components/product-modal";


function HeaderLogo() {
  const { data, isLoading } = useQuery({
    queryKey: ["adminLogo"],
    queryFn: async () => {
      const res = await fetch("/api/admin/logo");
      if (!res.ok) return { mode: "text" as const, svg: null };
      return res.json() as Promise<{ mode: "text" | "image"; svg: string | null }>;
    },
    staleTime: 5 * 60_000,
    gcTime: Infinity,
  });

  if (isLoading || !data) {
    return <span className="inline-block h-[22px] w-[155px]" aria-hidden />;
  }

  if (data.mode === "image" && data.svg) {
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(data.svg)}`;
    return (
      <img
        src={dataUrl}
        alt="Logo"
        className="h-[22px] w-auto max-w-[155px] object-contain relative top-[3px] group-hover:opacity-80 transition-opacity"
      />
    );
  }
  return (
    <span className="font-bold text-gray-900 tracking-tight group-hover:text-primary transition-colors text-[20px]">
      CONSUMERS
    </span>
  );
}

function ProductStatsDebug() {
  const { data, isLoading } = useQuery({
    queryKey: ["productStats"],
    queryFn: async () => {
      const res = await fetch("/api/products/stats");
      if (!res.ok) return null;
      return res.json() as Promise<{ totalProducts: number; productsWithoutCategory: number; lastUpdated: string | null }>;
    },
    staleTime: 60000,
  });

  const { data: lastSync } = useQuery({
    queryKey: ["lastSyncResult"],
    queryFn: async () => {
      const res = await fetch("/api/dev/sync/last");
      if (!res.ok) return null;
      return res.json() as Promise<{ completedAt: string } | null>;
    },
    staleTime: 60000,
  });

  const syncTimestamp = lastSync?.completedAt || data?.lastUpdated;
  const formattedTime = syncTimestamp
    ? new Date(syncTimestamp.endsWith("Z") ? syncTimestamp : syncTimestamp + "Z").toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : null;

  return (
    <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-3 items-center text-[14px] text-[#b0b0b0]">
      <span className="text-white/50 justify-self-start text-[12px]">© {new Date().getFullYear()} All rights reserved.</span>
      <span className="justify-self-center text-[12px] text-[#ffffff80]">
        {formattedTime ? `Data Synced: ${formattedTime}` : ""}
      </span>
      <span className="justify-self-end text-[12px]">Inventory Levels are Live</span>
    </div>
  );
}

function QuoteListBadge() {
  const { totalLineItems } = useQuoteList();
  return (
    <Link href="/list" className="relative flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors group" title="Quote List">
      <ClipboardList size={18} className="text-gray-500 group-hover:text-gray-700 transition-colors" />
      {totalLineItems > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-amber-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1">
          {totalLineItems > 99 ? "99+" : totalLineItems}
        </span>
      )}
    </Link>
  );
}

function AdminViewToggle() {
  const { realIsAdmin, viewAsNonAdmin, setViewAsNonAdmin } = useAuth();
  if (!realIsAdmin) return null;
  const previewing = viewAsNonAdmin;
  return (
    <button
      type="button"
      onClick={() => setViewAsNonAdmin(!previewing)}
      title={previewing ? "Currently viewing as a regular user. Click to return to admin view." : "Preview the page as a regular (non-admin) user."}
      className={cn(
        "flex items-center rounded-full border transition-all",
        previewing
          ? "gap-1 text-[10px] font-normal px-1.5 py-0.5 bg-transparent border-transparent text-gray-400 hover:text-gray-600"
          : "gap-1.5 text-[11px] font-medium px-2.5 py-1.5 bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100",
      )}
    >
      <span
        className={cn(
          "rounded-full",
          previewing ? "w-1 h-1 bg-gray-300" : "w-1.5 h-1.5 bg-amber-500",
        )}
      />
      {previewing ? "User View" : "Admin View"}
    </button>
  );
}

function EmployeeBadge() {
  const { employee, realIsAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!employee) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
        {employee.firstName.charAt(0).toUpperCase() + employee.firstName.slice(1).toLowerCase()}{" "}
        {employee.lastName.charAt(0).toUpperCase() + employee.lastName.slice(1).toLowerCase()}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          {realIsAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <Settings size={14} />
              Admin
            </Link>
          )}
          <button
            onClick={() => { setOpen(false); logout(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      )}
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

  const categories = categoryData?.categories || [];
  const internalCategory = categories.find(c => c.level === 1 && c.name.toLowerCase() === "internal");
  const displaysForSaleCategory = categories.find(c => c.level === 1 && c.name.toLowerCase() === "displays for sale");
  const topLevelCategories = categories.filter(c => c.level === 1 && c.name.toLowerCase() !== "internal" && c.name.toLowerCase() !== "displays for sale");

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

  const [modalProduct, setModalProduct] = useState<any>(null);
  const [reportIssueOpen, setReportIssueOpen] = useState(false);

  const handleSelectProduct = (product: any) => {
    setModalProduct(product);
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
        {/* Top row: logo | search | actions */}
        <div className="max-w-screen-xl mx-auto px-6 h-[65px] flex items-center gap-4 relative">
          <Link href="/" className="flex items-baseline gap-1 shrink-0 group">
            <HeaderLogo />
            <span className="font-semibold text-amber-500 tracking-widest uppercase hidden sm:block text-[16px]">
              Product Selector
            </span>
          </Link>

          <div className="flex-1 max-w-[500px] mx-auto" ref={searchContainerRef}>
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
                                        ) : product.isSpecialOrderStock ? (
                                          <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Non-Stock</span>
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
                                        <span className="text-sm font-semibold text-gray-900">${fmtPrice(product.price)}</span>
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

          <div className="flex items-center gap-2 shrink-0">
            <AdminViewToggle />
            <EmployeeBadge />
            <QuoteListBadge />
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
              <div className="flex items-center">
                <ul className="flex items-center overflow-x-auto flex-1">
                  {topLevelCategories.map(cat => (
                    <li key={cat.id} className="flex-shrink-0 relative">
                      <Link
                        href={cat.children && cat.children.length > 0 ? `/category/${cat.id}` : `/products/${cat.id}`}
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
                {displaysForSaleCategory && (
                  <Link
                    href={displaysForSaleCategory.children && displaysForSaleCategory.children.length > 0 ? `/category/${displaysForSaleCategory.id}` : `/products/${displaysForSaleCategory.id}`}
                    onClick={() => { setIsHoveringNav(false); setActiveTab(null); }}
                    className="flex-shrink-0 flex items-center h-[50px] px-4 font-semibold uppercase tracking-widest text-amber-600 hover:text-amber-700 transition-colors text-[13px]"
                  >
                    Displays For Sale
                  </Link>
                )}
                <Link
                  href="/express-bath"
                  onClick={() => { setIsHoveringNav(false); setActiveTab(null); }}
                  className="flex-shrink-0 flex items-center h-[50px] px-4 font-semibold uppercase tracking-widest text-blue-600 hover:text-blue-700 transition-colors text-[13px]"
                >
                  Express Bath
                </Link>
                <Link
                  href="/clearance"
                  onClick={() => { setIsHoveringNav(false); setActiveTab(null); }}
                  className="flex-shrink-0 flex items-center h-[50px] px-4 font-semibold uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors text-[13px]"
                >
                  Clearance
                </Link>
                {internalCategory && (
                  <Link
                    href={`/category/${internalCategory.id}`}
                    onClick={() => { setIsHoveringNav(false); setActiveTab(null); }}
                    className="flex-shrink-0 flex items-center h-[50px] px-4 font-semibold uppercase tracking-widest text-gray-500 hover:text-gray-700 transition-colors text-[13px]"
                  >
                    Internal
                  </Link>
                )}
              </div>
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
          <div className="flex items-center justify-center gap-8 text-[14px] text-[#cfcfcf]">
            <a
              href="https://1212804.app.netsuite.com/app/site/hosting/scriptlet.nl?script=3701&deploy=1&script=3701&deploy=1&whence=&siaT=1774876085696&siaWhc=%2Fapp%2Fcenter%2Fcard.nl&siaNv=sc"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              <BookOpen size={15} />
              PRD Reference
            </a>
            <span className="w-px h-4 bg-white/15" />
            <button
              type="button"
              onClick={() => setReportIssueOpen(true)}
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              <Flag size={15} />
              Report Issue
            </button>
          </div>
          <ProductStatsDebug />
        </div>
      </footer>
      <ProductModal product={modalProduct} onClose={() => setModalProduct(null)} />
      <ReportIssueModal open={reportIssueOpen} onClose={() => setReportIssueOpen(false)} />
    </div>
  );
}
