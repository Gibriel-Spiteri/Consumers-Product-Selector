import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface PprPriceTooltipProps {
  price: number;
  pprPriceReductionRetail: number | null | undefined;
  hasActivePpr: boolean;
  children: React.ReactNode;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PprPriceTooltip({ price, pprPriceReductionRetail, hasActivePpr, children }: PprPriceTooltipProps) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0, position: "bottom" as "bottom" | "top" });

  const handleEnter = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const goUp = rect.bottom + 100 > window.innerHeight;
    setCoords({
      x: rect.left + rect.width / 2,
      y: goUp ? rect.top : rect.bottom,
      position: goUp ? "top" : "bottom",
    });
    setShow(true);
  }, []);

  if (!hasActivePpr || !pprPriceReductionRetail) {
    return <>{children}</>;
  }

  const consumersPrice = price + pprPriceReductionRetail;
  const youSave = pprPriceReductionRetail;

  return (
    <div
      ref={ref}
      className="inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && createPortal(
        <div
          style={{
            position: "fixed",
            left: coords.x,
            top: coords.position === "bottom" ? coords.y + 8 : undefined,
            bottom: coords.position === "top" ? window.innerHeight - coords.y + 8 : undefined,
            transform: "translateX(-50%)",
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          <div className="bg-gray-900 text-white rounded-lg shadow-xl px-4 py-3 whitespace-nowrap text-sm relative">
            <div
              className="absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"
              style={coords.position === "bottom" ? { top: -4 } : { bottom: -4 }}
            />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Consumers Price</span>
                <span className="font-semibold">${fmt(consumersPrice)}</span>
              </div>
              <div className="border-t border-gray-700" />
              <div className="flex items-center justify-between gap-4">
                <span className="text-emerald-400 text-xs uppercase tracking-wider font-semibold">You Save</span>
                <span className="font-semibold text-emerald-400">${fmt(youSave)}</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
