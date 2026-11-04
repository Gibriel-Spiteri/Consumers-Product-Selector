import { useState } from "react";
import type { SpecialOrderProductLine } from "@workspace/api-client-react";
import { ExternalLink, ImageOff } from "lucide-react";

function ProductLineLogo({ line }: { line: SpecialOrderProductLine }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = !!line.logoUrl && failedUrl !== line.logoUrl;

  // 2026-11-04: a card with a vendor website (the PRD page's link) opens it, where the Consumers Quote Helper
  // extension lets the customer add products to the quote. Was a plain card:
  // return (
  //   <figure className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col items-center gap-3">
  const card = (
    <figure className={`h-full rounded-xl border border-gray-200 bg-white p-4 flex flex-col items-center gap-3${line.websiteUrl ? " transition-shadow group-hover:shadow-md group-hover:border-gray-300" : ""}`}>
      <div className="h-20 w-full flex items-center justify-center">
        {showImage ? (
          <img
            src={line.logoUrl!}
            alt={`${line.name} logo`}
            loading="lazy"
            className="max-h-full max-w-full object-contain"
            onError={() => setFailedUrl(line.logoUrl!)}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-400 text-[11px]">
            <ImageOff size={22} />
            <span>{line.logoUrl ? "Logo unavailable" : "No logo"}</span>
          </div>
        )}
      </div>
      <figcaption className="text-center text-[12px] font-medium text-gray-700">{line.name}</figcaption>
      {line.websiteUrl && (
        <span className="flex items-center gap-1 text-[11px] font-semibold text-[#7B4DA8]">
          Shop vendor site <ExternalLink size={11} aria-hidden="true" />
        </span>
      )}
    </figure>
  );
  if (!line.websiteUrl) return card;
  return (
    <a
      href={line.websiteUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B4DA8] focus-visible:ring-offset-2"
      aria-label={`Open the ${line.name} website in a new tab`}
      data-testid={`link-vendor-site-${line.id}`}
    >
      {card}
    </a>
  );
}

export default function ProductLineLogos({ lines }: { lines: SpecialOrderProductLine[] }) {
  const productLines = Array.from(new Map(lines.map(line => [line.id, line])).values());
  return (
    <section aria-label="Product lines in selected category" className="mb-6">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-3">Product Lines</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {productLines.map(line => <ProductLineLogo key={line.id} line={line} />)}
      </div>
    </section>
  );
}
