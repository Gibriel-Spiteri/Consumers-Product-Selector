import { motion, useAnimate } from "framer-motion";
import { useEffect } from "react";

export type CursorStep = {
  /** percent of stage width 0..100 */
  x: number;
  /** percent of stage height 0..100 */
  y: number;
  /** when (ms relative to scene start) to begin moving */
  atMs: number;
  /** if true, show a click ripple at this point */
  click?: boolean;
  /** how long the move takes */
  durationMs?: number;
};

type Props = {
  steps: CursorStep[];
  sceneKey: string | number;
};

export default function Cursor({ steps, sceneKey }: Props) {
  const [scope, animate] = useAnimate();
  const [rippleScope, animateRipple] = useAnimate();

  useEffect(() => {
    if (!steps.length) return;
    let cancelled = false;

    const run = async () => {
      // teleport to first step instantly
      const first = steps[0];
      await animate(scope.current, { left: `${first.x}%`, top: `${first.y}%` }, { duration: 0 });

      for (let i = 0; i < steps.length; i++) {
        if (cancelled) return;
        const s = steps[i];
        const prevAt = i === 0 ? 0 : steps[i - 1].atMs;
        const moveAt = s.atMs;
        const wait = Math.max(0, moveAt - prevAt - (steps[i - 1]?.durationMs ?? 0));
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (cancelled) return;

        if (i > 0) {
          await animate(
            scope.current,
            { left: `${s.x}%`, top: `${s.y}%` },
            { duration: (s.durationMs ?? 700) / 1000, ease: [0.22, 0.61, 0.36, 1] }
          );
        }

        if (s.click) {
          // ripple
          await animate(rippleScope.current, { left: `${s.x}%`, top: `${s.y}%` }, { duration: 0 });
          animateRipple(
            rippleScope.current,
            { scale: [0.4, 1.6], opacity: [0.65, 0] },
            { duration: 0.55, ease: "easeOut" }
          );
          // small cursor "press"
          animate(
            scope.current,
            { scale: [1, 0.85, 1] },
            { duration: 0.25, ease: "easeOut" }
          );
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  return (
    <>
      {/* click ripple */}
      <div
        ref={rippleScope}
        style={{ left: "50%", top: "50%" }}
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/80 ring-2 ring-app-ink opacity-0"
      />
      {/* cursor */}
      <motion.div
        ref={scope}
        className="pointer-events-none absolute -translate-x-[2px] -translate-y-[2px] z-50"
        style={{ left: "50%", top: "50%" }}
      >
        <svg width="22" height="26" viewBox="0 0 22 26" fill="none" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))" }}>
          <path d="M2 2 L2 22 L7.5 17 L11 25 L14.5 23.5 L11 15.5 L18 15.5 Z" fill="#fff" stroke="#111" strokeWidth="1.4" strokeLinejoin="round"/>
        </svg>
      </motion.div>
    </>
  );
}
