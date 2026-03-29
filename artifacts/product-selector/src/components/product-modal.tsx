import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Tag, Barcode, DollarSign, ImageOff } from "lucide-react";

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
    : `https://picsum.photos/seed/product-${id}/600/360`;

  if (failed) {
    return (
      <div className="w-full h-48 bg-secondary flex flex-col items-center justify-center text-muted-foreground gap-2">
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
      className="w-full h-48 object-cover"
    />
  );
}

export default function ProductModal({ product, categoryPath, onClose }: ProductModalProps) {
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
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999]"
            onClick={onClose}
          />

          {/* Modal Card */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Product Image */}
              <div className="relative">
                <ProductImage id={product.id} name={product.name} />
                {/* Close button overlaid on image */}
                <button
                  onClick={onClose}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
                >
                  <X size={16} />
                </button>
                {/* Price badge overlaid on image */}
                {product.price != null && (
                  <div className="absolute bottom-3 right-3 bg-accent text-white font-bold text-lg px-3 py-1 rounded-lg shadow-lg">
                    ${Number(product.price).toFixed(2)}
                  </div>
                )}
              </div>

              {/* Header */}
              <div className="bg-primary px-6 py-4">
                <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-0.5">
                  Product Detail
                </p>
                <h2 className="text-white font-display font-bold text-xl uppercase leading-tight">
                  {product.name}
                </h2>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-3">

                {/* SKU + Price row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 bg-secondary/50 rounded-xl border border-border">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Barcode size={13} className="text-muted-foreground" />
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">SKU</p>
                    </div>
                    <p className="font-mono font-semibold text-foreground text-sm">
                      {product.sku || <span className="text-muted-foreground italic font-sans font-normal">—</span>}
                    </p>
                  </div>

                  <div className="p-3.5 bg-accent/5 rounded-xl border border-accent/20">
                    <div className="flex items-center gap-1.5 mb-1">
                      <DollarSign size={13} className="text-accent" />
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">MSRP</p>
                    </div>
                    <p className="font-bold text-accent text-lg">
                      {product.price != null
                        ? `$${Number(product.price).toFixed(2)}`
                        : <span className="text-muted-foreground italic font-normal text-sm">Call for price</span>
                      }
                    </p>
                  </div>
                </div>

                {/* Category Path */}
                {categoryPath && (
                  <div className="flex items-center gap-3 p-3.5 bg-secondary/50 rounded-xl border border-border">
                    <Tag size={15} className="text-primary shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Category</p>
                      <p className="text-sm font-medium text-foreground">{categoryPath}</p>
                    </div>
                  </div>
                )}

                {/* NetSuite ID */}
                {product.netsuiteId && (
                  <p className="text-xs text-muted-foreground px-1">
                    NetSuite ID: <span className="font-mono">{product.netsuiteId}</span>
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-6">
                <button
                  onClick={onClose}
                  className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-accent transition-colors text-sm uppercase tracking-wider"
                >
                  Close
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
