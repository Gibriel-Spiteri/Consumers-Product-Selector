import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetCategories, useGetCategoryProducts } from "@workspace/api-client-react";
import { useCategoryPath } from "@/hooks/use-category-path";
import { ChevronRight, ImageOff, Copy, Check, PackageSearch, Truck, ShieldCheck } from "lucide-react";
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

function useProductSrc(id: number) {
  const custom = CUSTOM_PRODUCT_IDS.has(id);
  return {
    main: custom
      ? `${import.meta.env.BASE_URL}products/prod-${id}.png`
      : `https://picsum.photos/seed/product-${id}/800/800`,
    fallback: `https://picsum.photos/seed/product-${id}/800/800`,
    isCustom: custom,
  };
}

function MainImage({ id, name }: { id: number; name: string }) {
  const [useFallback, setUseFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const { main, fallback, isCustom } = useProductSrc(id);
  const src = isCustom && !useFallback ? main : fallback;

  if (failed) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground flex-col gap-2">
        <ImageOff size={36} />
        <span className="text-xs">No image</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      onError={() => (isCustom && !useFallback ? setUseFallback(true) : setFailed(true))}
      className="w-full h-full object-contain"
    />
  );
}

function RelatedCard({ product }: { product: ProductData }) {
  const [useFallback, setUseFallback] = useState(false);
  const { main, fallback, isCustom } = useProductSrc(product.id);
  const src = isCustom && !useFallback ? main : fallback;

  return (
    <Link href={`/product/${product.id}`}>
      <div className="shrink-0 w-44 bg-white rounded-xl border border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer group">
        <div className="h-36 bg-[#f5f5f5] rounded-t-xl overflow-hidden flex items-center justify-center p-3">
          <img
            src={src}
            alt={product.name}
            onError={() => setUseFallback(true)}
            className="w-full h-full object-contain"
          />
        </div>
        <div className="p-3">
          <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-1">
            {product.name}
          </p>
          {product.price != null ? (
            <p className="text-xs font-bold text-foreground">${Number(product.price).toFixed(2)}</p>
          ) : (
            <p className="text-xs text-muted-foreground italic">Call for price</p>
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
  const relatedProducts = (relatedData?.products ?? [])
    .filter(p => p.id !== product?.id) as ProductData[];

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

  const l1Category = path[0];
  const directCategory = path[path.length - 1];

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6">

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          {path.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1.5">
              <ChevronRight size={13} className="text-muted-foreground/40 shrink-0" />
              <Link
                href={crumb.level === 3 ? `/products/${crumb.id}` : `/category/${crumb.id}`}
                className="hover:text-foreground transition-colors"
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

        {/* Main layout */}
        <div className="flex flex-col lg:flex-row gap-12 mb-16">

          {/* Left — image + thumbnail strip */}
          <div className="lg:w-[48%] shrink-0">
            <div className="bg-white border border-border rounded-2xl overflow-hidden aspect-square flex items-center justify-center p-10">
              <MainImage id={product.id} name={product.name} />
            </div>
            {/* Thumbnail */}
            <div className="mt-4 flex gap-3">
              <div className="w-20 h-20 border-2 border-primary rounded-xl overflow-hidden flex items-center justify-center bg-[#f5f5f5] p-2 cursor-pointer">
                <MainImage id={product.id} name={product.name} />
              </div>
            </div>
          </div>

          {/* Right — product info */}
          <div className="flex-1">

            {/* Category + SKU row */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-500">
                {l1Category?.name ?? directCategory?.name ?? "Product"}
              </p>
              {product.sku && (
                <p className="text-[11px] text-muted-foreground font-mono shrink-0">
                  SKU: {product.sku}
                </p>
              )}
            </div>

            {/* Product name */}
            <h1 className="font-display font-bold text-foreground text-3xl lg:text-4xl leading-tight mb-6">
              {product.name}
            </h1>

            {/* Price */}
            <p className="text-4xl font-bold text-foreground mb-3">
              {product.price != null
                ? `$${Number(product.price).toFixed(2)}`
                : <span className="text-2xl font-normal text-muted-foreground italic">Call for price</span>
              }
            </p>

            {/* Stock badge */}
            <div className="flex items-center gap-1.5 mb-6">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              <span className="text-sm text-green-600 font-semibold">In Stock &amp; Ready to Ship</span>
            </div>

            {/* SKU copy action */}
            {product.sku && (
              <div className="mb-8">
                <button
                  onClick={handleCopySku}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all",
                    copiedSku
                      ? "bg-green-600 text-white"
                      : "bg-primary text-white hover:bg-primary/90"
                  )}
                >
                  {copiedSku
                    ? <><Check size={16} /> Copied to Clipboard</>
                    : <><Copy size={16} /> Copy Model Number ({product.sku})</>
                  }
                </button>
              </div>
            )}

            {/* Feature callouts */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-4 bg-secondary/40 border border-border rounded-xl">
                <Truck size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Free Shipping</p>
                  <p className="text-xs text-muted-foreground mt-0.5">On all orders over $500 nationwide.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-secondary/40 border border-border rounded-xl">
                <ShieldCheck size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Lifetime Warranty</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Quality guaranteed for your peace of mind.</p>
                </div>
              </div>
            </div>

            {/* NetSuite ID (small, de-emphasized) */}
            {product.netsuiteId && (
              <p className="mt-6 text-[11px] text-muted-foreground/60">
                NetSuite ID: <span className="font-mono">{product.netsuiteId}</span>
              </p>
            )}
          </div>
        </div>

        {/* More in category */}
        {relatedProducts.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                More in {directCategory?.name ?? "this category"}
              </p>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {relatedProducts.map(p => (
                <RelatedCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
