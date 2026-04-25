import { useEffect, useRef } from "react";
import { trackProductView } from "@/lib/analytics";

const VISIBILITY_THRESHOLD = 0.5;
const DWELL_MS = 400;

export function useProductImpression<T extends HTMLElement>(
  productId: number | null | undefined,
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!productId || !Number.isFinite(productId)) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    let dwellTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.isIntersecting && entry.intersectionRatio >= VISIBILITY_THRESHOLD) {
          if (dwellTimer) return;
          dwellTimer = setTimeout(() => {
            dwellTimer = null;
            trackProductView(productId);
            observer.disconnect();
          }, DWELL_MS);
        } else if (dwellTimer) {
          clearTimeout(dwellTimer);
          dwellTimer = null;
        }
      },
      { threshold: [0, VISIBILITY_THRESHOLD, 1] },
    );

    observer.observe(el);
    return () => {
      if (dwellTimer) clearTimeout(dwellTimer);
      observer.disconnect();
    };
  }, [productId]);

  return ref;
}
