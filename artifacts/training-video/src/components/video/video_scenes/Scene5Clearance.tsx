import { motion } from "framer-motion";
import AppFrame from "@/components/video/AppFrame";
import Cursor from "@/components/video/Cursor";
import { ppr } from "@/data/products";

export default function Scene5Clearance() {
  // duplicate to get a fuller grid
  const items = [...ppr, ...ppr.slice(0, 3)].slice(0, 6);

  return (
    <AppFrame>
      <div className="absolute inset-0 overflow-hidden">
        <div className="px-12 pt-7 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white rounded bg-emerald">
              Clearance · PPR
            </span>
            <span className="text-[12px] text-app-ink-soft">Promotional pricing</span>
          </div>
          <h1 className="font-display text-[30px] font-extrabold text-app-ink">
            Clearance &amp; PPR
          </h1>
          <p className="text-[14px] text-app-ink-soft mt-1 max-w-[640px]">
            Items with active manufacturer promotions. Original retail is crossed out, the new
            selling price is highlighted, and the green pill names the promo.
          </p>
        </div>

        <div className="px-12 grid grid-cols-3 gap-6">
          {items.map((p, i) => (
            <motion.div
              key={`${p.sku}-${i}`}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.07 * i, duration: 0.45 }}
              className="bg-white rounded-lg shadow-sm border border-app-line overflow-hidden flex"
            >
              <div className="relative w-[42%] bg-app-bg shrink-0">
                <img
                  src={p.image}
                  alt={p.sku}
                  className="absolute inset-0 w-full h-full object-contain p-2"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div className="p-3.5 flex-1 flex flex-col">
                <div className="text-[11px] text-app-ink-soft uppercase tracking-wide truncate">{p.brand}</div>
                <div className="text-[13px] font-semibold text-app-ink leading-tight">{p.name}</div>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + 0.07 * i, duration: 0.35 }}
                  className="mt-2 inline-flex self-start px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-emerald"
                >
                  {p.pprName}
                </motion.div>

                <div className="mt-auto pt-3 flex items-baseline gap-2">
                  <span className="text-[12px] line-through text-app-ink-soft">
                    ${p.retailPrice?.toFixed(2)}
                  </span>
                  <span className="text-[18px] font-extrabold text-emerald">
                    ${p.price.toFixed(2)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <Cursor
        sceneKey="scene5"
        steps={[
          { x: 80, y: 8, atMs: 0 },
          { x: 30, y: 55, atMs: 3000, durationMs: 900 },  // hover first card price
          { x: 32, y: 60, atMs: 7000, durationMs: 600, click: true },
          { x: 70, y: 80, atMs: 10500, durationMs: 1000 },
        ]}
      />
    </AppFrame>
  );
}
