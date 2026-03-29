import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useGetCategories } from "@workspace/api-client-react";
import { useCategoryPath } from "@/hooks/use-category-path";
import { ChevronRight, ImageOff, Copy, Check, ArrowLeft, Tag, Barcode, DollarSign } from "lucide-react";

const CUSTOM_PRODUCT_IDS = new Set([39, 40, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98]);

interface ProductData {
  id: number;
  name: string;
  sku: string | null;
  price: number | null;
  categoryId: number | null;
  netsuiteId: string | null;
}

function ProductImage({ id, name }: { id: number; name: string }) {
  const [fallback, setFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const useCustom = CUSTOM_PRODUCT_IDS.has(id) && !fallback;
  const src = useCustom
    ? `${import.meta.env.BASE_URL}products/prod-${id}.png`
    : `https://picsum.photos/seed/product-${id}/800/800`;

  if (failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
        <ImageOff size={36} />
        <span className="text-sm">No image available</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => (useCustom ? setFallback(true) : setFailed(true))}
      className="w-full h-full object-contain p-8"
    />
  );
}

export default function ProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const [copiedSku, setCopiedSku] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: [`/api/products/${productId}`],
    queryFn: () =>
      customFetch<{ product: ProductData }>(`/api/products/${productId}`),
    enabled: !!productId,
  });

  const { data: categoryData } = useGetCategories();
  const product = data?.product;

  const path = useCategoryPath(categoryData?.categories ?? [], product?.categoryId ?? null);

  const handleCopySku = () => {
    if (!product?.sku) return;
    navigator.clipboard.writeText(product.sku).then(() => {
      setCopiedSku(true);
      setTimeout(() => setCopiedSku(false), 1500);
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <p className="text-muted-foreground mb-4">Product not found.</p>
        <Link href="/" className="text-primary hover:underline text-sm">← Back to home</Link>
      </div>
    );
  }

  const categoryHref = product.categoryId ? `/products/${product.categoryId}` : "/";

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-8 flex-wrap">
        <Link href="/" className="hover:text-primary transition-colors">Home</Link>
        {path.map((crumb, i) => (
          <span key={crumb.id} className="flex items-center gap-1.5">
            <ChevronRight size={13} className="text-muted-foreground/50" />
            {i < path.length - 1 ? (
              <Link
                href={crumb.level === 3 ? `/products/${crumb.id}` : `/category/${crumb.id}`}
                className="hover:text-primary transition-colors"
              >
                {crumb.name}
              </Link>
            ) : (
              <Link href={`/products/${crumb.id}`} className="hover:text-primary transition-colors">
                {crumb.name}
              </Link>
            )}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <ChevronRight size={13} className="text-muted-foreground/50" />
          <span className="text-foreground font-medium truncate max-w-[200px]">{product.name}</span>
        </span>
      </nav>

      {/* Main content */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col md:flex-row">
        {/* Image panel */}
        <div className="md:w-[45%] shrink-0 bg-[#f3f4f6] min-h-[320px] md:min-h-[420px] flex items-center justify-center">
          <ProductImage id={product.id} name={product.name} />
        </div>

        {/* Info panel */}
        <div className="flex-1 p-8 flex flex-col">
          {/* SKU */}
          <div className="flex items-center gap-2 mb-3">
            <Barcode size={14} className="text-muted-foreground" />
            {product.sku ? (
              <>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  SKU: {product.sku}
                </span>
                <button
                  type="button"
                  onClick={handleCopySku}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy SKU"
                >
                  {copiedSku ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                </button>
              </>
            ) : (
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">No SKU</span>
            )}
          </div>

          {/* Name */}
          <h1 className="font-display font-bold text-foreground text-2xl lg:text-3xl leading-snug mb-4">
            {product.name}
          </h1>

          {/* Category */}
          {path.length > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
              <Tag size={13} className="shrink-0" />
              <Link href={categoryHref} className="hover:text-primary transition-colors">
                {path.map(c => c.name).join(" › ")}
              </Link>
            </div>
          )}

          {/* Price */}
          <div className="mb-8">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
              <DollarSign size={12} /> MSRP
            </p>
            <p className="text-4xl font-bold text-foreground">
              {product.price != null
                ? `$${Number(product.price).toFixed(2)}`
                : <span className="text-muted-foreground text-2xl font-normal italic">Call for price</span>
              }
            </p>
          </div>

          <div className="mt-auto space-y-3">
            {/* NetSuite ID */}
            {product.netsuiteId && (
              <p className="text-[11px] text-muted-foreground">
                NetSuite ID: <span className="font-mono">{product.netsuiteId}</span>
              </p>
            )}

            {/* Back link */}
            <Link
              href={categoryHref}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft size={14} />
              Back to {path[path.length - 1]?.name ?? "category"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
