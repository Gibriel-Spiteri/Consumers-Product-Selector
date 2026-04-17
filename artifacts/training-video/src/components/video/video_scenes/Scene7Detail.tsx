import { motion, AnimatePresence } from "framer-motion";
import AppFrame from "@/components/video/AppFrame";
import Cursor from "@/components/video/Cursor";
import { Copy, Check, Plus } from "lucide-react";
import { featured } from "@/data/products";

export default function Scene7Detail({ tMs }: { tMs: number }) {
  const showCopied = tMs >= 7000 && tMs < 9500;
  const tab = tMs >= 10500 ? "specs" : "overview";

  return (
    <AppFrame quoteCount={0}>
      <div className="absolute inset-0 overflow-hidden">
        <div className="px-12 pt-5 text-[12px] text-app-ink-soft">
          Categories / Bath / Vanities / {featured.sku}
        </div>

        <div className="px-12 pt-3 grid grid-cols-[1.05fr_1fr] gap-10 items-start">
          {/* image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="bg-white rounded-xl border border-app-line aspect-[4/3] relative overflow-hidden shadow-sm"
          >
            <img
              src={featured.image}
              alt={featured.sku}
              className="absolute inset-0 w-full h-full object-contain p-6"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </motion.div>

          {/* details */}
          <div>
            <div className="text-[12px] uppercase tracking-wider text-app-ink-soft font-semibold">
              {featured.brand}
            </div>
            <h1 className="font-display text-[26px] font-extrabold text-app-ink mt-1 leading-tight">
              {featured.name}
            </h1>

            {/* SKU row with copy */}
            <div className="mt-3 flex items-center gap-2">
              <div className="px-2.5 py-1.5 rounded-md bg-app-bg border border-app-line text-[13px] font-mono text-app-ink">
                {featured.sku}
              </div>
              <motion.button
                animate={showCopied ? { scale: [1, 0.9, 1] } : {}}
                transition={{ duration: 0.25 }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-semibold border-2 transition ${
                  showCopied
                    ? "bg-emerald text-white border-emerald"
                    : "border-app-line text-app-ink hover:bg-app-bg"
                }`}
              >
                {showCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy SKU
                  </>
                )}
              </motion.button>
            </div>

            {/* prices */}
            <div className="mt-4 flex items-baseline gap-3">
              <div className="text-[28px] font-extrabold text-app-ink">
                ${featured.price.toFixed(2)}
              </div>
              <div className="text-[14px] line-through text-app-ink-soft">
                ${featured.retailPrice?.toFixed(2)}
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-soft text-emerald text-[11px] font-bold">
                Save 24%
              </span>
            </div>

            {/* tabs */}
            <div className="mt-5 flex border-b border-app-line">
              {["overview", "specs", "notes"].map((t) => (
                <div
                  key={t}
                  className={`px-3.5 py-2 text-[13px] font-semibold capitalize relative cursor-pointer ${
                    tab === t ? "text-app-ink" : "text-app-ink-soft"
                  }`}
                >
                  {t}
                  {tab === t && (
                    <motion.div
                      layoutId="tab-underline"
                      className="absolute left-0 right-0 -bottom-px h-[2px] bg-app-ink"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 text-[13.5px] leading-relaxed text-app-ink-soft min-h-[80px]">
              <AnimatePresence>
                {tab === "overview" && (
                  <motion.p
                    key="ov"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    {featured.description}
                  </motion.p>
                )}
                {tab === "specs" && (
                  <motion.ul
                    key="sp"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-1.5"
                  >
                    <li>• Material: Engineered quartz</li>
                    <li>• Width: 25"  · Depth: 22"</li>
                    <li>• Faucet hole: Single, pre-drilled</li>
                    <li>• Backsplash included</li>
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            <button className="mt-5 inline-flex items-center gap-2 h-11 px-5 rounded-md bg-app-ink text-white font-semibold text-[14px]">
              <Plus className="w-4 h-4" /> Add to Quote
            </button>
          </div>
        </div>
      </div>

      <Cursor
        sceneKey="scene7"
        steps={[
          { x: 75, y: 8, atMs: 0 },
          { x: 30, y: 50, atMs: 1500, durationMs: 800 },                  // image
          { x: 65, y: 36, atMs: 5500, durationMs: 900 },                  // SKU
          { x: 71, y: 36, atMs: 6900, durationMs: 350, click: true },     // copy click
          { x: 64, y: 60, atMs: 10300, durationMs: 700, click: true },    // tab specs
        ]}
      />
    </AppFrame>
  );
}
