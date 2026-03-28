import React from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';

const subcategories = [
  {
    name: 'ACCESSORIES',
    links: ['Robe/Utility Hooks', 'Soap Dish/Dispenser'],
  },
  {
    name: 'COUNTERTOPS',
    links: ['23" to 28" Wide', '29" to 34" Wide', '35" to 40" Wide', '47" to 52" Wide', '59" to 64" Wide'],
  },
  {
    name: 'MEDICINE CABINETS & LIGHTS',
    links: ['23"-28" Wide OA', '29"-34" Wide OA', '35"-40" Wide OA', '47"-52" Wide OA', '53" Wide OA and Over', 'Accessories', 'Side Light', 'Top Light', 'Wall Mirrors'],
  },
  {
    name: 'TUB & SHOWER DOORS',
    links: ['Shower Doors', 'Tub Doors'],
  },
  {
    name: 'VANITIES',
    links: ['Matching Light', 'Matching Medicine Cabinets', 'Matching Wall Mirrors', 'Vanities', 'Wall Valets (Overjohns)'],
  },
];

export function DarkLux() {
  return (
    <div className="min-h-screen bg-[#0B2545] text-white font-['Outfit'] font-sans selection:bg-amber-400/30">
      {/* Breadcrumb Area */}
      <div className="w-full bg-[#081a30] px-6 lg:px-12 py-4 flex items-center shadow-md border-b border-white/5">
        <button className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors group text-sm font-light tracking-wide">
          <ArrowLeft className="w-4 h-4 text-amber-500 group-hover:-translate-x-1 transition-transform" />
          <span>BACK TO HOME</span>
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
        {/* Hero Header Area */}
        <div className="mb-20">
          <p className="text-amber-500 text-xs font-semibold tracking-[0.3em] uppercase mb-4">5 Subcategories</p>
          <h1 className="text-6xl md:text-8xl font-light tracking-tight mb-8 text-white/95">
            BATH
          </h1>
          <div className="w-24 h-1 bg-amber-500"></div>
        </div>

        {/* Subcategory Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 xl:gap-10">
          {subcategories.map((category) => (
            <div 
              key={category.name} 
              className="bg-[#0f2d52]/80 backdrop-blur-sm border border-white/10 rounded-xl p-8 shadow-xl hover:shadow-2xl hover:bg-[#12335c] transition-all duration-300 group flex flex-col"
            >
              <h2 className="text-xl font-medium tracking-wider uppercase mb-6 flex items-center border-l-2 border-amber-400 pl-4 text-white/90">
                {category.name}
              </h2>
              <ul className="space-y-4 flex-grow">
                {category.links.map((link) => (
                  <li key={link}>
                    <button className="w-full text-left flex items-center justify-between text-gray-400 hover:text-amber-400 group/link transition-colors text-sm font-light">
                      <span className="truncate pr-4">{link}</span>
                      <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover/link:opacity-100 group-hover/link:translate-x-0 transition-all duration-200 text-amber-400" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
