import { ArrowLeft, ArrowRight } from "lucide-react";

export function AerialGrid() {
  const subcategories = [
    {
      name: "ACCESSORIES",
      links: ["Robe/Utility Hooks", "Soap Dish/Dispenser"]
    },
    {
      name: "COUNTERTOPS",
      links: [
        "23\" to 28\" Wide",
        "29\" to 34\" Wide",
        "35\" to 40\" Wide",
        "47\" to 52\" Wide",
        "59\" to 64\" Wide"
      ]
    },
    {
      name: "MEDICINE CABINETS & LIGHTS",
      links: [
        "23\"-28\" Wide OA",
        "29\"-34\" Wide OA",
        "35\"-40\" Wide OA",
        "47\"-52\" Wide OA",
        "53\" Wide OA and Over",
        "Accessories",
        "Side Light",
        "Top Light",
        "Wall Mirrors"
      ]
    },
    {
      name: "TUB & SHOWER DOORS",
      links: ["Shower Doors", "Tub Doors"]
    },
    {
      name: "VANITIES",
      links: [
        "Matching Light",
        "Matching Medicine Cabinets",
        "Matching Wall Mirrors",
        "Vanities",
        "Wall Valets (Overjohns)"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white font-['Outfit'] flex flex-col selection:bg-[#F59E0B] selection:text-white">
      {/* Navigation */}
      <nav className="px-8 lg:px-16 py-8">
        <button className="group flex items-center gap-2 text-xs text-gray-400 uppercase tracking-[0.2em] hover:text-[#0B2545] transition-colors duration-300">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />
          <span>Back to Home</span>
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 px-8 lg:px-16 flex flex-col">
        
        {/* Header Section */}
        <header className="relative py-16 lg:py-24 mb-16">
          {/* Decorative background text */}
          <div className="absolute top-0 left-0 w-full overflow-hidden pointer-events-none select-none">
            <h1 className="text-[12rem] lg:text-[18rem] font-black text-gray-50 leading-none -ml-4 lg:-ml-8 tracking-tighter">
              BATH
            </h1>
          </div>

          {/* Foreground header content */}
          <div className="relative z-10 pt-16 lg:pt-32">
            <h2 className="text-5xl lg:text-7xl font-bold text-[#0B2545] mb-8 tracking-tight">
              BATH
            </h2>
            <div className="w-16 h-0.5 bg-[#F59E0B] mb-6"></div>
            <p className="text-[#F59E0B] uppercase tracking-[0.3em] text-sm font-semibold">
              5 SUBCATEGORIES
            </p>
          </div>
        </header>

        {/* Grid Section */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-20 pb-24">
          {subcategories.map((sub, index) => (
            <div key={index} className="flex flex-col group">
              <div className="border-t border-[#F59E0B]/30 pt-6 mb-8 group-hover:border-[#F59E0B] transition-colors duration-500">
                <h3 className="font-black text-lg tracking-[0.15em] text-[#0B2545] uppercase">
                  {sub.name}
                </h3>
              </div>
              <ul className="space-y-4 flex-1">
                {sub.links.map((link, linkIdx) => (
                  <li key={linkIdx}>
                    <button className="group/link flex items-start gap-3 text-sm text-gray-500 hover:text-[#0B2545] text-left transition-colors duration-300 w-full">
                      <span className="text-[#F59E0B] opacity-50 group-hover/link:opacity-100 group-hover/link:translate-x-1 transition-all duration-300 shrink-0 mt-0.5">
                        <ArrowRight className="w-4 h-4" />
                      </span>
                      <span className="leading-relaxed font-medium">{link}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </main>

      {/* Footer */}
      <div className="mt-auto">
        <div className="h-1 bg-[#F59E0B] w-full"></div>
        <footer className="bg-[#0B2545] py-12 px-8 lg:px-16">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-white/60 text-sm tracking-widest uppercase">
              © 2024 CONSUMERS
            </p>
            <p className="text-white/40 text-xs tracking-wider">
              PREMIUM PRODUCT SELECTION
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
