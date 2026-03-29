import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetCategories, getGetCategoryProductsQueryOptions } from "@workspace/api-client-react";
import { useCategoryPath } from "@/hooks/use-category-path";
import { ChevronRight, ImageOff, PackageSearch } from "lucide-react";
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

function DetailRow({
  label,
  value,
  mono,
  highlight,
  green,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  green?: boolean;
}) {
  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="px-4 py-3 bg-gray-50 text-[11px] uppercase tracking-widest font-semibold text-gray-400 w-36 whitespace-nowrap">
        {label}
      </td>
      <td className={cn(
        "px-4 py-3 text-sm text-gray-700",
        mono && "font-mono text-gray-500",
        highlight && "font-bold text-gray-900 text-base",
        green && "text-emerald-600 font-semibold"
      )}>
        {value}
      </td>
    </tr>
  );
}

function RelatedCard({ product }: { product: ProductData }) {
  const [useFallback, setUseFallback] = useState(false);
  const { main, fallback, isCustom } = useProductSrc(product.id);
  const src = isCustom && !useFallback ? main : fallback;

  return (
    <Link href={`/product/${product.id}`}>
      <div className="shrink-0 w-44 bg-white rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group overflow-hidden">
        <div className="h-36 bg-[#f7f8fa] flex items-center justify-center p-4">
          <img
            src={src}
            alt={product.name}
            onError={() => setUseFallback(true)}
            className="w-full h-full object-contain"
          />
        </div>
        <div className="p-3 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-800 leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-1.5">
            {product.name}
          </p>
          {product.price != null ? (
            <p className="text-xs font-semibold text-gray-900">${Number(product.price).toFixed(2)}</p>
          ) : (
            <p className="text-xs text-gray-300">—</p>
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

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 lg:px-8 py-10">

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-[13px] text-gray-400 mb-8 flex-wrap">
          <Link href="/" className="hover:text-gray-700 transition-colors">Home</Link>
          {path.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1.5">
              <ChevronRight size={12} className="text-gray-300 shrink-0" />
              <Link
                href={crumb.level === 3 ? `/products/${crumb.id}` : `/category/${crumb.id}`}
                className="hover:text-gray-700 transition-colors"
              >
                {crumb.name}
              </Link>
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <ChevronRight size={12} className="text-gray-300 shrink-0" />
            <span className="text-gray-700 font-medium">{product.name}</span>
          </span>
        </nav>

        {/* Main layout */}
        <div className="flex flex-col lg:flex-row gap-12 mb-16">

          {/* Left — image */}
          <div className="lg:w-[46%] shrink-0">
            <div className="bg-[#f7f8fa] rounded-3xl overflow-hidden aspect-square flex items-center justify-center p-10">
              <MainImage id={product.id} name={product.name} />
            </div>
          </div>

          {/* Right — product info */}
          <div className="flex-1">

            {/* Category label */}
            <div className="mb-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-amber-500">
                {l1Category?.name ?? directCategory?.name ?? "Product"}
              </p>
            </div>

            {/* Product name */}
            <h1 className="font-display font-bold text-foreground text-3xl lg:text-4xl leading-tight mb-6">
              {product.name}
            </h1>

            {/* Product details table */}
            <div className="border border-gray-100 rounded-2xl overflow-hidden mb-6 shadow-sm">
              <table className="w-full text-sm">
                <tbody>
                  <DetailRow label="SKU" value={product.sku ?? "—"} mono />
                  <DetailRow label="Manufacturer" value={product.manufacturer ?? "—"} />
                  <DetailRow
                    label="Retail Price"
                    value={product.price != null ? `$${Number(product.price).toFixed(2)}` : "—"}
                  />
                  <DetailRow
                    label="Our Price"
                    value={product.ourPrice != null ? `$${Number(product.ourPrice).toFixed(2)}` : "—"}
                    highlight
                  />
                  <DetailRow label="Availability" value="In Stock" green />
                </tbody>
              </table>
            </div>

            {/* Features */}
            {product.features && product.features.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Features</p>
                <ul className="space-y-2">
                  {product.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* More in category */}
        {relatedProducts.length > 0 && (
          <div>
            <div className="flex items-center gap-4 mb-5">
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
