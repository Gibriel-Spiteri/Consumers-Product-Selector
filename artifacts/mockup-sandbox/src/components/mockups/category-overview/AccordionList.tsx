import React, { useState } from 'react';
import { ChevronLeft, ChevronDown, ChevronRight, Hash } from 'lucide-react';

const CATEGORIES = [
  {
    name: "ACCESSORIES",
    items: ["Robe/Utility Hooks", "Soap Dish/Dispenser"]
  },
  {
    name: "COUNTERTOPS",
    items: ["23\"-28\" Wide", "29\"-34\" Wide", "35\"-40\" Wide", "47\"-52\" Wide", "59\"-64\" Wide"]
  },
  {
    name: "MEDICINE CABINETS & LIGHTS",
    items: ["23\"-28\" Wide OA", "29\"-34\" Wide OA", "35\"-40\" Wide OA", "47\"-52\" Wide OA", "53\" Wide OA and Over", "Accessories", "Side Light", "Top Light", "Wall Mirrors"]
  },
  {
    name: "TUB & SHOWER DOORS",
    items: ["Shower Doors", "Tub Doors"]
  },
  {
    name: "VANITIES",
    items: ["Matching Light", "Matching Medicine Cabinets", "Matching Wall Mirrors", "Vanities", "Wall Valets (Overjohns)"]
  }
];

export function AccordionList() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    CATEGORIES.reduce((acc, cat) => ({ ...acc, [cat.name]: true }), {})
  );

  const toggleSection = (name: string) => {
    setOpenSections(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  return (
    <div className="font-['Outfit'] min-h-screen bg-white text-[#0B2545]">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <a href="#" className="flex items-center text-sm font-medium text-gray-500 hover:text-[#F59E0B] transition-colors">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Home
          </a>
          <div className="h-4 w-px bg-gray-200"></div>
          <h1 className="text-xl font-bold tracking-tight text-[#0B2545]">BATH OVERVIEW</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-10">
          <h2 className="text-4xl font-extrabold text-[#0B2545] tracking-tight mb-3">Bath Categories</h2>
          <p className="text-gray-500 text-lg max-w-2xl">
            Explore our complete collection of bathroom fixtures, vanities, and accessories perfectly suited for your space.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {CATEGORIES.map((category) => {
            const isOpen = openSections[category.name];
            
            return (
              <div 
                key={category.name}
                className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm transition-all duration-200 hover:border-gray-300"
              >
                {/* Accordion Header */}
                <button
                  onClick={() => toggleSection(category.name)}
                  className="w-full flex items-center justify-between p-5 bg-white group"
                >
                  <div className="flex items-center gap-4">
                    {/* Amber Accent */}
                    <div className={`w-1.5 h-8 rounded-full transition-colors duration-300 ${isOpen ? 'bg-[#F59E0B]' : 'bg-gray-200 group-hover:bg-gray-300'}`}></div>
                    
                    <h3 className="text-xl font-bold tracking-wide text-[#0B2545] m-0">
                      {category.name}
                    </h3>
                    
                    <span className="flex items-center justify-center bg-[#0B2545]/5 text-[#0B2545] text-xs font-bold px-2.5 py-1 rounded-full">
                      {category.items.length}
                    </span>
                  </div>
                  
                  <div className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </button>

                {/* Accordion Content */}
                <div 
                  className={`grid transition-all duration-300 ease-in-out ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="p-5 pt-0 pl-14">
                      <div className="flex flex-wrap gap-2">
                        {category.items.map((item) => (
                          <a
                            key={item}
                            href="#"
                            className="inline-flex items-center px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-[#F59E0B] hover:text-white hover:border-[#F59E0B] transition-all duration-200"
                          >
                            <Hash className="w-3.5 h-3.5 mr-1.5 opacity-50" />
                            {item}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
