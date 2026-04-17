import { motion } from "framer-motion";
import AppFrame from "@/components/video/AppFrame";
import Cursor from "@/components/video/Cursor";
import { ArrowRight } from "lucide-react";

export default function Scene2Home() {
  return (
    <AppFrame quoteCount={0}>
      <div className="absolute inset-0">
        {/* hero */}
        <div className="relative h-[58%] overflow-hidden">
          <motion.div
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 8, ease: "linear" }}
            className="absolute inset-0 bg-gradient-to-br from-[#3b5266] via-[#5d7588] to-[#a3b3c1]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
          <div className="relative h-full px-12 flex flex-col justify-end pb-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.7 }}
              className="text-white max-w-[600px]"
            >
              <div className="text-[13px] font-semibold uppercase tracking-[0.18em] opacity-80 mb-3">
                Welcome back, Jacob
              </div>
              <h1 className="font-display text-[44px] leading-[1.05] font-extrabold mb-3">
                Build a quote in minutes.
              </h1>
              <p className="text-[16px] opacity-90 max-w-[420px]">
                Browse every category, hunt deals in Clearance, and pin your favorites to a quote
                you can send straight to the customer.
              </p>
            </motion.div>
          </div>
        </div>

        {/* shortcut tiles */}
        <div className="absolute left-12 right-12 bottom-10 grid grid-cols-3 gap-5">
          {[
            { title: "Express Bath", body: "In-stock vanities & bowls", color: "blue" },
            { title: "Clearance & PPR", body: "Promotional pricing", color: "emerald" },
            { title: "Displays For Sale", body: "Showroom display stock", color: "amber" },
          ].map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.12, duration: 0.5 }}
              className="bg-white rounded-xl shadow-lg p-5 flex flex-col gap-2"
            >
              <div
                className="w-10 h-10 rounded-md"
                style={{
                  background: `var(--color-${c.color}-soft)`,
                  border: `1.5px solid var(--color-${c.color})`,
                }}
              />
              <div className="font-display font-bold text-[18px] text-app-ink">{c.title}</div>
              <div className="text-[13px] text-app-ink-soft">{c.body}</div>
              <div
                className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold"
                style={{ color: `var(--color-${c.color})` }}
              >
                Open <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <Cursor
        sceneKey="scene2"
        steps={[
          { x: 70, y: 8, atMs: 0 },
          { x: 38, y: 50, atMs: 2500, durationMs: 1000 },
          { x: 78, y: 50, atMs: 6000, durationMs: 1100 },
        ]}
      />
    </AppFrame>
  );
}
