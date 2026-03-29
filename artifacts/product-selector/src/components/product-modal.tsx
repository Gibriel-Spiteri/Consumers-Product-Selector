import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, ImageOff, Copy, Check, ArrowRight } from "lucide-react";

interface Product {
  id: number;
  name: string;
  sku: string | null;
  price: number | null;
  categoryId?: number | null;
  netsuiteId?: string | null;
}

interface ProductModalProps {
  product: Product | null;
  categoryPath?: string;
  onClose: () => void;
}

const CUSTOM_PRODUCT_IDS = new Set([39, 40, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98]);

function ProductImage({ id, name }: { id: number; name: string }) {
  const [fallback, setFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const useCustom = CUSTOM_PRODUCT_IDS.has(id) && !fallback;
  const src = useCustom
    ? `${import.meta.env.BASE_URL}products/prod-${id}.png`
    : `https://picsum.photos/seed/product-${id}/600/600`;

  if (failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
        <ImageOff size={28} />
        <span className="text-xs">No image</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => useCustom ? setFallback(true) : setFailed(true)}
      className="w-full h-full object-contain p-5"
    />
  );
}

export default function ProductModal({ product, categoryPath, onClose }: ProductModalProps) {
  const [copiedSku, setCopiedSku] = useState(false);

  const handleCopySku = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product?.sku) return;
    navigator.clipboard.writeText(product.sku).then(() => {
      setCopiedSku(true);
      setTimeout(() => setCopiedSku(false), 1500);
    });
  };

  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [product, onClose]);

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
            className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[9999]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="bg-white rounded-3xl shadow-2xl shadow-black/20 w-full max-w-lg pointer-events-auto overflow-hidden flex"
              onClick={e => e.stopPropagation()}
            >
              {/* Left — image */}
              <div className="w-[42%] shrink-0 bg-[#f7f8fa]">
                <ProductImage id={product.id} name={product.name} />
              </div>

              {/* Right — info */}
              <div className="flex-1 p-6 flex flex-col relative">
                {/* Close */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={14} />
                </button>

                {/* Category path */}
                {categoryPath && (
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-500 mb-2">
                    {categoryPath.split(" › ")[0]}
                  </p>
                )}

                {/* Product name */}
                <h2 className="font-display font-bold text-gray-900 text-xl leading-snug mb-4 pr-8">
                  {product.name}
                </h2>

                {/* Price */}
                <p className="text-3xl font-bold text-gray-900 mb-1">
                  {product.price != null
                    ? `$${Number(product.price).toFixed(2)}`
                    : <span className="text-gray-400 text-xl font-normal">Call for price</span>
                  }
                </p>

                {/* Availability */}
                <div className="flex items-center gap-1.5 mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-xs text-emerald-600 font-medium">In Stock</span>
                </div>

                {/* SKU */}
                {product.sku && (
                  <div className="flex items-center gap-1.5 mb-5 bg-gray-50 rounded-xl px-3 py-2.5">
                    <span className="text-[11px] text-gray-400 uppercase tracking-widest font-semibold">SKU</span>
                    <span className="font-mono text-[12px] text-gray-600 flex-1">{product.sku}</span>
                    <button
                      type="button"
                      onClick={handleCopySku}
                      className="text-gray-300 hover:text-gray-500 transition-colors ml-auto"
                      title="Copy SKU"
                    >
                      {copiedSku ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    </button>
                  </div>
                )}

                <div className="mt-auto space-y-2">
                  <Link
                    href={`/product/${product.id}`}
                    onClick={onClose}
                    className="flex items-center justify-center gap-1.5 w-full py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
                  >
                    View Full Details <ArrowRight size={14} />
                  </Link>
                  <button
                    onClick={onClose}
                    className="w-full py-2 text-gray-400 hover:text-gray-600 text-sm transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
