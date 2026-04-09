import { useState, useCallback, useEffect } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Search, MousePointer2, LayoutGrid, List, Filter, ClipboardList, Plus, Send, ZoomIn, Tag, Sparkles, Shield, Copy, User, ChevronDown, ImageOff, Minus, X, ToggleRight, Layers, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface Hotspot {
  top: string;
  left: string;
  width: string;
  height: string;
  label: string;
  color: string;
}

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  gradient: string;
  hotspots: Hotspot[];
  tips: string[];
  diagram: React.ReactNode;
}

function Hotspot({ spot, index }: { spot: Hotspot; index: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="absolute transition-all duration-300 cursor-pointer group"
      style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={cn(
        "absolute inset-0 rounded-lg border-2 transition-all duration-300",
        hovered ? "border-opacity-100 bg-opacity-20" : "border-opacity-60 bg-opacity-10 animate-pulse",
        spot.color === "amber" && "border-amber-400 bg-amber-400",
        spot.color === "blue" && "border-blue-400 bg-blue-400",
        spot.color === "green" && "border-emerald-400 bg-emerald-400",
        spot.color === "red" && "border-red-400 bg-red-400",
        spot.color === "purple" && "border-violet-400 bg-violet-400",
      )} />
      <div className={cn(
        "absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-white text-[10px] font-bold whitespace-nowrap shadow-lg transition-all duration-200 z-10",
        hovered ? "scale-110" : "scale-100",
        spot.color === "amber" && "bg-amber-500",
        spot.color === "blue" && "bg-blue-500",
        spot.color === "green" && "bg-emerald-500",
        spot.color === "red" && "bg-red-500",
        spot.color === "purple" && "bg-violet-500",
      )}>
        {spot.label}
      </div>
    </div>
  );
}

