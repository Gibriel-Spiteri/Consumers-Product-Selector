import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import Cursor from "@/components/video/Cursor";

const EMAIL = "jbalogajr@consumersmail.com";

export default function Scene1Login({ tMs }: { tMs: number }) {
  const [typed, setTyped] = useState("");
  const [pwTyped, setPwTyped] = useState(0);

  useEffect(() => {
    if (tMs >= 1500 && tMs < 1500 + EMAIL.length * 60) {
      const i = Math.min(EMAIL.length, Math.floor((tMs - 1500) / 60));
      setTyped(EMAIL.slice(0, i));
    } else if (tMs >= 1500 + EMAIL.length * 60) {
      setTyped(EMAIL);
    }
    if (tMs >= 5400 && tMs < 5400 + 8 * 80) {
      setPwTyped(Math.min(8, Math.floor((tMs - 5400) / 80)));
    } else if (tMs >= 5400 + 8 * 80) {
      setPwTyped(8);
    }
  }, [tMs]);

  const submitted = tMs >= 7800;

  return (
    <div className="absolute inset-0 bg-gradient-to-br from-[#1a2230] via-[#0f1620] to-[#0a0f17] flex items-center justify-center overflow-hidden">
      {/* subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative w-[440px] bg-white rounded-2xl shadow-2xl px-9 pt-9 pb-8"
      >
        <div className="flex flex-col items-center mb-7">
          <div className="font-display font-extrabold tracking-tight text-[26px] text-app-ink">
            consumers
          </div>
          <div className="text-[13px] text-app-ink-soft mt-1">Product Selector</div>
        </div>
        <label className="block text-[12px] font-semibold text-app-ink-soft uppercase tracking-wide mb-1.5">
          Email
        </label>
        <div className="h-11 px-3 rounded-md border-2 border-app-line focus-within:border-app-ink flex items-center text-[15px] mb-4">
          {typed}
          <span className="inline-block w-[2px] h-5 bg-app-ink ml-px animate-pulse" />
        </div>
        <label className="block text-[12px] font-semibold text-app-ink-soft uppercase tracking-wide mb-1.5">
          Password
        </label>
        <div className="h-11 px-3 rounded-md border-2 border-app-line flex items-center text-[18px] tracking-[0.3em] text-app-ink mb-6">
          {"•".repeat(pwTyped)}
        </div>
        <motion.button
          animate={
            submitted
              ? { scale: [1, 0.97, 1], backgroundColor: "#1f2630" }
              : { scale: 1 }
          }
          transition={{ duration: 0.25 }}
          className="w-full h-11 rounded-md bg-app-ink text-white font-semibold text-[15px]"
        >
          {submitted ? "Signing in…" : "Sign in"}
        </motion.button>
      </motion.div>

      <Cursor
        sceneKey="scene1"
        steps={[
          { x: 50, y: 75, atMs: 0 },
          { x: 50, y: 41, atMs: 1100, durationMs: 700, click: true }, // click email field
          { x: 50, y: 56, atMs: 5000, durationMs: 700, click: true }, // click password
          { x: 50, y: 70, atMs: 7700, durationMs: 700, click: true }, // click sign in
        ]}
      />
    </div>
  );
}
