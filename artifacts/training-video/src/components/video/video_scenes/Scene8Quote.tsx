import { motion } from "framer-motion";
import AppFrame from "@/components/video/AppFrame";
import Cursor from "@/components/video/Cursor";
import { Trash2, Printer } from "lucide-react";
import { expressBath, ppr, featured } from "@/data/products";

const ROWS = [
  featured,
  expressBath[2],
  ppr[1],
  expressBath[5],
];

export default function Scene8Quote({ tMs }: { tMs: number }) {
  const visibleCount = Math.min(ROWS.length, 1 + Math.floor(tMs / 600));

  const subtotal = ROWS.slice(0, visibleCount).reduce((s, r) => s + r.price, 0);

  return (
    <AppFrame quoteCount={visibleCount} highlight="quote">
      <div className="absolute inset-0 overflow-hidden">
        <div className="px-12 pt-7 pb-4 flex items-end justify-between">
          <div>
            <div className="text-[12px] text-app-ink-soft mb-1">Customer quote</div>
            <h1 className="font-display text-[30px] font-extrabold text-app-ink">Quote List</h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="h-10 px-4 rounded-md border-2 border-app-line text-app-ink font-semibold text-[13px] flex items-center gap-2">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button className="h-10 px-4 rounded-md bg-app-ink text-white font-semibold text-[13px]">
              Send to customer
            </button>
          </div>
        </div>

        <div className="px-12">
          <div className="bg-white rounded-xl border border-app-line shadow-sm overflow-hidden">
            <div className="grid grid-cols-[80px_1fr_120px_100px_40px] gap-4 px-5 py-3 text-[11px] uppercase tracking-wider font-bold text-app-ink-soft border-b border-app-line bg-app-bg/50">
              <div>Image</div>
              <div>Item</div>
              <div className="text-right">Price</div>
              <div className="text-right">Qty</div>
              <div></div>
            </div>
            {ROWS.slice(0, visibleCount).map((r, i) => (
              <motion.div
                key={`${r.sku}-${i}`}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35 }}
                className="grid grid-cols-[80px_1fr_120px_100px_40px] gap-4 px-5 py-3 items-center border-b border-app-line last:border-b-0"
              >
                <div className="w-[60px] h-[45px] rounded bg-app-bg overflow-hidden relative">
                  <img
                    src={r.image}
                    className="absolute inset-0 w-full h-full object-contain p-1"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <div>
                  <div className="text-[11px] text-app-ink-soft uppercase tracking-wide truncate">{r.brand}</div>
                  <div className="text-[14px] font-semibold text-app-ink truncate">{r.name}</div>
                  <div className="text-[11px] font-mono text-app-ink-soft mt-0.5">{r.sku}</div>
                </div>
                <div className="text-right font-bold text-app-ink">${r.price.toFixed(2)}</div>
                <div className="text-right">
                  <div className="inline-flex items-center justify-center w-12 h-8 rounded border border-app-line text-[13px] font-semibold">
                    1
                  </div>
                </div>
                <div className="text-app-ink-soft hover:text-red-500 cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-5 flex justify-end">
            <div className="w-[280px] bg-white rounded-xl border border-app-line shadow-sm p-4">
              <div className="flex justify-between text-[13px] text-app-ink-soft mb-2">
                <span>Subtotal</span>
                <motion.span
                  key={visibleCount}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-semibold text-app-ink"
                >
                  ${subtotal.toFixed(2)}
                </motion.span>
              </div>
              <div className="flex justify-between text-[13px] text-app-ink-soft mb-2">
                <span>Tax (est.)</span>
                <span className="font-semibold text-app-ink">${(subtotal * 0.06).toFixed(2)}</span>
              </div>
              <div className="border-t border-app-line mt-2 pt-2 flex justify-between text-[15px] font-bold text-app-ink">
                <span>Total</span>
                <span>${(subtotal * 1.06).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Cursor
        sceneKey="scene8"
        steps={[
          { x: 80, y: 8, atMs: 0 },
          { x: 50, y: 50, atMs: 3000, durationMs: 1000 },
          { x: 90, y: 80, atMs: 7500, durationMs: 1100 },
          { x: 92, y: 13, atMs: 10000, durationMs: 700, click: true }, // print btn
        ]}
      />
    </AppFrame>
  );
}
