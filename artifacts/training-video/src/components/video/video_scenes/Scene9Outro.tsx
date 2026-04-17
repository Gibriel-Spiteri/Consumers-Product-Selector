import { motion } from "framer-motion";

export default function Scene9Outro() {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-[#1a2230] via-[#0f1620] to-[#0a0f17] flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative text-center text-white"
      >
        <div className="text-[13px] font-semibold uppercase tracking-[0.2em] opacity-70 mb-3">
          Consumers Product Selector
        </div>
        <h1 className="font-display text-[64px] font-extrabold leading-[1.05] mb-4">
          Happy quoting.
        </h1>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 120 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="h-[3px] bg-amber mx-auto mb-5"
        />
        <p className="text-[15px] opacity-80">Questions? Ping IT or your sales lead.</p>
      </motion.div>
    </div>
  );
}
