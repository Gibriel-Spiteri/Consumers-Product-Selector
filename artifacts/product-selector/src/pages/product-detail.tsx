import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetCategories, getGetCategoryProductsQueryOptions } from "@workspace/api-client-react";
import { useCategoryPath } from "@/hooks/use-category-path";
import { ChevronRight, ImageOff, PackageSearch, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const CUSTOM_PRODUCT_IDS = new Set([39, 40, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98]);

interface ProductData {
  id: number;
  name: string;
  sku: string | null;
  price: number | null;
  ourPrice: number | null;
  categoryId: number | null;
  netsuiteId: string | null;
  manufacturer: string | null;
  features: string[] | null;
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

function CopySku({ sku }: { sku: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(sku).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 font-mono text-[12px] text-gray-400 bg-gray-100 hover:bg-gray-200 hover:text-gray-700 px-2.5 py-1 rounded-full transition-all"
      title="Copy SKU"
    >
      {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
      {sku}
    </button>
  );
}

function RelatedCard({ product }: { product: ProductData }) {
  const [useFallback, setUseFallback] = useState(false);
  const { main, fallback, isCustom } = useProductSrc(product.id);
  const src = isCustom && !useFallback ? main : fallback;

  return (
    <Link href={`/product/${product.id}`}>
      <div className="shrink-0 w-48 bg-white rounded-2xl overflow-hidden cursor-pointer group hover:-translate-y-1 hover:shadow-lg transition-all duration-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <div className="h-40 bg-[#f7f8fa] flex items-center justify-center p-5">
          <img
            src={src}
            alt={product.name}
            onError={() => setUseFallback(true)}
            className="w-full h-full object-contain"
          />
        </div>
        <div className="p-4">
          <p className="text-[13px] font-medium text-gray-800 leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-1.5">
            {product.name}
          </p>
          {product.ourPrice != null ? (
            <p className="text-sm font-semibold text-gray-900">${Number(product.ourPrice).toFixed(2)}</p>
          ) : product.price != null ? (
            <p className="text-sm font-semibold text-gray-900">${Number(product.price).toFixed(2)}</p>
          ) : (
            <p className="text-sm text-gray-300">—</p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function ProductDetail() {
  const { productId } = useParams<{ productId: string }>();
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

  const { data: relatedData } = useQuery({
    ...getGetCategoryProductsQueryOptions(product?.categoryId ?? 0),
    enabled: !!product?.categoryId,
  });
  const relatedProducts = (relatedData?.products ?? [])
    .filter(p => p.id !== product?.id) as ProductData[];

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

  const hasDiscount = product.ourPrice != null && product.price != null && product.ourPrice < product.price;
  const displayPrice = product.ourPrice ?? product.price;

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-10">

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-[12px] text-gray-400 mb-10 flex-wrap">
          <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
          {path.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight size={11} className="text-gray-300 shrink-0" />
              <Link
                href={crumb.level === 3 ? `/products/${crumb.id}` : `/category/${crumb.id}`}
                className="hover:text-gray-600 transition-colors"
              >
                {crumb.name}
              </Link>
            </span>
          ))}
          <span className="flex items-center gap-1">
            <ChevronRight size={11} className="text-gray-300 shrink-0" />
            <span className="text-gray-700">{product.name}</span>
          </span>
        </nav>

        {/* Main layout */}
        <div className="flex flex-col lg:flex-row gap-16 mb-20">

          {/* Left — image */}
          <div className="lg:w-[48%] shrink-0">
            <div className="bg-[#f7f8fa] rounded-3xl aspect-square flex items-center justify-center p-12">
              <MainImage id={product.id} name={product.name} />
            </div>
          </div>

          {/* Right — product info */}
          <div className="flex-1 pt-1">

            {/* Category + SKU row */}
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-amber-500">
                {l1Category?.name ?? directCategory?.name ?? "Product"}
              </span>
              {product.sku && (
                <>
                  <span className="text-gray-200">·</span>
                  <CopySku sku={product.sku} />
                </>
              )}
            </div>

            {/* Product name */}
            <h1 className="font-display font-bold text-gray-900 text-3xl lg:text-4xl leading-tight mb-8">
              {product.name}
            </h1>

            {/* Pricing block */}
            <div className="flex items-baseline gap-3 mb-2">
              {displayPrice != null && (
                <span className="text-3xl font-bold text-gray-900">
                  ${Number(displayPrice).toFixed(2)}
                </span>
              )}
              {hasDiscount && product.price != null && (
                <span className="text-base text-gray-400 line-through">
                  ${Number(product.price).toFixed(2)}
                </span>
              )}
              <span className="text-[12px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                In Stock
              </span>
            </div>
            {product.ourPrice != null && (
              <p className="text-[12px] text-gray-400 mb-8">Our price · Retail {product.price != null ? `$${Number(product.price).toFixed(2)}` : "—"}</p>
            )}

            <hr className="border-gray-100 mb-8" />

            {/* Open metadata */}
            <dl className="grid grid-cols-2 gap-x-10 gap-y-7 mb-8">
              {product.manufacturer && (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Manufacturer</dt>
                  <dd className="text-sm font-medium text-gray-900">{product.manufacturer}</dd>
                </div>
              )}
              {product.sku && (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">SKU</dt>
                  <dd className="font-mono text-sm text-gray-700">{product.sku}</dd>
                </div>
              )}
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">Availability</dt>
                <dd className="text-sm font-medium text-emerald-600">In Stock</dd>
              </div>
            </dl>

            {/* Features */}
            {product.features && product.features.length > 0 && (
              <>
                <hr className="border-gray-100 mb-8" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-5">Features</p>
                  <ul className="space-y-3.5">
                    {product.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-3 text-[14px] text-gray-600 leading-relaxed">
                        <span className="mt-2 w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>

        {/* More in category */}
        {relatedProducts.length > 0 && (
          <div>
            <div className="flex items-center gap-4 mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 whitespace-nowrap">
                More in {directCategory?.name ?? "this category"}
              </p>
              <div className="flex-1 h-px bg-gray-100" />
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
