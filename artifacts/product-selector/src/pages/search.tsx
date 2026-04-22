import { useState } from "react";
import { useParams, Link } from "wouter";
import { getSearchProductsQueryOptions } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, ArrowLeft, PackageX, LayoutList, LayoutGrid } from "lucide-react";
import ProductModal from "@/components/product-modal";
import { cn } from "@/lib/utils";
import { GridView, ListView, type Product } from "@/pages/category-products";

export default function SearchPage() {
  const { query } = useParams();
  const q = decodeURIComponent(query || '');
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [view, setView] = useState<"list" | "grid">("grid");

  const { data: productsData, isLoading } = useQuery({
    ...getSearchProductsQueryOptions({ q }),
    enabled: !!q,
  });

  const products = (productsData?.products ?? []) as unknown as Product[];

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-accent transition-colors mb-8">
        <ArrowLeft size={16} />
        Back to Home
      </Link>

      <div className="mb-6 bg-white p-8 rounded-2xl border border-border shadow-sm flex items-center gap-6">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
          <Search size={28} />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-display font-bold text-primary uppercase tracking-tight">
            Search Results
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-lg">
            Showing results for <span className="text-foreground font-bold italic">"{q}"</span>
            {!isLoading && products.length > 0 && (
              <span className="text-muted-foreground/70 text-base font-normal ml-2">({products.length})</span>
            )}
          </p>
        </div>
        {!isLoading && products.length > 0 && (
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView("list")}
              title="List view"
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all",
                view === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-700"
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
                view === "grid" ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-700"
              )}
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">Grid</span>
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="py-32 flex flex-col items-center justify-center bg-white rounded-2xl border border-border shadow-sm">
          <Loader2 className="animate-spin text-accent mb-4" size={40} />
          <p className="text-primary font-medium text-lg">Searching catalog...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="py-24 px-4 text-center border-2 border-dashed border-border rounded-2xl bg-white shadow-sm flex flex-col items-center">
          <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-6">
            <PackageX size={32} className="text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-display font-bold text-primary uppercase tracking-tight mb-2">No matching products</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            We couldn't find any products matching "{q}". Try checking your spelling or using broader search terms.
          </p>
        </div>
      ) : view === "list" ? (
        <ListView products={products} onSelect={setModalProduct} />
      ) : (
        <GridView products={products} onSelect={setModalProduct} />
      )}
      <ProductModal product={modalProduct} onClose={() => setModalProduct(null)} />
    </div>
  );
}
