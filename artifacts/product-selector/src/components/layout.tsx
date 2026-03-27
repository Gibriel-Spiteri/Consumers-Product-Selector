import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Search, Loader2, RefreshCw, AlertCircle, Database, ChevronRight } from "lucide-react";
import { useGetCategories, useGetNetSuiteStatus, useTriggerNetSuiteSync, getGetCategoriesQueryKey, getGetNetSuiteStatusQueryKey } from "@workspace/api-client-react";
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
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [isHoveringNav, setIsHoveringNav] = useState(false);

  const { data: categoryData, isLoading: isLoadingCategories } = useGetCategories();
  const { data: status } = useGetNetSuiteStatus();
  
  const categories = categoryData?.categories || [];
  const topLevelCategories = categories.filter(c => c.level === 1);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/search/${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setIsHoveringNav(false);
      setActiveTab(null);
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

  return (
    <div className="min-h-screen flex flex-col bg-secondary/30">
      {/* System Status Banner */}
      <AnimatePresence>
        {showMockBanner && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="bg-amber-100 border-b border-amber-200 text-amber-900 text-xs sm:text-sm text-center py-2 font-medium px-4 flex items-center justify-center gap-2"
          >
            <AlertCircle size={16} className="text-amber-600" />
            Showing sample data — NetSuite is not currently connected. Add credentials to environment secrets to view live data.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header */}
      <header className="bg-white border-b border-border py-6 shadow-sm relative z-20">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <Link href="/" className="flex flex-col group cursor-pointer w-fit">
            <h1 className="font-display font-bold text-4xl lg:text-5xl text-primary leading-none uppercase tracking-tight group-hover:text-accent transition-colors">
              Consumers
            </h1>
            <span className="bg-primary group-hover:bg-accent transition-colors text-white text-[10px] lg:text-xs uppercase font-bold tracking-[0.25em] px-2 py-0.5 mt-1 inline-block w-fit">
              Product Selector
            </span>
          </Link>

          <div className="flex-1 max-w-2xl relative w-full">
            <form onSubmit={handleSearch} className="relative group">
              <input
                type="search"
                placeholder="Your Product Name or SKU"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-5 pr-12 py-3.5 bg-secondary/50 border-2 border-border rounded-lg focus:bg-white focus:border-accent focus:ring-4 focus:ring-accent/10 focus:outline-none transition-all text-sm font-medium placeholder:text-muted-foreground shadow-inner shadow-black/5"
              />
              <button 
                type="submit" 
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-md transition-colors"
              >
                <Search size={20} strokeWidth={2.5} />
              </button>
            </form>
          </div>

          <div className="hidden md:block">
            <SyncStatus />
          </div>
        </div>
      </header>

      {/* Navigation Bar */}
      <nav 
        className="bg-primary text-primary-foreground relative z-30 shadow-md"
        onMouseLeave={handleMouseLeaveNav}
      >
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          {isLoadingCategories ? (
            <div className="flex items-center gap-2 py-4 text-primary-foreground/70 text-sm font-medium">
              <Loader2 size={16} className="animate-spin" />
              Loading catalog...
            </div>
          ) : (
            <ul className="flex items-center overflow-x-auto hide-scrollbar">
              {topLevelCategories.map(cat => (
                <li key={cat.id} className="flex-shrink-0">
                  <div
                    onMouseEnter={() => handleMouseEnterTab(cat.id)}
                    onClick={() => handleMouseEnterTab(cat.id)}
                    className={cn(
                      "px-6 lg:px-8 py-4 cursor-pointer font-semibold transition-all border-r border-white/10 text-sm uppercase tracking-wider relative",
                      activeTab === cat.id 
                        ? "bg-white text-primary" 
                        : "hover:bg-white/10 text-white"
                    )}
                  >
                    {cat.name}
                    {activeTab === cat.id && (
                      <motion.div 
                        layoutId="activeTab" 
                        className="absolute bottom-0 left-0 w-full h-1 bg-accent" 
                      />
                    )}
                  </div>
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
          <div className="text-sm text-primary-foreground/60 font-medium">
            Powered by NetSuite Integration
          </div>
        </div>
      </footer>
    </div>
  );
}
