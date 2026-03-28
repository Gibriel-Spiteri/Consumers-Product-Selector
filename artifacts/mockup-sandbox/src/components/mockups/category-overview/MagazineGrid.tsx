import React from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';

export function MagazineGrid() {
  const categories = [
    {
      name: "ACCESSORIES",
      items: ["Robe/Utility Hooks", "Soap Dish/Dispenser"]
    },
    {
      name: "COUNTERTOPS",
      items: ["23\"-28\" Wide", "29\"-34\" Wide", "35\"-40\" Wide", "47\"-52\" Wide", "59\"-64\" Wide"]
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

  const heroCategory = {
    name: "MEDICINE CABINETS & LIGHTS",
    items: [
      "23\"-28\" Wide OA", "29\"-34\" Wide OA", "35\"-40\" Wide OA", 
      "47\"-52\" Wide OA", "53\" Wide OA and Over", "Accessories", 
      "Side Light", "Top Light", "Wall Mirrors"
    ]
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-['Outfit'] p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        
        {/* Breadcrumb Header */}
        <div className="mb-10 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#0B2545] cursor-pointer transition-colors w-fit group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </div>

        {/* Page Title */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#0B2545] mb-4">
            Bath Collection
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            Explore our comprehensive range of premium bath fixtures and accessories. Designed for elegance and engineered for durability.
          </p>
        </div>

        {/* Hero Section */}
        <div className="mb-8 rounded-2xl overflow-hidden bg-[#0B2545] shadow-xl border border-transparent hover:border-[#F59E0B]/30 transition-colors duration-300">
          <div className="p-8 md:p-12 flex flex-col md:flex-row gap-8 items-start justify-between">
            <div className="md:w-1/3">
              <div className="inline-block px-3 py-1 bg-[#F59E0B]/20 text-[#F59E0B] rounded-full text-xs font-bold tracking-wider mb-6 border border-[#F59E0B]/30">
                FEATURED CATEGORY
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
                {heroCategory.name}
              </h2>
              <p className="text-blue-100/70 mb-8 max-w-md">
                Discover our extensive selection of medicine cabinets and specialized lighting options to perfectly illuminate your bath space.
              </p>
              <button className="flex items-center gap-2 text-[#F59E0B] font-semibold hover:text-amber-300 transition-colors group">
                View All Featured 
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            
            <div className="md:w-2/3 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {heroCategory.items.map((item, idx) => (
                <div 
                  key={idx}
                  className="group bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-blue-50 font-medium">{item}</span>
                    <ChevronRight className="w-4 h-4 text-blue-300 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2x2 Grid Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {categories.map((cat, idx) => (
            <div 
              key={idx}
              className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-shadow"
            >
              {/* Colored left accent */}
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#F59E0B] opacity-80" />
              
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold text-[#0B2545] group-hover:text-[#F59E0B] transition-colors">
                  {cat.name}
                </h3>
                <span className="text-xs font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                  {cat.items.length} ITEMS
                </span>
              </div>
              
              <div className="space-y-3">
                {cat.items.map((item, itemIdx) => (
                  <div 
                    key={itemIdx}
                    className="flex items-center group/item cursor-pointer p-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-2 h-2 rounded-full bg-gray-300 group-hover/item:bg-[#F59E0B] transition-colors mr-3" />
                    <span className="text-gray-600 group-hover/item:text-[#0B2545] font-medium transition-colors flex-1">
                      {item}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300 opacity-0 group-hover/item:opacity-100 group-hover/item:text-[#F59E0B] transition-all" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
