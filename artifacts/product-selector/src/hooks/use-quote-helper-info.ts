import { useQuery } from "@tanstack/react-query";
import { authHeaders } from "@/context/auth-context";
import { QUOTE_HELPER_INFO_URL, type QuoteHelperInfo } from "@/lib/quote-helper";

// The Quote Helper version this server offers for download (signed-in staff only).
export function useQuoteHelperInfo() {
  return useQuery<QuoteHelperInfo>({
    queryKey: ["quoteHelperInfo"],
    queryFn: async () => {
      const res = await fetch(QUOTE_HELPER_INFO_URL, { headers: authHeaders() });
      if (!res.ok) throw new Error(`Quote Helper info: ${res.status}`);
      return res.json();
    },
  });
}
