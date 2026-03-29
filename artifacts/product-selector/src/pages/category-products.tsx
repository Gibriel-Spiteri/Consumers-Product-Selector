import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetCategories, getGetCategoryProductsQueryOptions } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, PackageX, Loader2, ImageOff, LayoutList, LayoutGrid, Copy, Check } from "lucide-react";
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

const CUSTOM_PRODUCT_IDS = new Set([39, 40, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98]);

function ProductImage({ id, name, className }: { id: number; name: string; className?: string }) {
  const [fallback, setFallback] = useState(false);
  const [failed, setFailed] = useState(false);

  const customSrc = `${import.meta.env.BASE_URL}products/prod-${id}.png`;
  const fallbackSrc = `https://picsum.photos/seed/product-${id}/400/400`;
  const useCustom = CUSTOM_PRODUCT_IDS.has(id) && !fallback;

  if (failed) {
    return (
      <div className={cn("flex items-center justify-center text-muted-foreground/30", className)}>
        <ImageOff size={20} />
      </div>
    );
  }
  return (
    <img
      src={useCustom ? customSrc : fallbackSrc}
      alt={name}
      onError={() => useCustom ? setFallback(true) : setFailed(true)}
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
      className={cn(
        "ml-1 p-0.5 rounded transition-all shrink-0",
        copied
          ? "text-green-500"
          : "text-muted-foreground/30 hover:text-muted-foreground opacity-0 group-hover:opacity-100"
      )}
    >
      {copied ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} />}
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
          <div className="bg-[#f7f8fa] aspect-[4/3] flex items-center justify-center p-8">
            <ProductImage
              id={p.id}
              name={p.name}
              className="w-full h-full"
            />
          </div>
          <div className="p-5">
            <p className="text-[14px] font-medium text-gray-900 leading-snug line-clamp-2 mb-2.5 group-hover:text-primary transition-colors">
              {p.name}
            </p>
            {p.sku && (
              <div className="flex items-center gap-0.5 mb-3">
                <p className="font-mono text-[11px] text-gray-400">{p.sku}</p>
                <CopySkuButton sku={p.sku} />
              </div>
            )}
            <p className="font-semibold text-gray-900">
              {p.price
                ? `$${Number(p.price).toFixed(2)}`
                : <span className="text-gray-300 font-normal text-sm">—</span>
              }
            </p>
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
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-right w-[140px]">MSRP</th>
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
                  <div className="w-11 h-11 rounded-xl bg-[#f7f8fa] flex items-center justify-center overflow-hidden shrink-0 p-1.5">
                    <ProductImage id={p.id} name={p.name} className="w-full h-full" />
                  </div>
                </td>
                <td className="px-5 py-3 font-mono text-[12px] text-gray-400 group-hover:text-gray-600 transition-colors whitespace-nowrap">
                  {p.sku || '—'}
                </td>
                <td className="px-5 py-3 font-medium text-gray-900 group-hover:text-primary transition-colors">
                  {p.name}
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap font-semibold text-gray-900">
                  {p.price ? `$${Number(p.price).toFixed(2)}` : <span className="text-gray-300 font-normal">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

  const products = productsData?.products ?? [];

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
            {!isLoadingProducts && products.length > 0 && (
              <p className="text-[13px] text-gray-400 mt-1">{products.length} {products.length === 1 ? "item" : "items"}</p>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 shrink-0">
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
        </div>
      ) : view === "list" ? (
        <ListView products={products} onSelect={setSelectedProduct} />
      ) : (
        <GridView products={products} onSelect={setSelectedProduct} />
      )}
    </div>
  );
}
