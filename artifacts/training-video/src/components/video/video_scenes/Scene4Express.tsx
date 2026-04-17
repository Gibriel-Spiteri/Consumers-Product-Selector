import { motion } from "framer-motion";
import AppFrame from "@/components/video/AppFrame";
import Cursor from "@/components/video/Cursor";
import { expressBath } from "@/data/products";

export default function Scene4Express() {
  return (
    <AppFrame>
      <div className="absolute inset-0 overflow-hidden">
        {/* page header */}
        <div className="px-12 pt-7 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white rounded bg-blue">
              Express Bath
            </span>
            <span className="text-[12px] text-app-ink-soft">In stock · ready to ship</span>
          </div>
          <h1 className="font-display text-[30px] font-extrabold text-app-ink">
            Express Bath
          </h1>
          <p className="text-[14px] text-app-ink-soft mt-1 max-w-[640px]">
            Vanities, tops, and bowls we keep on hand for fast turnaround. The blue badge on each
            tile shows what's available right now.
          </p>
        </div>

        {/* grid */}
        <div className="px-12 grid grid-cols-4 gap-5">
          {expressBath.slice(0, 8).map((p, i) => (
            <motion.div
              key={p.sku}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.45 }}
              className="bg-white rounded-lg shadow-sm border border-app-line overflow-hidden flex flex-col"
            >
              <div className="relative aspect-[4/3] bg-app-bg overflow-hidden">
                <img
                  src={p.image}
                  alt={p.sku}
                  className="absolute inset-0 w-full h-full object-contain p-2"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4 + 0.06 * i, duration: 0.35, ease: "backOut" }}
                  className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-blue shadow"
                >
                  IN STOCK · {3 + ((i * 7) % 11)}
                </motion.div>
              </div>
              <div className="p-3">
                <div className="text-[11px] text-app-ink-soft uppercase tracking-wide truncate">{p.brand}</div>
                <div className="text-[13px] font-semibold text-app-ink truncate">{p.name}</div>
                <div className="text-[15px] font-bold text-app-ink mt-1">${p.price.toFixed(2)}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <Cursor
        sceneKey="scene4"
        steps={[
          { x: 75, y: 8, atMs: 0 },
          { x: 25, y: 55, atMs: 2000, durationMs: 900 }, // first card
          { x: 75, y: 78, atMs: 7500, durationMs: 1100 }, // last card
        ]}
      />
    </AppFrame>
  );
}
