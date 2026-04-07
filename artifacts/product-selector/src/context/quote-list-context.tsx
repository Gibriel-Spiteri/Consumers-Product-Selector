import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export interface QuoteItem {
  productId: number;
  netsuiteId: string;
  name: string;
  sku: string | null;
  price: number | null;
  imageUrl: string | null;
  quantity: number;
}

interface QuoteListContextType {
  items: QuoteItem[];
  addItem: (item: Omit<QuoteItem, "quantity">, qty?: number) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, qty: number) => void;
  clearList: () => void;
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

export function QuoteListProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<QuoteItem[]>(loadFromStorage);

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
  }, []);

  const removeItem = useCallback((productId: number) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: number, qty: number) => {
    if (qty < 1) return;
    setItems(prev =>
      prev.map(i => (i.productId === productId ? { ...i, quantity: qty } : i))
    );
  }, []);

  const clearList = useCallback(() => setItems([]), []);

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
  const grandTotal = items.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0);

  return (
    <QuoteListContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearList, isInList, getQuantity, totalItems, totalLineItems, grandTotal }}
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
