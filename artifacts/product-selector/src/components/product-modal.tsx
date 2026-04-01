import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { getGetCategoryProductsQueryOptions } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageOff, Copy, Check, ChevronLeft, ChevronRight, Loader2, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";

interface Product {
  id: number;
  name: string;
  sku: string | null;
  price: number | null;
  categoryId?: number | null;
  netsuiteId?: string | null;
  imageUrl?: string | null;
  fullImageUrl?: string | null;
}

interface FullProduct extends Product {
  ourPrice: number | null;
  retailPrice: number | null;
  description: string | null;
  manufacturer: string | null;
  quantityAvailable: number | null;
  features: string[] | null;
  additionalImages?: string[] | null;
}

interface ProductModalProps {
  product: Product | null;
  categoryPath?: string;
  onClose: () => void;
}

function getProductImageList(product: Product, additionalImages?: string[] | null): string[] {
  if (additionalImages && additionalImages.length > 0) {
    return [...new Set(additionalImages)];
  }
  const images: string[] = [];
  if (product.fullImageUrl) images.push(product.fullImageUrl);
  if (product.imageUrl && product.imageUrl !== product.fullImageUrl) images.push(product.imageUrl);
  return images;
}

function ImageGallery({ product, additionalImages }: { product: Product; additionalImages?: string[] | null }) {
  const images = getProductImageList(product, additionalImages);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [failedIndexes, setFailedIndexes] = useState<Set<number>>(new Set());
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    setSelectedIndex(0);
    setFailedIndexes(new Set());
  }, [product.id, additionalImages?.length]);

  const visibleImages = images.map((src, i) => ({ src, i })).filter(({ i }) => !failedIndexes.has(i));

  const goTo = useCallback((index: number) => {
    setDirection(index > selectedIndex ? 1 : -1);
    setSelectedIndex(index);
  }, [selectedIndex]);

  const goPrev = useCallback(() => { if (selectedIndex > 0) goTo(selectedIndex - 1); }, [selectedIndex, goTo]);
  const goNext = useCallback(() => { if (selectedIndex < images.length - 1) goTo(selectedIndex + 1); }, [selectedIndex, images.length, goTo]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setLightboxOpen(false); }
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [lightboxOpen, goPrev, goNext]);
  const handleError = useCallback((index: number) => {
    setFailedIndexes(prev => {
      const next = new Set([...prev, index]);
      const remaining = images.filter((_, i) => !next.has(i));
      if (remaining.length > 0 && next.has(selectedIndex)) {
        const nextValid = images.findIndex((_, i) => !next.has(i));
        if (nextValid >= 0) setSelectedIndex(nextValid);
      }
      return next;
    });
  }, [images, selectedIndex]);

  const currentSrc = images[selectedIndex];
  const isFailed = failedIndexes.has(selectedIndex) || !currentSrc;

  if (images.length === 0) {
    return (
      <div className="bg-white rounded-2xl h-[180px] lg:aspect-square lg:h-auto flex items-center justify-center flex-col gap-2 text-gray-300">
        <ImageOff size={32} />
        <span className="text-xs">No image</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative bg-white rounded-2xl h-[180px] lg:aspect-square lg:h-auto overflow-hidden group">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          {isFailed ? (
            <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 text-gray-300">
              <ImageOff size={32} />
              <span className="text-xs">No image</span>
            </div>
          ) : (
            <motion.div
              key={selectedIndex}
              custom={direction}
              initial={{ opacity: 0, x: direction * 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -20 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center p-8 cursor-zoom-in"
              onClick={() => setLightboxOpen(true)}
            >
              <img
                src={currentSrc}
                alt={`${product.name} — view ${selectedIndex + 1}`}
                onError={() => handleError(selectedIndex)}
                className="max-w-[200px] max-h-[200px] object-contain"
              />
              <div className="absolute bottom-2 left-2 bg-black/30 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                <ZoomIn size={10} />
                Click to enlarge
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {visibleImages.length > 1 && (
          <>
            <button
              onClick={goPrev}
              disabled={selectedIndex === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={goNext}
              disabled={selectedIndex === images.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0"
            >
              <ChevronRight size={14} />
            </button>
            <div className="absolute bottom-2 right-2 bg-black/30 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              {selectedIndex + 1} / {visibleImages.length}
            </div>
          </>
        )}
      </div>

      {visibleImages.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {visibleImages.map(({ src, i }) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                "shrink-0 w-12 h-12 rounded-lg bg-white overflow-hidden border-2 transition-all duration-150 p-1",
                i === selectedIndex ? "border-gray-900" : "border-transparent hover:border-gray-200"
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

      {lightboxOpen && !isFailed && currentSrc && createPortal(
        <AnimatePresence>
          <motion.div
            key="lightbox-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[10000] flex items-center justify-center cursor-zoom-out"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
            >
              <X size={20} />
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              disabled={selectedIndex <= 0}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors disabled:opacity-0 disabled:pointer-events-none z-10"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              disabled={selectedIndex >= images.length - 1}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors disabled:opacity-0 disabled:pointer-events-none z-10"
            >
              <ChevronRight size={24} />
            </button>

            <motion.img
              key={`lightbox-${selectedIndex}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              src={currentSrc}
              alt={`${product.name} — full size view ${selectedIndex + 1}`}
              onClick={(e) => e.stopPropagation()}
              className="max-w-[85vw] max-h-[80vh] object-contain cursor-default"
            />

            {visibleImages.length > 1 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10" onClick={(e) => e.stopPropagation()}>
                <div className="flex gap-2 bg-black/40 backdrop-blur-sm rounded-full px-3 py-2">
                  {visibleImages.map(({ src, i }) => (
                    <button
                      key={i}
                      onClick={() => goTo(i)}
                      className={cn(
                        "shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all duration-150 p-0.5",
                        i === selectedIndex ? "border-white" : "border-transparent opacity-50 hover:opacity-80"
                      )}
                    >
                      <img
                        src={src}
                        alt={`View ${i + 1}`}
                        className="w-full h-full object-contain"
                      />
                    </button>
                  ))}
                </div>
                <span className="bg-white/10 backdrop-blur-sm text-white text-sm font-medium px-3 py-1.5 rounded-full">
                  {selectedIndex + 1} / {visibleImages.length}
                </span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function RelatedMiniCard({ product, onSelect }: { product: FullProduct; onSelect: (p: FullProduct) => void }) {
  const images = getProductImageList(product);
  const [failedIndexes, setFailedIndexes] = useState<Set<number>>(new Set());
  const displayPrice = product.ourPrice ?? product.price;
  const visibleSrc = images.find((_, i) => !failedIndexes.has(i)) ?? null;

  return (
    <button
      onClick={() => onSelect(product)}
      className="shrink-0 w-44 bg-gray-50 hover:bg-gray-100 rounded-2xl overflow-hidden text-left transition-colors cursor-pointer"
    >
      <div className="h-36 flex items-center justify-center p-4">
        {!visibleSrc ? (
          <ImageOff size={20} className="text-gray-300" />
        ) : (
          <img
            src={visibleSrc}
            alt={product.name}
            onError={() => {
              const idx = images.indexOf(visibleSrc);
              if (idx >= 0) setFailedIndexes(prev => new Set([...prev, idx]));
            }}
            className="w-full h-full object-contain"
          />
        )}
      </div>
      <div className="px-3 pb-3">
        <p className="text-[12px] font-medium text-gray-800 leading-snug line-clamp-2 mb-1">
          {product.name}
        </p>
        {displayPrice != null ? (
          <p className="text-[13px] font-semibold text-gray-900">${Number(displayPrice).toFixed(2)}</p>
        ) : (
          <p className="text-[12px] text-gray-300">—</p>
        )}
      </div>
    </button>
  );
}

function CopySku({ sku }: { sku: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => navigator.clipboard.writeText(sku).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
      className="flex items-center gap-1.5 font-mono bg-gray-100 hover:bg-gray-200 hover:text-gray-700 px-2 py-0.5 rounded-full transition-all text-[14px] text-[#1f2630]"
      title="Copy SKU"
    >
      {copied ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
      {sku}
    </button>
  );
}

export default function ProductModal({ product, categoryPath, onClose }: ProductModalProps) {
  const [activeProduct, setActiveProduct] = useState<FullProduct | null>(null);

  // Reset to the outer product whenever the modal opens a new item
  useEffect(() => {
    setActiveProduct(null);
  }, [product?.id]);

  const resolvedId = activeProduct?.id ?? product?.id;

  const { data, isLoading } = useQuery<{ product: FullProduct }>({
    queryKey: [`/api/products/${resolvedId}`],
    queryFn: async () => {
      const res = await fetch(`/api/products/${resolvedId}`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!resolvedId,
  });

  const full = data?.product ?? activeProduct;
  const displayProduct = full ?? product;

  useEffect(() => {
    if (!product) return;
    setBottomTab("more");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [product?.id, onClose]);

  const categoryId = full?.categoryId ?? product?.categoryId ?? null;
  const { data: relatedData } = useQuery({
    ...getGetCategoryProductsQueryOptions(categoryId ?? 0),
    enabled: !!categoryId,
  });
  const relatedProducts = ((relatedData?.products ?? []) as FullProduct[])
    .filter(p => p.id !== resolvedId);

  const directCategoryName = categoryPath
    ? categoryPath.split(" › ").at(-1)
    : null;

  const [bottomTab, setBottomTab] = useState<"more" | "related" | "specs" | "collection">("more");

  const handleSelectRelated = useCallback((p: FullProduct) => {
    setActiveProduct(p);
    setBottomTab("more");
  }, []);


  return createPortal(
    <AnimatePresence>
      {product && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9998]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8 pointer-events-none"
          >
            <div
              className="bg-white rounded-3xl shadow-2xl shadow-black/25 w-full max-w-5xl pointer-events-auto overflow-hidden flex flex-col"
              style={{ maxHeight: "calc(100vh - 4rem)" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Product name */}
              <div className="px-5 pt-5 pb-3 lg:px-8 lg:pt-7 lg:pb-5 shrink-0">
                <h2 className="font-display font-bold text-gray-900 text-xl lg:text-3xl leading-tight">
                  {displayProduct?.name}
                </h2>
              </div>

              {/* 3-column body */}
              <div className="flex-1 overflow-y-auto px-5 lg:px-8 pb-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-20 text-gray-300">
                    <Loader2 size={28} className="animate-spin" />
                  </div>
                ) : (
                  <div className="flex flex-col lg:flex-row gap-5 lg:gap-8 pb-2">

                    {/* Left — image gallery */}
                    <div className="lg:w-[30%] shrink-0">
                      <ImageGallery product={product} additionalImages={(full as FullProduct)?.additionalImages} />
                    </div>

                    {/* Middle — features */}
                    <div className="lg:w-[36%] shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 pt-4 lg:pt-0 lg:pl-8">
                      {full?.description ? (
                        <div className="mb-5">
                          <p className="font-semibold uppercase tracking-widest text-gray-400 mb-3 text-[12px]">Description</p>
                          <div
                            className="text-[13px] text-gray-600 leading-relaxed prose prose-sm max-w-none [&_br]:mb-1"
                            dangerouslySetInnerHTML={{ __html: full.description }}
                          />
                        </div>
                      ) : null}
                      {full?.features && full.features.length > 0 ? (
                        <>
                          <p className="font-semibold uppercase tracking-widest text-gray-400 mb-4 text-[12px]">Features</p>
                          <ul className="space-y-3">
                            {full.features.map((f, i) => (
                              <li key={i} className="flex items-start gap-3 text-gray-600 text-[14px]">
                                <span className="mt-2 w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : !full?.description ? (
                        <p className="text-sm text-gray-300 italic">No description available.</p>
                      ) : null}
                    </div>

                    {/* Right — pricing + details */}
                    <div className="flex-1 border-t lg:border-t-0 lg:border-l border-gray-100 pt-4 lg:pt-0 lg:pl-8">
                      {/* Pricing */}
                      <div className="mb-5">
                        {full?.price != null ? (
                          <>
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Our Price</p>
                            <p className="text-3xl font-bold text-gray-900 mb-2">
                              ${Number(full.price).toFixed(2)}
                            </p>
                            {full.retailPrice != null && (
                              <p className="text-sm text-gray-400">
                                Retail <span className="line-through">${Number(full.retailPrice).toFixed(2)}</span>
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-gray-400 text-xl font-normal">Call for price</p>
                        )}
                      </div>

                      <hr className="border-gray-100 mb-6" />

                      {/* Metadata */}
                      <dl className="space-y-4">
                        {full?.manufacturer && (
                          <div>
                            <dt className="font-semibold uppercase tracking-widest text-gray-400 mb-1 text-[11px]">Manufacturer</dt>
                            <dd className="text-sm font-medium text-gray-900">{full.manufacturer}</dd>
                          </div>
                        )}
                        {displayProduct?.sku && (
                          <div>
                            <dt className="font-semibold uppercase tracking-widest text-gray-400 mb-1 text-[11px]">SKU</dt>
                            <dd><CopySku sku={displayProduct.sku} /></dd>
                          </div>
                        )}
                        <div>
                          <dt className="font-semibold uppercase tracking-widest text-gray-400 mb-1 text-[11px]">Availability</dt>
                          {full?.quantityAvailable != null ? (
                            full.quantityAvailable >= 1 ? (
                              <dd><span className="inline-flex items-center font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[11px]">In Stock</span></dd>
                            ) : (
                              <dd><span className="inline-flex items-center font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-50 text-red-500 text-[11px]">Out of Stock</span></dd>
                            )
                          ) : (
                            <dd className="text-sm font-medium text-gray-400">—</dd>
                          )}
                        </div>
                      </dl>
                    </div>
                  </div>
                )}

                {/* Bottom tabbed section */}
                <div className="mt-5 lg:mt-8 pt-0 border-t border-gray-100">
                  {/* Tab bar */}
                  <div className="flex items-center gap-0 border-b border-gray-100 mb-4 lg:mb-5 overflow-x-auto">
                    {(
                      [
                        { key: "more", label: `More from ${directCategoryName ?? "Category"}` },
                        { key: "related", label: "Related Items" },
                        { key: "specs", label: "Specifications" },
                        { key: "collection", label: "Collection" },
                      ] as const
                    ).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setBottomTab(tab.key)}
                        className="px-3 lg:px-4 py-2.5 lg:py-3 relative transition-colors whitespace-nowrap hover:text-gray-600 text-[12px] lg:text-[13px] font-normal text-[#4a5565]"
                      >
                        {tab.label}
                        {bottomTab === tab.key && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  {bottomTab === "more" && (
                    relatedProducts.length > 0 ? (
                      <div className="flex gap-3 overflow-x-auto pb-4">
                        {relatedProducts.map(p => (
                          <RelatedMiniCard key={p.id} product={p} onSelect={handleSelectRelated} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-300 italic pb-4">No other products in this category.</p>
                    )
                  )}

                  {bottomTab === "related" && (
                    relatedProducts.length > 0 ? (
                      <div className="flex gap-3 overflow-x-auto pb-4">
                        {[...relatedProducts].reverse().map(p => (
                          <RelatedMiniCard key={p.id} product={p} onSelect={handleSelectRelated} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-300 italic pb-4">No related items found.</p>
                    )
                  )}

                  {bottomTab === "specs" && (
                    <div className="pb-4">
                      <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
                        {full?.manufacturer && (
                          <div>
                            <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Manufacturer</dt>
                            <dd className="text-sm text-gray-800">{full.manufacturer}</dd>
                          </div>
                        )}
                        {displayProduct?.sku && (
                          <div>
                            <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">SKU</dt>
                            <dd className="font-mono text-sm text-gray-800">{displayProduct.sku}</dd>
                          </div>
                        )}
                        {full?.price != null && (
                          <div>
                            <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Retail Price</dt>
                            <dd className="text-sm text-gray-800">${Number(full.price).toFixed(2)}</dd>
                          </div>
                        )}
                        {full?.ourPrice != null && (
                          <div>
                            <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Our Price</dt>
                            <dd className="text-sm text-gray-800">${Number(full.ourPrice).toFixed(2)}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Availability</dt>
                          {full?.quantityAvailable != null ? (
                            full.quantityAvailable >= 1 ? (
                              <dd><span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">In Stock</span></dd>
                            ) : (
                              <dd><span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-50 text-red-500">Out of Stock</span></dd>
                            )
                          ) : (
                            <dd className="text-sm font-medium text-gray-400">—</dd>
                          )}
                        </div>
                        {full?.netsuiteId && (
                          <div>
                            <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">NetSuite ID</dt>
                            <dd className="font-mono text-sm text-gray-800">{full.netsuiteId}</dd>
                          </div>
                        )}
                        {directCategoryName && (
                          <div>
                            <dt className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">Category</dt>
                            <dd className="text-sm text-gray-800">{directCategoryName}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}

                  {bottomTab === "collection" && (
                    full?.manufacturer ? (
                      <div>
                        <p className="text-[11px] text-gray-400 mb-3">
                          Other products by <span className="font-semibold text-gray-600">{full.manufacturer}</span>
                        </p>
                        <div className="flex gap-3 overflow-x-auto pb-4">
                          {relatedProducts
                            .filter(p => (p as FullProduct).manufacturer === full.manufacturer)
                            .concat(
                              relatedProducts.filter(p => (p as FullProduct).manufacturer !== full.manufacturer)
                            )
                            .slice(0, 12)
                            .map(p => (
                              <RelatedMiniCard key={p.id} product={p} onSelect={handleSelectRelated} />
                            ))}
                        </div>
                        {relatedProducts.length === 0 && (
                          <p className="text-sm text-gray-300 italic pb-4">No collection items found.</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-300 italic pb-4">Collection data not available.</p>
                    )
                  )}
                </div>
              </div>

              {/* Footer actions */}
              <div className="px-5 py-4 lg:px-8 lg:py-5 border-t border-gray-100 shrink-0 flex justify-end">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors border border-gray-200 hover:border-gray-300 rounded-xl"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
