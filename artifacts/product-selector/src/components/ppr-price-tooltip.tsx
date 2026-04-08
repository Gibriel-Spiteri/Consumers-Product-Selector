import { useState, useRef, useEffect } from "react";

interface PprPriceTooltipProps {
  price: number;
  pprPriceReductionRetail: number | null | undefined;
  hasActivePpr: boolean;
  children: React.ReactNode;
}

export function PprPriceTooltip({ price, pprPriceReductionRetail, hasActivePpr, children }: PprPriceTooltipProps) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<"bottom" | "top">("bottom");

  useEffect(() => {
    if (show && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      if (rect.bottom + 100 > window.innerHeight) {
        setPosition("top");
      } else {
        setPosition("bottom");
      }
    }
  }, [show]);

  if (!hasActivePpr || !pprPriceReductionRetail) {
    return <>{children}</>;
  }

  const consumersPrice = price + pprPriceReductionRetail;
  const youSave = pprPriceReductionRetail;

  return (
    <div
      ref={ref}
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className={`absolute z-[100] left-1/2 -translate-x-1/2 ${
            position === "bottom" ? "top-full mt-2" : "bottom-full mb-2"
          }`}
        >
          <div className="bg-gray-900 text-white rounded-lg shadow-xl px-4 py-3 whitespace-nowrap text-sm">
            <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 ${
              position === "bottom" ? "-top-1" : "-bottom-1"
            }`} />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Consumers Price</span>
                <span className="font-semibold">${consumersPrice.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-700" />
              <div className="flex items-center justify-between gap-4">
                <span className="text-emerald-400 text-xs uppercase tracking-wider font-semibold">You Save</span>
                <span className="font-semibold text-emerald-400">${youSave.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
