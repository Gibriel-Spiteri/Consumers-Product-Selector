import { useEffect, useRef } from "react";
import { FROM_EXTENSION, postToExtension } from "@/lib/vendor-picks";

/** A native target=_blank anchor opens this tab. Both paths reuse this tab:
 * the extension navigates it and records an explicit visit, or it redirects
 * itself without provenance. No asynchronous window.open or cancelled links.
 */
export default function VendorOpenPage() {
  const started = useRef(false);
  const params = new URLSearchParams(window.location.hash.slice(1));
  let websiteUrl = "";
  try {
    const url = new URL(params.get("websiteUrl") ?? "");
    if (/^https?:$/.test(url.protocol) && !url.username && !url.password) websiteUrl = url.href;
  } catch { /* An invalid target is never navigated. */ }
  const visitId = params.get("visitId") ?? "";
  const productLineId = params.get("productLineId") ?? "";
  useEffect(() => {
    if (!websiteUrl) return;
    const fallback = () => window.location.replace(websiteUrl);
    const timer = setTimeout(fallback, 2000);
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.source === FROM_EXTENSION && event.data.type === "vendor-open-result"
        && event.data.visitId === visitId && event.data.ok !== true) {
        clearTimeout(timer);
        fallback();
      }
    };
    window.addEventListener("message", onMessage);
    if (!started.current) {
      started.current = true;
      postToExtension("open-vendor", { visitId, websiteUrl, productLineId });
    }
    return () => {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [websiteUrl, visitId, productLineId]);
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      <div className="text-center space-y-3">
        <h1 className="text-lg font-semibold">{websiteUrl ? "Opening vendor website…" : "Invalid vendor website"}</h1>
        {websiteUrl && <a href={websiteUrl} rel="noreferrer" className="text-sm text-blue-700 underline">Continue to vendor website</a>}
      </div>
    </main>
  );
}
