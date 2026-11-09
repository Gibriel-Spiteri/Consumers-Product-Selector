import type { MouseEvent } from "react";
import type { SpecialOrderProductLine } from "@workspace/api-client-react";
import { useVendorPicks } from "@/context/vendor-picks-context";
import { compareVersions } from "@/lib/quote-helper";
import { trackVendorSiteVisit } from "@/lib/analytics";

export function useVendorVisitLink(line: SpecialOrderProductLine) {
  const { extensionVersion } = useVendorPicks();
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.type === "auxclick" && event.button !== 1) return;
    const visitId = trackVendorSiteVisit(line);
    // Keep native anchor navigation. The new tab's relay can redirect itself if
    // the extension disappeared, without attempting a popup after an async call.
    // Middle/context-menu opens stay ordinary, unlinked vendor visits.
    if (event.type === "click" && visitId && line.websiteUrl
      && extensionVersion && compareVersions(extensionVersion, "1.6.0") >= 0) {
      const link = event.currentTarget;
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const data = new URLSearchParams({ visitId, websiteUrl: line.websiteUrl, productLineId: line.id });
      link.href = `${base}/vendor-open#${data}`;
      setTimeout(() => { link.href = line.websiteUrl!; }, 0);
    }
  };
}
