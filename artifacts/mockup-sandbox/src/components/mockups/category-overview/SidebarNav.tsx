import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, Hash } from 'lucide-react';

const CATEGORY_DATA = [
  {
    name: 'ACCESSORIES',
    links: ['Robe/Utility Hooks', 'Soap Dish/Dispenser'],
  },
  {
    name: 'COUNTERTOPS',
    links: [
      '23"-28" Wide',
      '29"-34" Wide',
      '35"-40" Wide',
      '47"-52" Wide',
      '59"-64" Wide',
    ],
  },
  {
    name: 'MEDICINE CABINETS & LIGHTS',
    links: [
      '23"-28" Wide OA',
      '29"-34" Wide OA',
      '35"-40" Wide OA',
      '47"-52" Wide OA',
      '53" Wide OA and Over',
      'Accessories',
      'Side Light',
      'Top Light',
      'Wall Mirrors',
    ],
  },
  {
    name: 'TUB & SHOWER DOORS',
    links: ['Shower Doors', 'Tub Doors'],
  },
  {
    name: 'VANITIES',
    links: [
      'Matching Light',
      'Matching Medicine Cabinets',
      'Matching Wall Mirrors',
      'Vanities',
      'Wall Valets (Overjohns)',
    ],
  },
];

export function SidebarNav() {
  const [activeCategory, setActiveCategory] = useState(CATEGORY_DATA[0].name);

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['Outfit'] text-slate-800 flex flex-col">
      {/* Header / Breadcrumb */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 md:px-8 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button className="flex items-center text-sm font-medium text-slate-500 hover:text-[#0B2545] transition-colors group">
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>
          <div className="text-xl font-bold tracking-tight text-[#0B2545]">
            CONSUMERS
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row items-stretch">
        {/* Sidebar */}
        <aside className="w-full md:w-64 lg:w-72 bg-white border-r border-slate-200 flex-shrink-0">
          <div className="p-6 md:p-8 md:sticky md:top-20">
            <h1 className="text-3xl font-extrabold text-[#0B2545] mb-2 tracking-tight">
              BATH
            </h1>
            <p className="text-sm text-slate-500 mb-8">
              Explore our comprehensive bath collection.
            </p>

            <nav className="space-y-1">
              {CATEGORY_DATA.map((category) => {
                const isActive = activeCategory === category.name;
                return (
                  <button
                    key={category.name}
                    onClick={() => setActiveCategory(category.name)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                      isActive
                        ? 'bg-[#0B2545] text-white shadow-md shadow-blue-900/10'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-[#0B2545]'
                    }`}
                  >
                    <span className="font-semibold text-sm tracking-wide">
                      {category.name}
                    </span>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${
                        isActive ? 'text-[#F59E0B]' : 'text-slate-300'
                      }`}
                    />
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Content Area */}
        <section className="flex-1 p-6 md:p-8 lg:p-12 bg-[#F8FAFC]">
          <div className="max-w-4xl">
            <div className="mb-10">
              <h2 className="text-2xl md:text-4xl font-bold text-[#0B2545] flex items-center">
                <span className="w-2 h-8 bg-[#F59E0B] rounded-full mr-4 inline-block"></span>
                {activeCategory}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {CATEGORY_DATA.find((c) => c.name === activeCategory)?.links.map(
                (link, idx) => (
                  <a
                    key={idx}
                    href="#"
                    className="group flex flex-col bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#F59E0B]/30 hover:bg-orange-50/30 transition-all duration-300"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-50 text-slate-400 group-hover:bg-[#F59E0B]/10 group-hover:text-[#F59E0B] flex items-center justify-center mb-4 transition-colors">
                      <Hash className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-slate-700 group-hover:text-[#0B2545] leading-snug">
                      {link}
                    </span>
                    <div className="mt-4 flex items-center text-xs font-semibold text-[#F59E0B] opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                      View Products <ChevronRight className="w-3 h-3 ml-1" />
                    </div>
                  </a>
                )
              )}
            </div>
            
            {/* Show all categories below the active one, stacked, if the user scrolls down */}
            <div className="mt-20 pt-10 border-t border-slate-200">
              <h3 className="text-lg font-bold text-slate-400 mb-8 uppercase tracking-widest">
                All Bath Categories
              </h3>
              
              <div className="columns-1 md:columns-2 gap-8 space-y-8">
                {CATEGORY_DATA.filter((c) => c.name !== activeCategory).map(
                  (category) => (
                    <div key={category.name} className="break-inside-avoid bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <h4 className="text-sm font-bold text-[#0B2545] mb-4 flex items-center">
                        <span className="w-1.5 h-4 bg-slate-200 rounded-full mr-2"></span>
                        {category.name}
                      </h4>
                      <ul className="space-y-2">
                        {category.links.map((link, idx) => (
                          <li key={idx}>
                            <a
                              href="#"
                              className="text-sm text-slate-500 hover:text-[#F59E0B] hover:underline underline-offset-4 transition-colors"
                            >
                              {link}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
