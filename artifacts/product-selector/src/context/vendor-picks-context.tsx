import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useGetSpecialOrderProductLines, getGetSpecialOrderProductLinesQueryKey } from "@workspace/api-client-react";
import { specialOrderLookupRetry } from "@/lib/special-order-query";
import { FROM_EXTENSION, parsePicksMessage, postToExtension, vendorSites, type VendorPick } from "@/lib/vendor-picks";

interface VendorPicksContextType {
  extensionReady: boolean;
  picks: VendorPick[];
  // Tells the extension the pick is finished (added to the quote list) or removed.
  done: (id: string) => void;
}

const VendorPicksContext = createContext<VendorPicksContextType>({ extensionReady: false, picks: [], done: () => {} });

// Bridge to the Consumers Quote Helper extension (when it is installed in this browser).
export function VendorPicksProvider({ children }: { children: ReactNode }) {
  const [extensionReady, setExtensionReady] = useState(false);
  const [picks, setPicks] = useState<VendorPick[]>([]);
  const lines = useGetSpecialOrderProductLines({
    query: { queryKey: getGetSpecialOrderProductLinesQueryKey(), enabled: extensionReady, ...specialOrderLookupRetry },
  });

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; type?: string } | null;
      if (data?.source !== FROM_EXTENSION) return;
      if (data.type === "extension-ready") setExtensionReady(true);
      const next = parsePicksMessage(data);
      if (next) {
        setExtensionReady(true);
        setPicks(next);
      }
    };
    window.addEventListener("message", onMessage);
    postToExtension("request-picks");
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Keep the extension's vendor list in step with NetSuite's product lines (it only runs on these websites).
  useEffect(() => {
    if (extensionReady && lines.data?.length) postToExtension("vendor-sites", { sites: vendorSites(lines.data) });
  }, [extensionReady, lines.data]);

  const done = useCallback((id: string) => {
    setPicks(prev => prev.filter(p => p.id !== id));
    postToExtension("pick-done", { id });
  }, []);

  return <VendorPicksContext.Provider value={{ extensionReady, picks, done }}>{children}</VendorPicksContext.Provider>;
}

export function useVendorPicks() {
  return useContext(VendorPicksContext);
}
