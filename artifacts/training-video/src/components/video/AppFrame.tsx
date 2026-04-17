import { ReactNode } from "react";
import { Search, ChevronDown, ShoppingCart, FolderTree } from "lucide-react";

type Props = {
  children: ReactNode;
  quoteCount?: number;
  highlight?: "categories" | "quote" | "search" | null;
  showCategoryDropdown?: boolean;
  hoveredTopCategory?: string | null;
};

const TOP_CATS = [
  "Bath",
  "Kitchen",
  "Hardware",
  "Lighting",
  "Outdoor",
  "Plumbing",
];

const SUB_CATS: Record<string, string[]> = {
  Bath: ["Vanities", "Toilets", "Showers", "Tubs", "Faucets", "Mirrors"],
  Kitchen: ["Sinks", "Faucets", "Disposers", "Hoods", "Cabinets"],
};

export default function AppFrame({
  children,
  quoteCount = 0,
  highlight = null,
  showCategoryDropdown = false,
  hoveredTopCategory = null,
}: Props) {
  return (
    <div className="absolute inset-0 flex flex-col bg-app-bg overflow-hidden">
      {/* top dark nav */}
      <header className="bg-app-ink text-white shrink-0 relative z-30">
        <div className="px-8 h-[58px] flex items-center gap-6">
          <div className="font-display font-extrabold tracking-tight text-[18px] text-white">
            consumers <span className="opacity-60 font-medium">selector</span>
          </div>

          <div
            className={`flex-1 max-w-[420px] flex items-center gap-2 px-3 h-9 rounded-md bg-white/10 transition ${
              highlight === "search" ? "ring-2 ring-white/70 bg-white/20" : ""
            }`}
          >
            <Search className="w-4 h-4 opacity-70" />
            <span className="text-sm opacity-60">Search products, SKUs…</span>
          </div>

          <nav className="flex items-center gap-5 text-[13px] font-medium">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition ${
                highlight === "categories" ? "bg-white/15" : "hover:bg-white/10"
              }`}
            >
              <FolderTree className="w-4 h-4 opacity-80" />
              Categories
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </div>
            <div className="opacity-80">Express Bath</div>
            <div className="opacity-80">Clearance</div>
            <div className="opacity-80">Displays</div>
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <div
              className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition ${
                highlight === "quote" ? "bg-white/15 ring-2 ring-white/40" : "hover:bg-white/10"
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="text-[13px]">Quote List</span>
              {quoteCount > 0 && (
                <span className="ml-0.5 min-w-[20px] h-[20px] px-1.5 rounded-full bg-amber text-white text-[11px] font-bold flex items-center justify-center">
                  {quoteCount}
                </span>
              )}
            </div>
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-[12px] font-semibold">
              JB
            </div>
          </div>
        </div>

        {/* Categories dropdown */}
        {showCategoryDropdown && (
          <div className="absolute left-0 right-0 top-full bg-white text-app-ink shadow-2xl border-t border-app-line">
            <div className="px-8 py-6 grid grid-cols-[200px_1fr] gap-6">
              <ul className="space-y-1">
                {TOP_CATS.map((c) => (
                  <li
                    key={c}
                    className={`px-3 py-2 rounded-md text-[14px] cursor-pointer transition ${
                      hoveredTopCategory === c
                        ? "bg-app-ink text-white font-semibold"
                        : "hover:bg-app-line/40"
                    }`}
                  >
                    {c}
                  </li>
                ))}
              </ul>
              {hoveredTopCategory && SUB_CATS[hoveredTopCategory] && (
                <div className="grid grid-cols-3 gap-x-8 gap-y-2 pl-6 border-l border-app-line">
                  {SUB_CATS[hoveredTopCategory].map((s) => (
                    <div
                      key={s}
                      className="text-[14px] py-1.5 text-app-ink-soft hover:text-app-ink cursor-pointer"
                    >
                      {s}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-hidden relative">{children}</main>
    </div>
  );
}
