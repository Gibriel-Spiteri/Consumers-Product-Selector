import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetCategories, useGetCategoryProducts } from "@workspace/api-client-react";
import { useCategoryPath } from "@/hooks/use-category-path";
import {
  ChevronRight, ImageOff, Copy, Check, ArrowLeft,
  Tag, Barcode, DollarSign, PackageSearch, LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CUSTOM_PRODUCT_IDS = new Set([39, 40, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98]);

interface ProductData {
  id: number;
  name: string;
  sku: string | null;
  price: number | null;
  categoryId: number | null;
  netsuiteId: string | null;
}

function ProductImage({ id, name, className }: { id: number; name: string; className?: string }) {
  const [fallback, setFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const useCustom = CUSTOM_PRODUCT_IDS.has(id) && !fallback;
  const src = useCustom
    ? `${import.meta.env.BASE_URL}products/prod-${id}.png`
    : `https://picsum.photos/seed/product-${id}/800/800`;

  if (failed) {
    return (
      <div className={cn("flex flex-col items-center justify-center text-muted-foreground gap-3 bg-secondary/40", className)}>
        <ImageOff size={40} />
        <span className="text-sm">No image available</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => (useCustom ? setFallback(true) : setFailed(true))}
      className={cn("object-contain", className)}
    />
  );
}

function RelatedProductCard({ product, active }: { product: ProductData; active: boolean }) {
  const [fallback, setFallback] = useState(false);
  const useCustom = CUSTOM_PRODUCT_IDS.has(product.id) && !fallback;
  const src = useCustom
    ? `${import.meta.env.BASE_URL}products/prod-${product.id}.png`
    : `https://picsum.photos/seed/product-${product.id}/300/300`;

  return (
    <Link href={`/product/${product.id}`}>
      <div className={cn(
        "rounded-xl border transition-all cursor-pointer group",
        active
          ? "border-primary/30 bg-primary/5 shadow-sm"
          : "border-border bg-white hover:border-primary/20 hover:shadow-sm"
      )}>
        <div className="aspect-square bg-[#f3f4f6] rounded-t-xl overflow-hidden">
          <img
            src={src}
            alt={product.name}
            onError={() => setFallback(true)}
            className="w-full h-full object-contain p-3"
          />
        </div>
        <div className="p-3">
          <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {product.name}
          </p>
          {product.price != null && (
            <p className="text-xs text-accent font-bold mt-1">${Number(product.price).toFixed(2)}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function ProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const [copiedSku, setCopiedSku] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: [`/api/products/${productId}`],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}`);
      if (!res.ok) throw new Error("Product not found");
      return res.json() as Promise<{ product: ProductData }>;
    },
    enabled: !!productId,
  });

  const { data: categoryData } = useGetCategories();
  const product = data?.product;

  const path = useCategoryPath(categoryData?.categories ?? [], product?.categoryId ?? null);

  const { data: relatedData } = useGetCategoryProducts(
    product?.categoryId ?? 0,
    { query: { enabled: !!product?.categoryId } }
  );
  const relatedProducts = (relatedData?.products ?? []).filter(p => p.id !== product?.id).slice(0, 5);

  const handleCopySku = () => {
    if (!product?.sku) return;
    navigator.clipboard.writeText(product.sku).then(() => {
      setCopiedSku(true);
      setTimeout(() => setCopiedSku(false), 1500);
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <PackageSearch size={40} className="mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">Product not found.</p>
        <Link href="/" className="text-primary hover:underline text-sm">← Back to home</Link>
      </div>
    );
  }

  const categoryHref = product.categoryId ? `/products/${product.categoryId}` : "/";
  const parentCrumb = path[path.length - 2];
  const directCrumb = path[path.length - 1];

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6">

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6 flex-wrap">
        <Link href="/" className="hover:text-primary transition-colors">Home</Link>
        {path.map((crumb, i) => (
          <span key={crumb.id} className="flex items-center gap-1.5">
            <ChevronRight size={13} className="text-muted-foreground/40 shrink-0" />
            <Link
              href={crumb.level === 3 ? `/products/${crumb.id}` : `/category/${crumb.id}`}
              className="hover:text-primary transition-colors"
            >
              {crumb.name}
            </Link>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <ChevronRight size={13} className="text-muted-foreground/40 shrink-0" />
          <span className="text-foreground font-medium">{product.name}</span>
        </span>
      </nav>

      {/* Main product card */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden mb-8">
        <div className="flex flex-col md:flex-row">

          {/* Image */}
          <div className="md:w-[48%] shrink-0 bg-[#f3f4f6] flex items-center justify-center min-h-[320px] md:min-h-[480px]">
            <ProductImage id={product.id} name={product.name} className="w-full h-full max-h-[480px] p-10" />
          </div>

          {/* Details */}
          <div className="flex-1 flex flex-col p-8 lg:p-10">

            {/* SKU badge */}
            {product.sku && (
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="flex items-center gap-1.5 bg-secondary/60 border border-border px-3 py-1.5 rounded-lg">
                  <Barcode size={13} className="text-muted-foreground" />
                  <span className="text-xs font-mono font-semibold text-muted-foreground tracking-wide">
                    {product.sku}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySku}
                    className="text-muted-foreground hover:text-foreground transition-colors ml-0.5"
                    title="Copy SKU"
                  >
                    {copiedSku ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                  </button>
                </div>
              </div>
            )}

            {/* Product name */}
            <h1 className="font-display font-bold text-foreground text-2xl lg:text-3xl leading-tight mb-4">
              {product.name}
            </h1>

            {/* Category breadcrumb */}
            {path.length > 0 && (
              <div className="flex items-center gap-1.5 mb-6">
                <Tag size={13} className="text-muted-foreground shrink-0" />
                <div className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
                  {path.map((crumb, i) => (
                    <span key={crumb.id} className="flex items-center gap-1">
                      {i > 0 && <span className="text-muted-foreground/40">›</span>}
                      <Link
                        href={crumb.level === 3 ? `/products/${crumb.id}` : `/category/${crumb.id}`}
                        className="hover:text-primary transition-colors"
                      >
                        {crumb.name}
                      </Link>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Price */}
            <div className="bg-secondary/30 border border-border rounded-xl p-5 mb-6">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
                <DollarSign size={10} /> MSRP
              </p>
              {product.price != null ? (
                <p className="text-4xl font-bold text-foreground">
                  ${Number(product.price).toFixed(2)}
                </p>
              ) : (
                <p className="text-xl text-muted-foreground italic font-normal">Call for price</p>
              )}
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-secondary/30 border border-border rounded-xl p-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Model No.</p>
                <p className="text-sm font-mono font-semibold text-foreground">
                  {product.sku ?? <span className="italic font-sans font-normal text-muted-foreground">—</span>}
                </p>
              </div>
              <div className="bg-secondary/30 border border-border rounded-xl p-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Category</p>
                <p className="text-sm font-medium text-foreground">
                  {directCrumb?.name ?? "—"}
                </p>
              </div>
              {parentCrumb && (
                <div className="bg-secondary/30 border border-border rounded-xl p-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Department</p>
                  <p className="text-sm font-medium text-foreground">{parentCrumb.name}</p>
                </div>
              )}
              {product.netsuiteId && (
                <div className="bg-secondary/30 border border-border rounded-xl p-4">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">NetSuite ID</p>
                  <p className="text-sm font-mono text-muted-foreground">{product.netsuiteId}</p>
                </div>
              )}
            </div>

            {/* Back link */}
            <div className="mt-auto">
              <Link
                href={categoryHref}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft size={14} />
                Back to {directCrumb?.name ?? "category"}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Related products */}
      {relatedProducts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
              More in {directCrumb?.name ?? "this category"}
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {relatedProducts.map(p => (
              <RelatedProductCard key={p.id} product={p as ProductData} active={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
