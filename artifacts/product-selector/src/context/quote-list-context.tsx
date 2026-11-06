import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { trackAddToList, trackSpecialOrderAdd } from "@/lib/analytics";
import type { SpecialOrderDetails } from "@workspace/api-client-react";
import type { VendorPickSource } from "@/lib/vendor-picks";

// Which selling price the quote list shows for a special order. Display only: the push prices by the
// estimate customer's category, as NetSuite does.
export type PriceBasis = "retail" | "crd";

export interface QuoteItem {
  productId: number;
  netsuiteId: string;
  name: string;
  sku: string | null;
  price: number | null;
  imageUrl: string | null;
  quantity: number;
  specialOrder?: SpecialOrderDetails;
  priceBasis?: PriceBasis; // special orders only; missing on older saved lists = retail
  vendorPick?: VendorPickSource; // special orders added from a vendor website (Consumers Quote Helper)
}

export interface SpecialOrderInput {
  netsuiteId: string;
  sku: string | null;
  quantity: number;
  details: SpecialOrderDetails;
  priceBasis: PriceBasis;
  vendorPick?: VendorPickSource;
}

interface QuoteListContextType {
  items: QuoteItem[];
  addItem: (item: Omit<QuoteItem, "quantity">, qty?: number) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, qty: number) => void;
  clearList: () => void;
  addSpecialOrder: (input: SpecialOrderInput) => void;
  updateSpecialOrder: (productId: number, input: SpecialOrderInput) => void;
  removeExactItems: (snapshot: QuoteItem[]) => void;
  isInList: (productId: number) => boolean;
  getQuantity: (productId: number) => number;
  totalItems: number;
  totalLineItems: number;
  grandTotal: number;
}

const QuoteListContext = createContext<QuoteListContextType | null>(null);

const STORAGE_KEY = "quote-list";

function loadFromStorage(): QuoteItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

function saveToStorage(items: QuoteItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

function toSpecialItem(productId: number, input: SpecialOrderInput): QuoteItem {
  const d = input.details;
  return {
    productId,
    netsuiteId: input.netsuiteId,
    name: `${d.productLineName} Special Order`,
    sku: input.sku,
    price: null,
    imageUrl: null,
    quantity: input.quantity,
    specialOrder: { ...d },
    priceBasis: input.priceBasis,
    ...(input.vendorPick ? { vendorPick: { ...input.vendorPick } } : {}),
  };
}

export function QuoteListProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<QuoteItem[]>(loadFromStorage);
  const trackedPicks = useRef(new Set(items.flatMap(item => item.vendorPick ? [item.vendorPick.id] : [])));

  useEffect(() => {
    saveToStorage(items);
  }, [items]);

  const addItem = useCallback((item: Omit<QuoteItem, "quantity">, qty = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === item.productId);
      if (existing) {
        return prev.map(i =>
          i.productId === item.productId ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...prev, { ...item, quantity: qty }];
    });
    trackAddToList(item.productId, qty, item.name, item.sku);
  }, []);

  const removeItem = useCallback((productId: number) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: number, qty: number) => {
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000000) return;
    setItems(prev =>
      prev.map(i => (i.productId === productId ? { ...i, quantity: qty } : i))
    );
  }, []);

  const clearList = useCallback(() => setItems([]), []);

  const addSpecialOrder = useCallback((input: SpecialOrderInput) => {
    if (input.vendorPick) {
      if (trackedPicks.current.has(input.vendorPick.id)) return;
      trackedPicks.current.add(input.vendorPick.id);
    }
    // Keep analytics outside React's state updater (StrictMode may call it twice).
    trackSpecialOrderAdd(input);
    setItems(prev => {
      // A vendor pick is added once, even if the extension sends it again before it hears it was taken.
      if (input.vendorPick && prev.some(i => i.vendorPick?.id === input.vendorPick?.id)) return prev;
      const minId = prev.reduce((m, i) => Math.min(m, i.productId), 0);
      const productId = Math.min(minId - 1, -Date.now());
      return [...prev, toSpecialItem(productId, input)];
    });
  }, []);

  // const updateSpecialOrder = useCallback((productId: number, input: SpecialOrderInput) => {
  //   setItems(prev => prev.map(i => (i.productId === productId && i.specialOrder ? toSpecialItem(productId, input) : i)));
  // }, []);
  // A line from a vendor pick keeps its source; the form required a list price, so it is no longer missing.
  const updateSpecialOrder = useCallback((productId: number, input: SpecialOrderInput) => {
    setItems(prev => prev.map(i => {
      if (i.productId !== productId || !i.specialOrder) return i;
      const vendorPick = input.vendorPick ?? (i.vendorPick ? { ...i.vendorPick, priceMissing: false } : undefined);
      return toSpecialItem(productId, { ...input, vendorPick });
    }));
  }, []);

  const removeExactItems = useCallback((snapshot: QuoteItem[]) => {
    const keys = new Set(snapshot.map(i => JSON.stringify(i)));
    setItems(prev => prev.filter(i => !keys.has(JSON.stringify(i))));
  }, []);

  const isInList = useCallback(
    (productId: number) => items.some(i => i.productId === productId),
    [items]
  );

  const getQuantity = useCallback(
    (productId: number) => items.find(i => i.productId === productId)?.quantity ?? 0,
    [items]
  );

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalLineItems = items.length;
  const grandTotal = items.reduce((sum, i) => sum + (i.specialOrder ? 0 : (i.price ?? 0) * i.quantity), 0);

  return (
    <QuoteListContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearList, addSpecialOrder, updateSpecialOrder, removeExactItems, isInList, getQuantity, totalItems, totalLineItems, grandTotal }}
    >
      {children}
    </QuoteListContext.Provider>
  );
}

export function useQuoteList() {
  const ctx = useContext(QuoteListContext);
  if (!ctx) throw new Error("useQuoteList must be used within QuoteListProvider");
  return ctx;
}
