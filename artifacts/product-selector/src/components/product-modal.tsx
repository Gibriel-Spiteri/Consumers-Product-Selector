import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Tag, Barcode, DollarSign, Package } from "lucide-react";

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

export default function ProductModal({ product, categoryPath, onClose }: ProductModalProps) {
  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [product, onClose]);

  return (
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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal Card */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-primary px-6 py-5 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <Package size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-0.5">
                      Product Detail
                    </p>
                    <h2 className="text-white font-display font-bold text-xl uppercase leading-tight">
                      {product.name}
                    </h2>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition-colors shrink-0 mt-0.5"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-6 space-y-4">

                {/* SKU */}
                <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-xl border border-border">
                  <div className="w-9 h-9 rounded-lg bg-white border border-border flex items-center justify-center shrink-0">
                    <Barcode size={18} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Item SKU</p>
                    <p className="font-mono font-semibold text-foreground text-base">
                      {product.sku || <span className="text-muted-foreground italic font-sans font-normal text-sm">Not assigned</span>}
                    </p>
                  </div>
                </div>

                {/* Price */}
                <div className="flex items-center gap-4 p-4 bg-accent/5 rounded-xl border border-accent/20">
                  <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                    <DollarSign size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">MSRP Price</p>
                    <p className="font-bold text-accent text-2xl">
                      {product.price != null
                        ? `$${Number(product.price).toFixed(2)}`
                        : <span className="text-muted-foreground italic font-normal text-base">Call for price</span>
                      }
                    </p>
                  </div>
                </div>

                {/* Category Path */}
                {categoryPath && (
                  <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-xl border border-border">
                    <div className="w-9 h-9 rounded-lg bg-white border border-border flex items-center justify-center shrink-0">
                      <Tag size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Category</p>
                      <p className="text-sm font-medium text-foreground">{categoryPath}</p>
                    </div>
                  </div>
                )}

                {/* NetSuite ID */}
                {product.netsuiteId && (
                  <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-secondary/30 border border-border/60">
                    <p className="text-xs text-muted-foreground font-medium">
                      NetSuite ID: <span className="font-mono">{product.netsuiteId}</span>
                    </p>
                  </div>
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
    </AnimatePresence>
  );
}
