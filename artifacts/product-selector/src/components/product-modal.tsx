import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ImageOff, Copy, Check, Tag } from "lucide-react";

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
      <div className="w-full h-full bg-secondary flex flex-col items-center justify-center text-muted-foreground gap-2">
        <ImageOff size={28} />
        <span className="text-xs">No image available</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => useCustom ? setFallback(true) : setFailed(true)}
      className="w-full h-full object-contain p-4"
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
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999]"
            onClick={onClose}
          />

          {/* Modal Card */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto overflow-hidden flex"
              onClick={e => e.stopPropagation()}
            >
              {/* Left — image panel */}
              <div className="w-[42%] shrink-0 bg-[#f3f4f6] relative">
                <ProductImage id={product.id} name={product.name} />
              </div>

              {/* Right — product info */}
              <div className="flex-1 p-7 flex flex-col relative">
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 w-7 h-7 rounded-full bg-secondary hover:bg-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>

                {/* SKU */}
                <div className="flex items-center gap-2 mb-2">
                  {product.sku ? (
                    <>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                        SKU: {product.sku}
                      </p>
                      <button
                        type="button"
                        onClick={handleCopySku}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy model number"
                      >
                        {copiedSku ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                      </button>
                    </>
                  ) : (
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">No SKU</p>
                  )}
                </div>

                {/* Product name */}
                <h2 className="font-display font-bold text-foreground text-xl leading-snug mb-3 pr-6">
                  {product.name}
                </h2>

                {/* Category path */}
                {categoryPath && (
                  <p className="text-sm text-muted-foreground mb-5 flex items-center gap-1.5">
                    <Tag size={12} className="shrink-0" />
                    {categoryPath}
                  </p>
                )}

                {/* Price */}
                <p className="text-3xl font-bold text-foreground mb-6">
                  {product.price != null
                    ? `$${Number(product.price).toFixed(2)}`
                    : <span className="text-muted-foreground text-xl font-normal italic">Call for price</span>
                  }
                </p>

                <div className="mt-auto space-y-2">
                  {/* NetSuite ID */}
                  {product.netsuiteId && (
                    <p className="text-[11px] text-muted-foreground">
                      NetSuite ID: <span className="font-mono">{product.netsuiteId}</span>
                    </p>
                  )}

                  {/* Close / dismiss */}
                  <button
                    onClick={onClose}
                    className="w-full py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors text-sm"
                  >
                    Close
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
