import { useState, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useGetCategories, getGetCategoryProductsQueryOptions } from "@workspace/api-client-react";
import { useCategoryPath } from "@/hooks/use-category-path";
import { ChevronRight, ImageOff, PackageSearch, Copy, Check, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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

const PICSUM_ANGLE_SEEDS = ["angle", "detail", "side", "context"];

function useProductImages(id: number): string[] {
  const isCustom = CUSTOM_PRODUCT_IDS.has(id);
  const picsumImages = PICSUM_ANGLE_SEEDS.map(
    s => `https://picsum.photos/seed/product-${id}-${s}/800/800`
  );
  if (isCustom) {
    return [
      `${import.meta.env.BASE_URL}products/prod-${id}.png`,
      ...picsumImages,
    ];
  }
  return [
    `https://picsum.photos/seed/product-${id}/800/800`,
    ...picsumImages,
  ];
}

function ImageGallery({ id, name }: { id: number; name: string }) {
  const images = useProductImages(id);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [failedIndexes, setFailedIndexes] = useState<Set<number>>(new Set());

  const goTo = useCallback((index: number) => {
    setDirection(index > selectedIndex ? 1 : -1);
    setSelectedIndex(index);
  }, [selectedIndex]);

  const goPrev = () => { if (selectedIndex > 0) goTo(selectedIndex - 1); };
  const goNext = () => { if (selectedIndex < images.length - 1) goTo(selectedIndex + 1); };

  const handleError = (index: number) => {
    setFailedIndexes(prev => new Set([...prev, index]));
  };

  const visibleImages = images.map((src, i) => ({ src, i })).filter(({ i }) => !failedIndexes.has(i));

  const currentSrc = images[selectedIndex];
  const isFailed = failedIndexes.has(selectedIndex);

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div className="relative bg-[#f7f8fa] rounded-3xl aspect-square overflow-hidden group">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          {isFailed ? (
            <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 text-gray-300">
              <ImageOff size={36} />
              <span className="text-xs">No image</span>
            </div>
          ) : (
            <motion.div
              key={selectedIndex}
              custom={direction}
              initial={{ opacity: 0, x: direction * 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -30 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center p-12"
            >
              <img
                src={currentSrc}
                alt={`${name} — view ${selectedIndex + 1}`}
                onError={() => handleError(selectedIndex)}
                className="w-full h-full object-contain"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prev / Next arrows */}
        {visibleImages.length > 1 && (
          <>
            <button
              onClick={goPrev}
              disabled={selectedIndex === 0}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goNext}
              disabled={selectedIndex === images.length - 1}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0"
            >
              <ChevronRightIcon size={16} />
            </button>
          </>
        )}

        {/* Image counter */}
        {visibleImages.length > 1 && (
          <div className="absolute bottom-3 right-3 bg-black/30 backdrop-blur-sm text-white text-[11px] font-medium px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            {selectedIndex + 1} / {visibleImages.length}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {visibleImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {visibleImages.map(({ src, i }) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                "shrink-0 w-16 h-16 rounded-xl bg-[#f7f8fa] overflow-hidden border-2 transition-all duration-150 p-1.5",
                i === selectedIndex
                  ? "border-gray-900"
                  : "border-transparent hover:border-gray-200"
              )}
            >
              <img
                src={src}
                alt={`View ${i + 1}`}
                onError={() => handleError(i)}
                className="w-full h-full object-contain"
              />
            </button>
          ))}
        </div>
      )}
    </div>
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
  const images = useProductImages(product.id);
  const [failed, setFailed] = useState(false);
  const src = images[0];

  return (
    <Link href={`/product/${product.id}`}>
      <div className="shrink-0 w-48 bg-white rounded-2xl overflow-hidden cursor-pointer group hover:-translate-y-1 hover:shadow-lg transition-all duration-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
        <div className="h-40 bg-[#f7f8fa] flex items-center justify-center p-5">
          {failed ? (
            <ImageOff size={24} className="text-gray-300" />
          ) : (
            <img
              src={src}
              alt={product.name}
              onError={() => setFailed(true)}
              className="w-full h-full object-contain"
            />
          )}
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

        {/* Full-width product title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
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
          <h1 className="font-display font-bold text-gray-900 text-3xl lg:text-4xl leading-tight">
            {product.name}
          </h1>
        </div>

        {/* 3-column layout: image | features | details */}
        <div className="flex flex-col lg:flex-row gap-10 mb-20">

          {/* Left — image gallery (smaller) */}
          <div className="lg:w-[30%] shrink-0">
            <ImageGallery id={product.id} name={product.name} />
          </div>

          {/* Middle — features */}
          <div className="lg:w-[36%] shrink-0 lg:border-l lg:border-gray-100 lg:pl-10">
            {product.features && product.features.length > 0 ? (
              <>
                <p className="font-semibold uppercase tracking-widest text-gray-400 mb-5 text-[14px]">Features</p>
                <ul className="space-y-3.5">
                  {product.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-[14px] text-gray-600 leading-relaxed">
                      <span className="mt-2 w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-gray-300 italic">No features listed.</p>
            )}
          </div>

          {/* Right — pricing + details */}
          <div className="flex-1 lg:border-l lg:border-gray-100 lg:pl-10">

            {/* Pricing */}
            <div className="flex items-baseline gap-3 mb-1">
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
            </div>
            {product.ourPrice != null && (
              <p className="text-[12px] text-gray-400 mb-6">Our price · Retail {product.price != null ? `$${Number(product.price).toFixed(2)}` : "—"}</p>
            )}

            <span className="inline-flex items-center text-[12px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full mb-8">
              In Stock
            </span>

            <hr className="border-gray-100 mb-7" />

            {/* Metadata */}
            <dl className="space-y-5">
              {product.manufacturer && (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Manufacturer</dt>
                  <dd className="text-sm font-medium text-gray-900">{product.manufacturer}</dd>
                </div>
              )}
              {product.sku && (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">SKU</dt>
                  <dd className="font-mono text-sm text-gray-700">{product.sku}</dd>
                </div>
              )}
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Availability</dt>
                <dd className="text-sm font-medium text-emerald-600">In Stock</dd>
              </div>
            </dl>
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
