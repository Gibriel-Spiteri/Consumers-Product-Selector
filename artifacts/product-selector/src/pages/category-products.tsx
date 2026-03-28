import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetCategories, getGetCategoryProductsQueryOptions } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, PackageX, Loader2, ArrowLeft, ImageOff, LayoutList, LayoutGrid, Copy, Check } from "lucide-react";
import { useCategoryPath } from "@/hooks/use-category-path";
import ProductModal from "@/components/product-modal";
import { cn } from "@/lib/utils";

interface Product {
  id: number;
  name: string;
  sku: string | null;
  price: number | null;
  categoryId?: number | null;
  netsuiteId?: string | null;
}

function ProductImage({ id, name, className }: { id: number; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={cn("bg-secondary flex items-center justify-center text-muted-foreground", className)}>
        <ImageOff size={20} />
      </div>
    );
  }
  return (
    <img
      src={`https://picsum.photos/seed/product-${id}/400/300`}
      alt={name}
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}

function ListView({ products, onSelect }: { products: Product[]; onSelect: (p: Product) => void }) {
  return (
    <div className="bg-white border border-border shadow-md shadow-black/5 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-secondary/80 border-b-2 border-border">
              <th className="px-4 lg:px-6 py-4 font-display font-bold uppercase tracking-wider text-primary w-16"></th>
              <th className="px-4 lg:px-6 py-4 font-display font-bold uppercase tracking-wider text-primary w-[150px] whitespace-nowrap">Item SKU</th>
              <th className="px-4 lg:px-6 py-4 font-display font-bold uppercase tracking-wider text-primary">Product Details</th>
              <th className="px-4 lg:px-6 py-4 font-display font-bold uppercase tracking-wider text-primary text-right w-[160px] whitespace-nowrap">MSRP Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map(p => (
              <tr
                key={p.id}
                onClick={() => onSelect(p)}
                className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
              >
                <td className="px-4 lg:px-6 py-3">
                  <ProductImage
                    id={p.id}
                    name={p.name}
                    className="w-12 h-12 rounded-lg border border-border shrink-0"
                  />
                </td>
                <td className="px-4 lg:px-6 py-3 font-mono text-muted-foreground font-medium group-hover:text-primary transition-colors whitespace-nowrap">
                  {p.sku || 'N/A'}
                </td>
                <td className="px-4 lg:px-6 py-3 font-semibold text-foreground text-base group-hover:text-primary transition-colors">
                  {p.name}
                </td>
                <td className="px-4 lg:px-6 py-3 text-right whitespace-nowrap">
                  <span className="inline-block px-3 py-1 bg-secondary rounded-md font-bold text-accent border border-border group-hover:bg-white group-hover:border-accent/30 transition-colors">
                    {p.price ? `$${Number(p.price).toFixed(2)}` : 'Call for price'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
      className={cn(
        "ml-1 p-0.5 rounded transition-all shrink-0",
        copied
          ? "text-green-500"
          : "text-muted-foreground/40 hover:text-accent opacity-0 group-hover:opacity-100"
      )}
    >
      {copied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} />}
    </button>
  );
}

function GridView({ products, onSelect }: { products: Product[]; onSelect: (p: Product) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {products.map(p => (
        <div
          key={p.id}
          onClick={() => onSelect(p)}
          className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-accent/30 hover:-translate-y-0.5 transition-all group"
        >
          <ProductImage
            id={p.id}
            name={p.name}
            className="w-full aspect-square"
          />
          <div className="p-3">
            <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2 mb-1.5">
              {p.name}
            </p>
            {p.sku && (
              <div className="flex items-center gap-0.5 mb-2">
                <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                <CopySkuButton sku={p.sku} />
              </div>
            )}
            <p className="font-bold text-accent text-sm">
              {p.price ? `$${Number(p.price).toFixed(2)}` : <span className="text-muted-foreground font-normal">Call for price</span>}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CategoryProducts() {
  const { categoryId } = useParams();
  const id = Number(categoryId);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [view, setView] = useState<"list" | "grid">("grid");

  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    ...getGetCategoryProductsQueryOptions(id),
    enabled: !!id,
  });

  const { data: categoriesData } = useGetCategories();
  const path = useCategoryPath(categoriesData?.categories || [], id);
  const categoryPath = path.map(c => c.name).join(" › ");

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">

      <ProductModal
        product={selectedProduct}
        categoryPath={categoryPath}
        onClose={() => setSelectedProduct(null)}
      />

      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-10 overflow-x-auto whitespace-nowrap pb-2">
        <Link href="/" className="hover:text-accent transition-colors flex items-center gap-1.5">
          <ArrowLeft size={16} />
          Back to Home
        </Link>
        <div className="w-px h-4 bg-border mx-2"></div>
        {path.map((cat, index) => (
          <div key={cat.id} className="flex items-center gap-2">
            {index === path.length - 1 ? (
              <span className="text-primary font-bold px-3 py-1 bg-white rounded-md shadow-sm border border-border">
                {cat.name}
              </span>
            ) : (
              <Link href={`/category/${cat.id}`} className="hover:text-accent transition-colors">
                {cat.name}
              </Link>
            )}
            {index < path.length - 1 && <ChevronRight size={14} className="text-muted-foreground/50" />}
          </div>
        ))}
      </nav>

      {/* Page Header with view toggle */}
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-primary uppercase tracking-tight">
            {path.length > 0 ? path[path.length - 1].name : "Products"}
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">
            Showing {productsData?.products.length || 0} items · click {view === "list" ? "any row" : "a card"} for details
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-white border border-border rounded-xl shadow-sm p-1 shrink-0">
          <button
            onClick={() => setView("list")}
            title="List view"
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
              view === "list"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutList size={16} />
            <span className="hidden sm:inline">List</span>
          </button>
          <button
            onClick={() => setView("grid")}
            title="Grid view"
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
              view === "grid"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid size={16} />
            <span className="hidden sm:inline">Grid</span>
          </button>
        </div>
      </div>

      {/* Product List / Grid */}
      {isLoadingProducts ? (
        <div className="py-32 flex flex-col items-center justify-center bg-white rounded-2xl border border-border shadow-sm">
          <Loader2 className="animate-spin text-accent mb-4" size={40} />
          <p className="text-primary font-medium text-lg">Loading products...</p>
        </div>
      ) : !productsData?.products || productsData.products.length === 0 ? (
        <div className="py-24 px-4 text-center border-2 border-dashed border-border rounded-2xl bg-white shadow-sm flex flex-col items-center">
          <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-6">
            <PackageX size={32} className="text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-display font-bold text-primary uppercase tracking-tight mb-2">No products found</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            There are currently no items available in this category. Try selecting a different category from the menu above.
          </p>
          <Link href="/" className="mt-8 px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-accent transition-colors shadow-md inline-block">
            Browse Categories
          </Link>
        </div>
      ) : view === "list" ? (
        <ListView products={productsData.products} onSelect={setSelectedProduct} />
      ) : (
        <GridView products={productsData.products} onSelect={setSelectedProduct} />
      )}
    </div>
  );
}
