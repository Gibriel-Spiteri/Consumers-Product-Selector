import { motion, AnimatePresence } from "framer-motion";

type Props = {
  text: string;
  sceneKey: string | number;
};

export default function CaptionBar({ text, sceneKey }: Props) {
  return (
    <div className="absolute left-0 right-0 bottom-6 flex justify-center pointer-events-none z-40">
      <AnimatePresence>
        <motion.div
          key={sceneKey}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
          className="max-w-[85%] px-5 py-3 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-white text-[17px] leading-snug font-medium text-center shadow-2xl"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {text}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
