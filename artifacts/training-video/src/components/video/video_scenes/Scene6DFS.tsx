import { motion } from "framer-motion";
import AppFrame from "@/components/video/AppFrame";
import Cursor from "@/components/video/Cursor";
import { dfs, dfsLocations } from "@/data/products";

export default function Scene6DFS({ tMs }: { tMs: number }) {
  const filterIdx = tMs >= 7000 ? 1 : 0; // switch from "All Locations" to "Mt. Pleasant"
  const filtered = filterIdx === 0 ? dfs : dfs.filter((p) => p.location === dfsLocations[filterIdx]);

  return (
    <AppFrame>
      <div className="absolute inset-0 overflow-hidden">
        <div className="px-12 pt-7 pb-3">
          <div className="flex items-center gap-3 mb-1">
            <span className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white rounded bg-amber">
              Displays For Sale
            </span>
            <span className="text-[12px] text-app-ink-soft">Showroom display models</span>
          </div>
          <h1 className="font-display text-[30px] font-extrabold text-app-ink">
            Displays For Sale
          </h1>
        </div>

        {/* location pills */}
        <div className="px-12 pb-5 flex gap-2">
          {dfsLocations.map((loc, i) => {
            const active = i === filterIdx;
            return (
              <motion.div
                key={loc}
                animate={{
                  backgroundColor: active ? "var(--color-amber)" : "rgba(0,0,0,0)",
                  color: active ? "#fff" : "var(--color-app-ink)",
                  borderColor: active ? "var(--color-amber)" : "var(--color-app-line)",
                }}
                transition={{ duration: 0.25 }}
                className="px-3.5 py-1.5 rounded-full border-2 text-[13px] font-semibold"
              >
                {loc}
              </motion.div>
            );
          })}
        </div>

        <div className="px-12 grid grid-cols-3 gap-5">
          {filtered.map((p, i) => (
            <motion.div
              key={p.sku}
              layout
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.07 * i, duration: 0.4 }}
              className="bg-white rounded-lg shadow-sm border border-app-line overflow-hidden"
            >
              <div className="relative aspect-[4/3] bg-app-bg overflow-hidden">
                <img
                  src={p.image}
                  alt={p.sku}
                  className="absolute inset-0 w-full h-full object-contain p-2"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-amber shadow">
                  {p.location}
                </div>
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
        sceneKey="scene6"
        steps={[
          { x: 75, y: 8, atMs: 0 },
          { x: 25, y: 32, atMs: 3500, durationMs: 900 },                    // hover all locations
          { x: 35, y: 32, atMs: 6700, durationMs: 600, click: true },       // click Mt Pleasant
          { x: 50, y: 65, atMs: 10000, durationMs: 1000 },
        ]}
      />
    </AppFrame>
  );
}
