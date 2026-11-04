import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSpecialOrderProductLines, getGetSpecialOrderProductLinesQueryKey, getSpecialOrderTypes, getGetSpecialOrderTypesQueryKey,
} from "@workspace/api-client-react";
import { specialOrderLookupRetry } from "@/lib/special-order-query";
import { useQuoteList } from "@/context/quote-list-context";
import {
  FROM_EXTENSION, parsePicksMessage, postToExtension, productLineForPick, quoteInputFromPick, vendorSites, type VendorPick,
} from "@/lib/vendor-picks";
import { cleanVersion } from "@/lib/quote-helper";

interface VendorPicksContextType {
  extensionReady: boolean;
  // The extension's version in this browser ("1.2.0"), when it said so.
  extensionVersion: string | null;
  picks: VendorPick[];
  // Tells the extension the pick is finished (added to the quote list) or removed.
  done: (id: string) => void;
}

const VendorPicksContext = createContext<VendorPicksContextType>({ extensionReady: false, extensionVersion: null, picks: [], done: () => {} });

// Bridge to the Consumers Quote Helper extension (when it is installed in this browser).
export function VendorPicksProvider({ children }: { children: ReactNode }) {
  const [extensionReady, setExtensionReady] = useState(false);
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [picks, setPicks] = useState<VendorPick[]>([]);
  const lines = useGetSpecialOrderProductLines({
    query: { queryKey: getGetSpecialOrderProductLinesQueryKey(), enabled: extensionReady, ...specialOrderLookupRetry },
  });

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const data = event.data as { source?: string; type?: string; version?: unknown } | null;
      if (data?.source !== FROM_EXTENSION) return;
      // if (data.type === "extension-ready") setExtensionReady(true);
      if (data.type === "extension-ready") {
        setExtensionReady(true);
        setExtensionVersion(cleanVersion(data.version));
      }
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

  // 2026-11-04 (Gib): picks go straight onto the quote list, with the Type suggested from the product name. A pick
  // whose vendor site has several product lines (Foremost) or none waits on the Special Order page for the rep.
  const { addSpecialOrder } = useQuoteList();
  const queryClient = useQueryClient();
  const taken = useRef(new Set<string>());
  useEffect(() => {
    const all = lines.data;
    if (!all?.length) return;
    for (const pick of picks) {
      if (taken.current.has(pick.id)) continue;
      // const candidates = productLinesForPick(pick, all);
      // if (candidates.length !== 1) continue;
      // The line chosen in the extension (Foremost has several on one site), else the site's only line.
      const line = productLineForPick(pick, all);
      if (!line) continue;
      taken.current.add(pick.id);
      // The product lines carry their Types since 11/4; older cached answers fall back to the per-line call.
      if (line.types?.length) {
        addSpecialOrder(quoteInputFromPick(pick, line, line.types));
        done(pick.id);
        continue;
      }
      queryClient
        .fetchQuery({
          queryKey: getGetSpecialOrderTypesQueryKey(line.id),
          queryFn: () => getSpecialOrderTypes(line.id),
          staleTime: 5 * 60 * 1000,
        })
        .catch(() => []) // no Types right now: the line is added without one and the rep picks it
        .then(types => {
          addSpecialOrder(quoteInputFromPick(pick, line, types ?? []));
          done(pick.id);
        });
    }
  }, [picks, lines.data, addSpecialOrder, done, queryClient]);
  const waiting = picks.filter(p => !taken.current.has(p.id));

  // return <VendorPicksContext.Provider value={{ extensionReady, extensionVersion, picks, done }}>{children}</VendorPicksContext.Provider>;
  // Only the picks the rep still has to place (the ones going onto the quote list are not shown or counted).
  return <VendorPicksContext.Provider value={{ extensionReady, extensionVersion, picks: waiting, done }}>{children}</VendorPicksContext.Provider>;
}

export function useVendorPicks() {
  return useContext(VendorPicksContext);
}
