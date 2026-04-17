import { motion } from "framer-motion";
import AppFrame from "@/components/video/AppFrame";
import Cursor from "@/components/video/Cursor";

export default function Scene3Categories({ tMs }: { tMs: number }) {
  const showDropdown = tMs >= 1700;
  const hovered = tMs >= 4500 ? "Bath" : null;
  const drilled = tMs >= 9000;

  return (
    <AppFrame
      highlight="categories"
      showCategoryDropdown={showDropdown}
      hoveredTopCategory={hovered}
    >
      {/* faded page underneath */}
      <div className="absolute inset-0 px-12 pt-8">
        {drilled ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="opacity-100"
          >
            <div className="text-[12px] text-app-ink-soft mb-1.5">Categories / Bath / Vanities</div>
            <h1 className="font-display text-[30px] font-extrabold text-app-ink mb-4">
              Vanities
            </h1>
            <div className="grid grid-cols-4 gap-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.35 }}
                  className="bg-white rounded-lg shadow-sm border border-app-line p-3"
                >
                  <div className="aspect-[4/3] bg-app-bg rounded mb-2" />
                  <div className="h-3 bg-app-line/70 rounded mb-1.5 w-4/5" />
                  <div className="h-3 bg-app-line/40 rounded w-2/5" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <div className="opacity-30">
            <div className="text-[12px] text-app-ink-soft mb-1.5">Home</div>
            <div className="h-7 w-48 bg-app-line/60 rounded mb-5" />
            <div className="grid grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-lg border border-app-line p-3 h-44" />
              ))}
            </div>
          </div>
        )}
      </div>

      <Cursor
        sceneKey="scene3"
        steps={[
          { x: 50, y: 60, atMs: 0 },
          { x: 47, y: 7, atMs: 1300, durationMs: 800, click: true }, // hover Categories
          { x: 18, y: 30, atMs: 4400, durationMs: 800 },             // hover Bath
          { x: 38, y: 30, atMs: 8500, durationMs: 700, click: true }, // click Vanities
        ]}
      />
    </AppFrame>
  );
}