function LoginSlide() {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="w-full max-w-[340px]">
        <div className="text-center mb-5">
          <span className="text-amber-500 font-extrabold text-lg">CONSUMERS</span>{" "}
          <span className="font-bold text-lg text-gray-900">PRODUCT SELECTOR</span>
          <p className="text-xs text-gray-400 mt-1">Sign in with your employee credentials</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Email</label>
            <div className="border-2 border-amber-400 rounded-lg px-3 py-2 text-sm text-gray-400 bg-amber-50/30">you@consumersmail.com</div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Password</label>
            <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400">Enter your password</div>
          </div>
          <div className="bg-gray-700 hover:bg-gray-800 text-white text-sm font-semibold text-center py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors">
            <ArrowRight size={14} />
            Sign In
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderSlide() {
  return (
    <div className="flex flex-col justify-center h-full p-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative">
        <div className="px-5 py-3 flex items-center gap-5 border-b border-gray-100">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-amber-500 font-extrabold text-xs">CONSUMERS</span>
            <span className="font-bold text-xs text-gray-900">PRODUCT SELECTOR</span>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl w-full max-w-[340px]">
              <Search size={13} className="text-gray-400" />
              <span className="text-xs text-gray-400">Search products, SKUs...</span>
              <span className="ml-auto text-[10px] text-gray-300 bg-gray-100 px-1.5 py-0.5 rounded font-mono">Enter</span>
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-1.5 px-2 py-1">
              <User size={13} className="text-gray-500" />
              <span className="text-xs text-gray-600 font-medium">John D.</span>
              <ChevronDown size={10} className="text-gray-400" />
            </div>
            <div className="relative px-2 py-1">
              <ClipboardList size={16} className="text-gray-500" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">3</span>
            </div>
          </div>
        </div>
        <div className="px-5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <span className="text-xs font-bold text-gray-800 tracking-wide">BATH</span>
            <span className="text-xs font-bold text-gray-800 tracking-wide">HOME</span>
            <span className="text-xs font-bold text-gray-800 tracking-wide">PLUMBING</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-amber-600 tracking-wide">EXPRESS BATH</span>
            <span className="text-xs font-bold text-red-500 tracking-wide">CLEARANCE</span>
            <span className="text-xs font-bold text-gray-500 tracking-wide">INTERNAL</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CategorySlide() {
  return (
    <div className="flex flex-col justify-center h-full p-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden relative">
        <div className="px-5 py-2 border-b border-gray-100 flex items-center gap-3">
          <span className="text-xs font-bold text-gray-800">BATH</span>
          <span className="text-xs text-gray-300">HOME</span>
          <span className="text-xs text-gray-300">PLUMBING</span>
        </div>
        <div className="p-5">
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 relative">
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-3">Subcategories</p>
            <div className="grid grid-cols-3 gap-2">
              {["Vanities", "Faucets", "Showers", "Bathtubs", "Toilets", "Accessories", "Mirrors", "Medicine Cabinets", "Lighting"].map(name => (
                <div key={name} className="bg-white rounded-lg border border-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:border-amber-300 hover:bg-amber-50/50 transition-all cursor-pointer flex items-center gap-1.5">
                  <ChevronRight size={10} className="text-amber-400" />
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductListSlide() {
  return (
    <div className="flex flex-col justify-center h-full p-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">Bath &gt; Vanities &gt;</span>
            <span className="text-sm font-bold text-gray-900">29" to 34" Wide</span>
            <span className="text-xs text-gray-400 ml-1">7 items</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 cursor-pointer hover:bg-gray-100 transition-colors">
              <Filter size={12} className="text-gray-500" />
              <span className="text-[11px] text-gray-600 font-medium">Filters</span>
            </div>
            <div className="flex items-center border border-gray-200 rounded-lg px-2 py-1 gap-1">
              <Search size={11} className="text-gray-400" />
              <span className="text-[11px] text-gray-400">Refine...</span>
            </div>
            <div className="flex items-center gap-0.5 border border-gray-200 rounded-lg p-0.5">
              <div className="p-1 rounded bg-gray-900"><LayoutGrid size={11} className="text-white" /></div>
              <div className="p-1 rounded"><List size={11} className="text-gray-400" /></div>
            </div>
          </div>
        </div>
        <div className="p-4 flex gap-3">
          <div className="w-[100px] shrink-0 bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-[9px] font-bold text-gray-500 uppercase mb-2">Finish</p>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 cursor-pointer"><div className="w-3 h-3 rounded border border-gray-300" /><span className="text-[10px] text-gray-600">Espresso</span></label>
              <label className="flex items-center gap-1.5 cursor-pointer"><div className="w-3 h-3 rounded border border-gray-300 bg-amber-500" /><span className="text-[10px] text-gray-700 font-medium">Chardonnay</span></label>
              <label className="flex items-center gap-1.5 cursor-pointer"><div className="w-3 h-3 rounded border border-gray-300" /><span className="text-[10px] text-gray-600">White</span></label>
            </div>
            <p className="text-[9px] font-bold text-gray-500 uppercase mt-3 mb-2">Size</p>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 cursor-pointer"><div className="w-3 h-3 rounded border border-gray-300" /><span className="text-[10px] text-gray-600">30"</span></label>
              <label className="flex items-center gap-1.5 cursor-pointer"><div className="w-3 h-3 rounded border border-gray-300" /><span className="text-[10px] text-gray-600">34"</span></label>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-3 gap-3">
            {[
              { name: "Rowan Chardonnay 30x21", price: "$297.97", stock: true },
              { name: "Newport Espresso 32x18", price: "$345.00", stock: true },
              { name: "Aspen White 30x21", price: "$269.99", stock: false },
            ].map((p, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 hover:border-amber-300 hover:shadow-md transition-all cursor-pointer overflow-hidden group">
                <div className="aspect-square bg-gray-50 flex items-center justify-center p-3">
                  <ImageOff size={18} className="text-gray-200" />
                </div>
                <div className="p-2.5">
                  <p className="text-[10px] font-medium text-gray-700 leading-tight mb-1.5 line-clamp-2">{p.name}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-900">{p.price}</p>
                    <span className={cn("text-[7px] px-1.5 py-0.5 rounded-full font-bold uppercase", p.stock ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500")}>
                      {p.stock ? "In Stock" : "Out of Stock"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductDetailSlide() {
  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden w-full max-w-[520px]">
        <div className="px-5 pt-4 pb-2">
          <p className="text-sm font-bold text-gray-900 leading-tight">Rowan Chardonnay Tapered Leg 30x21 Two Full Height Doors Vanity Cabinet</p>
        </div>
        <div className="px-5 pb-3 flex gap-4">
          <div className="w-[130px] shrink-0">
            <div className="aspect-square bg-gray-50 rounded-xl flex items-center justify-center relative border border-gray-100">
              <ImageOff size={20} className="text-gray-200" />
              <div className="absolute bottom-1.5 left-1.5 bg-white/90 shadow-sm rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                <ZoomIn size={8} className="text-gray-500" />
                <span className="text-[7px] text-gray-500 font-medium">Enlarge</span>
              </div>
            </div>
            <div className="flex gap-1 mt-1.5">
              <div className="w-8 h-8 bg-gray-50 rounded border-2 border-gray-900" />
              <div className="w-8 h-8 bg-gray-50 rounded border border-gray-200" />
              <div className="w-8 h-8 bg-gray-50 rounded border border-gray-200" />
            </div>
          </div>
          <div className="flex-1 min-w-0 flex gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-1">Description</p>
              <ul className="text-[10px] text-gray-500 space-y-0.5 list-disc list-inside">
                <li>Chardonnay finish</li>
                <li>Recessed panel with 5-Piece drawer</li>
                <li>All plywood construction</li>
                <li>Self closing hinges</li>
              </ul>
            </div>
            <div className="shrink-0 border-l border-gray-100 pl-4">
              <p className="text-[9px] font-bold text-gray-400 uppercase">Our Price</p>
              <p className="text-xl font-bold text-gray-900">$297.97</p>
              <p className="text-[10px] text-gray-400">Retail <span className="line-through">$399.99</span></p>
              <div className="mt-2 space-y-1.5">
                <div>
                  <p className="text-[8px] font-bold text-gray-400 uppercase">SKU</p>
                  <span className="inline-flex items-center gap-0.5 bg-gray-100 rounded-full px-1.5 py-0.5 text-[9px] font-mono text-gray-600"><Copy size={7} /> ANIH-VF3021-FBS</span>
                </div>
                <div>
                  <p className="text-[8px] font-bold text-gray-400 uppercase">Availability</p>
                  <span className="inline-flex items-center text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">Non-Stock</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 border-t border-gray-100">
          <div className="flex border-b border-gray-100">
            <span className="text-[10px] font-medium text-gray-800 px-3 py-2 border-b-2 border-amber-400">More from 29" to 34"</span>
            <span className="text-[10px] text-gray-400 px-3 py-2">Related Items</span>
            <span className="text-[10px] text-gray-400 px-3 py-2">Specifications</span>
            <span className="text-[10px] text-gray-400 px-3 py-2">Collection</span>
          </div>
          <div className="flex gap-2 py-3 overflow-hidden">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-16 shrink-0 bg-gray-50 rounded-lg p-1.5 cursor-pointer hover:bg-gray-100 transition-colors">
                <div className="aspect-square bg-gray-100 rounded mb-1 flex items-center justify-center"><ImageOff size={10} className="text-gray-300" /></div>
                <p className="text-[7px] text-gray-600 leading-tight line-clamp-2">Product Name</p>
                <p className="text-[8px] font-bold text-gray-900 mt-0.5">$249.99</p>
              </div>
            ))}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="flex items-center border border-gray-200 rounded-lg bg-white">
              <button className="px-2 py-1 text-gray-400"><Minus size={11} /></button>
              <span className="px-2.5 py-1 text-xs font-bold text-gray-900 border-x border-gray-200">1</span>
              <button className="px-2 py-1 text-gray-400"><Plus size={11} /></button>
            </div>
            <div className="bg-amber-500 text-white text-[11px] font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1"><Plus size={11} /> Add to List</div>
          </div>
          <span className="text-[11px] text-gray-400 border border-gray-200 rounded-xl px-3 py-1.5 bg-white">Dismiss</span>
        </div>
      </div>
    </div>
  );
}

function QuoteListSlide() {
  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden w-full max-w-[480px]">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-amber-500" />
            <p className="text-sm font-bold text-gray-900">Quote List</p>
          </div>
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">3 items</span>
        </div>
        <div className="divide-y divide-gray-50">
          {[
            { name: "Rowan Chardonnay Vanity 30x21", sku: "ANIH-VF3021", qty: 2, price: 297.97 },
            { name: "Undermount Sink 18\" White", sku: "USK-1812-W", qty: 1, price: 149.99 },
            { name: "Single Handle Faucet Chrome", sku: "FHC-2240-CH", qty: 1, price: 189.00 },
          ].map((item, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center shrink-0">
                <ImageOff size={12} className="text-gray-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-gray-800 leading-tight truncate">{item.name}</p>
                <p className="text-[9px] font-mono text-gray-400 mt-0.5">{item.sku}</p>
              </div>
              <div className="flex items-center border border-gray-200 rounded-lg bg-white shrink-0">
                <button className="px-1.5 py-0.5 text-gray-400"><Minus size={9} /></button>
                <span className="px-2 py-0.5 text-[11px] font-bold text-gray-900 border-x border-gray-200">{item.qty}</span>
                <button className="px-1.5 py-0.5 text-gray-400"><Plus size={9} /></button>
              </div>
              <p className="text-xs font-bold text-gray-900 w-16 text-right shrink-0">${(item.price * item.qty).toFixed(2)}</p>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <span className="text-xs text-gray-500 font-medium">Total</span>
          <span className="text-base font-bold text-gray-900">$934.93</span>
        </div>
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Push to NetSuite Estimate</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <Search size={12} className="text-gray-400" />
              <span className="text-xs text-gray-400">Search estimate # or customer name...</span>
            </div>
            <button className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors shrink-0">
              <Send size={12} /> Push
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecialSectionsSlide() {
  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="w-full max-w-[520px] space-y-4">
        <div className="bg-white rounded-2xl border-2 border-amber-300 p-5 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Sparkles size={22} className="text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 mb-1">Express Bath</p>
            <p className="text-xs text-gray-500 leading-relaxed">Quick-ship bath products organized by type. Use the pill tabs at the top to filter: <strong>Cabinetry</strong>, <strong>Countertops</strong>, <strong>Sinks</strong>, <strong>Fixtures</strong>.</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border-2 border-emerald-300 p-5 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
            <Tag size={22} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 mb-1">Clearance</p>
            <p className="text-xs text-gray-500 leading-relaxed">All products with active promotional pricing. <span className="text-emerald-600 font-bold">Green prices</span> indicate the reduced amount. Original retail is shown with a strikethrough.</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border-2 border-violet-300 p-5 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <Shield size={22} className="text-violet-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 mb-1">Admin Panel</p>
            <p className="text-xs text-gray-500 leading-relaxed">Managers only. Trigger data syncs, set the automated sync schedule, view uncategorized products, and update the homepage hero image.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TipsSlide() {
  const tips = [
    { icon: Copy, text: "Click any SKU to copy it to your clipboard instantly" },
    { icon: ZoomIn, text: "Click product images to open a full-screen lightbox with all views" },
    { icon: ToggleRight, text: "Use the In Stock toggle to hide out-of-stock products" },
    { icon: Layers, text: "Check the 'More from Category' tab to find similar products" },
    { icon: ClipboardList, text: "Your quote list is saved automatically — it persists between sessions" },
    { icon: Search, text: "Search works with product names, SKUs, and keywords" },
  ];

  return (
    <div className="flex items-center justify-center h-full p-6">
      <div className="w-full max-w-[480px]">
        <div className="grid grid-cols-2 gap-3">
          {tips.map((tip, i) => {
            const Icon = tip.icon;
            return (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 flex items-start gap-3 hover:border-amber-300 hover:shadow-sm transition-all">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-amber-600" />
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{tip.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const slides: { id: string; title: string; subtitle: string; gradient: string; content: React.ReactNode }[] = [
  {
    id: "welcome",
    title: "Welcome to the Product Selector",
    subtitle: "A quick slideshow to get you up and running",
    gradient: "from-amber-500 to-orange-500",
    content: (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
            <Sparkles size={36} className="text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-3">Product Selector Tutorial</p>
          <p className="text-sm text-gray-500 max-w-md leading-relaxed">This slideshow walks you through every feature of the Product Selector — from logging in to pushing quotes to NetSuite. Use the arrows to navigate.</p>
          <div className="flex items-center justify-center gap-2 mt-6 text-xs text-gray-400">
            <span>Use</span>
            <span className="bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-500">←</span>
            <span className="bg-gray-100 px-2 py-0.5 rounded font-mono text-gray-500">→</span>
            <span>arrow keys or click the buttons below</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "login",
    title: "Step 1: Sign In",
    subtitle: "Use your NetSuite employee email and password",
    gradient: "from-blue-500 to-indigo-500",
    content: <LoginSlide />,
  },
  {
    id: "header",
    title: "Step 2: The Header Bar",
    subtitle: "Categories, search, user menu, and quote list — all in one place",
    gradient: "from-violet-500 to-purple-500",
    content: <HeaderSlide />,
  },
  {
    id: "categories",
    title: "Step 3: Browse Categories",
    subtitle: "Hover over top-level tabs to reveal subcategory dropdowns",
    gradient: "from-emerald-500 to-teal-500",
    content: <CategorySlide />,
  },
  {
    id: "products",
    title: "Step 4: Product Listing",
    subtitle: "Filter, refine, and switch views to find exactly what you need",
    gradient: "from-sky-500 to-blue-500",
    content: <ProductListSlide />,
  },
  {
    id: "detail",
    title: "Step 5: Product Details",
    subtitle: "Click any product to see images, pricing, specs, and related items",
    gradient: "from-rose-500 to-pink-500",
    content: <ProductDetailSlide />,
  },
  {
    id: "quote",
    title: "Step 6: Quote List & Push",
    subtitle: "Build your list and send it directly to a NetSuite estimate",
    gradient: "from-amber-500 to-yellow-500",
    content: <QuoteListSlide />,
  },
  {
    id: "special",
    title: "Step 7: Special Sections",
    subtitle: "Express Bath, Clearance, and the Admin panel",
    gradient: "from-fuchsia-500 to-violet-500",
    content: <SpecialSectionsSlide />,
  },
  {
    id: "tips",
    title: "Pro Tips",
    subtitle: "Shortcuts and tricks to work faster",
    gradient: "from-orange-500 to-red-500",
    content: <TipsSlide />,
  },
  {
    id: "done",
    title: "You're Ready!",
    subtitle: "Start browsing and building quotes",
    gradient: "from-emerald-500 to-green-500",
    content: (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <ArrowRight size={36} className="text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mb-3">That's everything!</p>
          <p className="text-sm text-gray-500 max-w-md leading-relaxed mb-6">You now know how to navigate categories, search products, use filters, view details, build a quote list, and push to NetSuite.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-emerald-500/25"
          >
            Start Browsing Products
          </Link>
        </div>
      </div>
    ),
  },
];

export default function HowToUse4() {
  const [current, setCurrent] = useState(0);

  const goNext = useCallback(() => setCurrent(c => Math.min(c + 1, slides.length - 1)), []);
  const goPrev = useCallback(() => setCurrent(c => Math.max(c - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  const slide = slides[current];

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className={`bg-gradient-to-r ${slide.gradient} px-6 py-4 flex items-center justify-between shrink-0`}>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white/60 hover:text-white transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">{slide.title}</h1>
            <p className="text-xs text-white/70">{slide.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/60 font-medium">{current + 1} / {slides.length}</span>
        </div>
      </div>

      <div className="w-full h-1 bg-gray-200 shrink-0">
        <div
          className={`h-full bg-gradient-to-r ${slide.gradient} transition-all duration-500 ease-out`}
          style={{ width: `${((current + 1) / slides.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 bg-gray-50 overflow-y-auto relative">
        {slide.content}
      </div>

      <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <button
          onClick={goPrev}
          disabled={current === 0}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
          Previous
        </button>

        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                i === current ? `w-6 bg-gradient-to-r ${slide.gradient}` : "bg-gray-300 hover:bg-gray-400"
              )}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={current === slides.length - 1}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed",
            `bg-gradient-to-r ${slide.gradient} text-white hover:shadow-lg`
          )}
        >
          Next
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
