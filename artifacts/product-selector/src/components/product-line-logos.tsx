import { useState } from "react";
import type { SpecialOrderProductLine } from "@workspace/api-client-react";
import { ImageOff } from "lucide-react";

function ProductLineLogo({ line }: { line: SpecialOrderProductLine }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = !!line.logoUrl && failedUrl !== line.logoUrl;

  return (
    <figure className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col items-center gap-3">
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
    </figure>
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
