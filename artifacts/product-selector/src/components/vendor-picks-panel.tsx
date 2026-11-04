import { ExternalLink, ImageOff, Plus, X } from "lucide-react";
import { useState } from "react";
import { useVendorPicks } from "@/context/vendor-picks-context";
import type { VendorPick } from "@/lib/vendor-picks";
import { fmtPrice } from "@/lib/utils";

function PickImage({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <ImageOff size={18} className="text-gray-300" />;
  return <img src={src} alt={name} onError={() => setFailed(true)} className="w-full h-full object-contain" />;
}

// Products customers added on vendor websites with the Consumers Quote Helper extension, waiting for the rep.
export default function VendorPicksPanel({ activeId, onUse }: { activeId: string | null; onUse: (pick: VendorPick) => void }) {
  const { picks, done } = useVendorPicks();
  if (picks.length === 0) return null;
  return (
    <section aria-label="Picked on vendor websites" className="mb-6 rounded-2xl border border-blue-200 bg-blue-50/60 p-4" data-testid="panel-vendor-picks">
      <h2 className="text-sm font-semibold text-gray-800 mb-1">Picked on vendor websites ({picks.length})</h2>
      {/* <p className="text-[12px] text-gray-500 mb-3">Use a pick to fill in the form below, choose its Type, check the list price, then add it to the quote list.</p> */}
      <p className="text-[12px] text-gray-500 mb-3">
        Picks go straight to the quote list when their vendor site belongs to one product line. These could not: their
        site has several product lines, or none. Use a pick to fill in the form below, choose the product line and Type,
        check the list price, then add it to the quote list.
      </p>
      <ul className="grid gap-2">
        {picks.map(pick => (
          <li key={pick.id} className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-2 ${activeId === pick.id ? "border-blue-400 ring-1 ring-blue-300" : "border-gray-200"}`}>
            <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
              <PickImage src={pick.imageUrl} name={pick.name} />
            </div>
            <div className="min-w-0 flex-1 text-[13px]">
              <p className="font-medium text-gray-900 truncate">{pick.name || pick.model}</p>
              <p className="text-gray-500 truncate">
                {[pick.model, pick.color].filter(Boolean).join(", ")}
                {pick.price != null ? ` - $${fmtPrice(pick.price)}` : ""} x {pick.quantity}
                {" - "}
                <a href={pick.pageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline">
                  {pick.vendorDomain} <ExternalLink size={10} aria-hidden="true" />
                </a>
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUse(pick)}
              className="flex items-center gap-1 px-3 py-2 text-[13px] font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-700"
              data-testid={`button-use-pick-${pick.id}`}
            >
              <Plus size={13} /> Use
            </button>
            <button
              type="button"
              onClick={() => done(pick.id)}
              aria-label={`Remove ${pick.name || pick.model}`}
              title="Remove"
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
              data-testid={`button-remove-pick-${pick.id}`}
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
