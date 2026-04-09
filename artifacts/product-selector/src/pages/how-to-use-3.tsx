import { ArrowLeft, Search, MousePointer2, LayoutGrid, List, Filter, ClipboardList, Plus, Send, ZoomIn, Tag, Sparkles, Shield, ChevronRight, ChevronDown, Copy, ToggleRight, Layers, ArrowRight, Menu, User, ImageOff, Minus, X } from "lucide-react";
import { Link } from "wouter";

function SectionHeader({ number, title, subtitle }: { number: number; title: string; subtitle: string }) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg font-bold shrink-0">
        {number}
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function Callout({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-2 text-sm mt-3 px-3 py-2 rounded-lg ${color}`}>
      <ArrowRight size={14} className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

function Highlight({ label, color = "amber" }: { label: string; color?: string }) {
  const colors: Record<string, string> = {
    amber: "bg-amber-400/30 border-amber-400 text-amber-700",
    blue: "bg-blue-400/30 border-blue-400 text-blue-700",
    green: "bg-emerald-400/30 border-emerald-400 text-emerald-700",
    red: "bg-red-400/30 border-red-400 text-red-700",
    purple: "bg-violet-400/30 border-violet-400 text-violet-700",
  };
  return (
    <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full border ${colors[color]}`}>
      {label}
    </span>
  );
}

function LoginDiagram() {
  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 relative overflow-hidden">
      <div className="max-w-[320px] mx-auto">
        <div className="text-center mb-4">
          <span className="text-amber-500 font-extrabold text-sm">CONSUMERS</span>{" "}
          <span className="font-bold text-sm text-gray-900">PRODUCT SELECTOR</span>
          <p className="text-[10px] text-gray-400 mt-1">Sign in with your employee credentials</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 relative">
          <div className="ring-2 ring-amber-400 rounded-lg">
            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-2 pt-1 block">Email</label>
            <div className="px-2 pb-2 text-xs text-gray-400">you@consumersmail.com</div>
          </div>
          <div>
            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-2 pt-1 block">Password</label>
            <div className="px-2 pb-2 text-xs text-gray-400">Enter your password</div>
          </div>
          <div className="bg-gray-500 text-white text-xs font-medium text-center py-2 rounded-lg">Sign In</div>
          <div className="absolute -right-2 top-2 translate-x-full">
            <div className="bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
              Use your NetSuite email & password
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderDiagram() {
  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 overflow-hidden">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2 flex items-center gap-4 border-b border-gray-100">
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-amber-500 font-extrabold text-[10px]">CONSUMERS</span>
            <span className="font-bold text-[10px] text-gray-900">PRODUCT SELECTOR</span>
          </div>
          <div className="flex-1 flex items-center">
            <div className="ring-2 ring-blue-400 rounded-lg flex items-center gap-1 px-2 py-1 bg-gray-50 flex-1 max-w-[280px] relative">
              <Search size={10} className="text-gray-400" />
              <span className="text-[10px] text-gray-400">Search products, SKUs...</span>
              <div className="absolute -top-7 left-1/2 -translate-x-1/2">
                <div className="bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                  B. Search Bar
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="ring-2 ring-green-400 rounded-lg flex items-center gap-1 px-2 py-1 relative">
              <User size={10} className="text-gray-500" />
              <span className="text-[10px] text-gray-600">John D.</span>
              <ChevronDown size={8} className="text-gray-400" />
              <div className="absolute -top-7 right-0">
                <div className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                  D. User Menu
                </div>
              </div>
            </div>
            <div className="ring-2 ring-purple-400 rounded-lg relative px-2 py-1">
              <ClipboardList size={12} className="text-gray-500" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 text-white text-[6px] font-bold rounded-full flex items-center justify-center">3</span>
              <div className="absolute -top-7 right-0">
                <div className="bg-violet-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                  E. Quote List
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="px-4 py-1.5 flex items-center gap-1 relative">
          <div className="ring-2 ring-amber-400 rounded-lg flex items-center gap-3 px-2 py-1 relative">
            <span className="text-[10px] font-bold text-gray-700">BATH</span>
            <span className="text-[10px] font-bold text-gray-700">HOME</span>
            <span className="text-[10px] font-bold text-gray-700">PLUMBING</span>
            <div className="absolute -bottom-7 left-0">
              <div className="bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                A. Category Tabs
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="ring-2 ring-red-400 rounded-lg flex items-center gap-2 px-2 py-1 relative">
              <span className="text-[10px] font-bold text-amber-600">EXPRESS BATH</span>
              <span className="text-[10px] font-bold text-red-500">CLEARANCE</span>
              <div className="absolute -bottom-7 right-0">
                <div className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                  C. Special Sections
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="h-8" />
    </div>
  );
}

function ProductListingDiagram() {
  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 overflow-hidden">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">Home &gt; Bath &gt;</span>
            <span className="text-xs font-bold text-gray-900">Vanities</span>
            <span className="text-[10px] text-gray-400 ml-1">24 items</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="ring-2 ring-amber-400 rounded-lg flex items-center gap-1 px-1.5 py-0.5 relative">
              <Filter size={10} className="text-gray-500" />
              <span className="text-[10px] text-gray-600">Filters</span>
              <div className="absolute -top-7 right-0">
                <div className="bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                  1. Filter Button
                </div>
              </div>
            </div>
            <div className="ring-2 ring-blue-400 rounded-lg flex items-center px-1.5 py-0.5 gap-0.5 relative">
              <Search size={9} className="text-gray-400" />
              <span className="text-[10px] text-gray-400">Refine...</span>
              <div className="absolute -top-7 right-0">
                <div className="bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                  2. Refine Box
                </div>
              </div>
            </div>
            <div className="ring-2 ring-green-400 rounded-lg flex items-center gap-0.5 px-1 py-0.5 relative">
              <LayoutGrid size={10} className="text-gray-900" />
              <List size={10} className="text-gray-300" />
              <div className="absolute -top-7 right-0">
                <div className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                  3. View Toggle
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 flex items-start gap-2">
          <div className="ring-2 ring-purple-400 rounded-lg p-2 w-[100px] shrink-0 relative">
            <p className="text-[8px] font-bold text-gray-500 uppercase mb-1">Finish</p>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-gray-800" /><span className="text-[8px] text-gray-600">Espresso</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-amber-200" /><span className="text-[8px] text-gray-600">Natural</span></div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-white border" /><span className="text-[8px] text-gray-600">White</span></div>
            </div>
            <p className="text-[8px] font-bold text-gray-500 uppercase mt-2 mb-1">Size</p>
            <div className="space-y-0.5">
              <div className="text-[8px] text-gray-600">24"</div>
              <div className="text-[8px] text-gray-600">30"</div>
              <div className="text-[8px] text-gray-600">36"</div>
            </div>
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full">
              <div className="bg-violet-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                4. Facet Filters
              </div>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-3 gap-2">
            {[1,2,3].map(i => (
              <div key={i} className="ring-2 ring-red-400/50 rounded-lg bg-gray-50 p-2 cursor-pointer">
                <div className="aspect-square bg-gray-100 rounded-lg mb-1 flex items-center justify-center">
                  <ImageOff size={14} className="text-gray-300" />
                </div>
                <p className="text-[8px] font-medium text-gray-700 leading-tight mb-0.5">Product Name Here</p>
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold text-gray-900">$299.97</p>
                  <span className="text-[7px] px-1 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold">IN STOCK</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="px-4 pb-2">
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <MousePointer2 size={10} className="text-red-500" />
            <span className="text-[10px] text-red-700 font-medium">Click any product card to open the detail popup</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductModalDiagram() {
  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 overflow-hidden">
      <div className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden max-w-[500px] mx-auto">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-900">Rowan Chardonnay Vanity Cabinet 30x21</p>
        </div>
        <div className="p-3 flex gap-3">
          <div className="w-[120px] shrink-0">
            <div className="ring-2 ring-amber-400 rounded-lg aspect-square bg-gray-50 flex items-center justify-center relative">
              <ImageOff size={16} className="text-gray-300" />
              <div className="absolute bottom-1 left-1 bg-white/80 rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
                <ZoomIn size={7} />
                <span className="text-[7px]">Click to enlarge</span>
              </div>
              <div className="absolute -bottom-6 left-0">
                <div className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg">
                  A. Image Gallery
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="ring-2 ring-blue-400 rounded-lg p-2 mb-2 relative">
              <p className="text-[8px] font-bold text-gray-400 uppercase">Description</p>
              <p className="text-[8px] text-gray-500 mt-0.5">Chardonnay finish, recessed panel...</p>
              <div className="absolute -top-5 left-0">
                <div className="bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg">
                  B. Details
                </div>
              </div>
            </div>
            <div className="ring-2 ring-green-400 rounded-lg p-2 relative">
              <p className="text-[8px] font-bold text-gray-400 uppercase">Our Price</p>
              <p className="text-sm font-bold text-gray-900">$297.97</p>
              <p className="text-[8px] text-gray-400 line-through">Retail $399.99</p>
              <div className="mt-1 space-y-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-[8px] font-bold text-gray-400">SKU</span>
                  <span className="ring-1 ring-violet-300 rounded px-1 text-[8px] font-mono text-gray-600 flex items-center gap-0.5">
                    <Copy size={6} className="text-violet-400" /> ANIH-VF3021
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[8px] font-bold text-gray-400">Stock</span>
                  <span className="px-1 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[7px] font-bold">IN STOCK (5)</span>
                </div>
              </div>
              <div className="absolute -top-5 right-0">
                <div className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg">
                  C. Pricing & Info
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 border-t border-gray-100">
          <div className="ring-2 ring-red-400 rounded-lg overflow-hidden mt-2 mb-2 relative">
            <div className="flex border-b border-gray-100">
              <span className="text-[8px] font-medium text-gray-800 px-2 py-1.5 border-b-2 border-amber-400">More from Category</span>
              <span className="text-[8px] text-gray-400 px-2 py-1.5">Related Items</span>
              <span className="text-[8px] text-gray-400 px-2 py-1.5">Specifications</span>
              <span className="text-[8px] text-gray-400 px-2 py-1.5">Collection</span>
            </div>
            <div className="flex gap-1.5 p-2 overflow-hidden">
              {[1,2,3].map(i => (
                <div key={i} className="w-14 shrink-0 bg-gray-50 rounded-lg p-1">
                  <div className="aspect-square bg-gray-100 rounded mb-0.5" />
                  <p className="text-[6px] text-gray-600 leading-tight">Product...</p>
                </div>
              ))}
            </div>
            <div className="absolute -right-2 top-0 translate-x-full">
              <div className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg">
                D. Discovery Tabs
              </div>
            </div>
          </div>
        </div>

        <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between">
          <div className="ring-2 ring-purple-400 rounded-lg flex items-center gap-1 px-2 py-1 relative">
            <div className="flex items-center border border-gray-200 rounded text-[10px]">
              <span className="px-1 text-gray-400">-</span>
              <span className="px-1.5 font-bold border-x border-gray-200">1</span>
              <span className="px-1 text-gray-400">+</span>
            </div>
            <div className="bg-amber-500 text-white text-[9px] font-bold px-2 py-1 rounded flex items-center gap-0.5">
              <Plus size={8} /> Add to List
            </div>
            <div className="absolute -bottom-6 left-0">
              <div className="bg-violet-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg">
                E. Add to Quote List
              </div>
            </div>
          </div>
          <span className="text-[10px] text-gray-400 border border-gray-200 rounded px-2 py-1">Dismiss</span>
        </div>
        <div className="h-4" />
      </div>
    </div>
  );
}

function QuoteListDiagram() {
  return (
    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 overflow-hidden">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-[460px] mx-auto">
        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-bold text-gray-900">Quote List</p>
          <span className="text-[10px] text-gray-400">3 items</span>
        </div>

        <div className="ring-2 ring-amber-400 mx-3 mt-3 rounded-lg overflow-hidden relative">
          <table className="w-full text-[9px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500 uppercase">
                <th className="text-left px-2 py-1">Product</th>
                <th className="text-center px-2 py-1">Qty</th>
                <th className="text-right px-2 py-1">Price</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-t border-gray-50">
                <td className="px-2 py-1.5 font-medium">Vanity Cabinet 30x21</td>
                <td className="text-center px-2 py-1.5">
                  <span className="inline-flex items-center border rounded text-[8px]">
                    <span className="px-0.5 text-gray-300">-</span>
                    <span className="px-1 font-bold border-x">2</span>
                    <span className="px-0.5 text-gray-300">+</span>
                  </span>
                </td>
                <td className="text-right px-2 py-1.5 font-bold">$595.94</td>
              </tr>
              <tr className="border-t border-gray-50">
                <td className="px-2 py-1.5 font-medium">Undermount Sink 18"</td>
                <td className="text-center px-2 py-1.5">
                  <span className="inline-flex items-center border rounded text-[8px]">
                    <span className="px-0.5 text-gray-300">-</span>
                    <span className="px-1 font-bold border-x">1</span>
                    <span className="px-0.5 text-gray-300">+</span>
                  </span>
                </td>
                <td className="text-right px-2 py-1.5 font-bold">$149.99</td>
              </tr>
            </tbody>
          </table>
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full">
            <div className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg">
              A. Item List
            </div>
          </div>
        </div>

        <div className="ring-2 ring-emerald-400 mx-3 mt-3 mb-3 rounded-lg p-2 relative">
          <p className="text-[9px] font-bold text-gray-500 uppercase mb-1.5">Push to NetSuite Estimate</p>
          <div className="flex items-center gap-1">
            <div className="flex-1 flex items-center gap-1 bg-gray-50 rounded px-1.5 py-1">
              <Search size={8} className="text-gray-400" />
              <span className="text-[9px] text-gray-400">Search estimate # or customer...</span>
            </div>
            <div className="bg-sky-500 text-white text-[8px] font-bold px-2 py-1 rounded flex items-center gap-0.5">
              <Send size={7} /> Push
            </div>
          </div>
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full">
            <div className="bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg">
              B. Push to Estimate
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HowToUse3() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visual Guide</h1>
          <p className="text-sm text-gray-500">Step-by-step walkthrough with annotated screenshots</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-10">
        <p className="text-sm text-amber-900 leading-relaxed">
          This guide walks you through the Product Selector using annotated visuals. Each section highlights the key areas of the interface with <Highlight label="color-coded labels" /> so you know exactly where to look and click.
        </p>
      </div>

      <div className="space-y-14">

        <section>
          <SectionHeader number={1} title="Sign In" subtitle="Log in with your NetSuite employee credentials" />
          <LoginDiagram />
          <Callout color="bg-amber-50 text-amber-800">
            Enter the <strong>same email and password</strong> you use to log into NetSuite. Only authorized employees can access the Product Selector.
          </Callout>
        </section>

        <section>
          <SectionHeader number={2} title="Know Your Header" subtitle="The top bar has everything you need — categories, search, user menu, and quote list" />
          <HeaderDiagram />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1"><Highlight label="A" /> Category Tabs</p>
              <p className="text-xs text-amber-800">Hover over Bath, Home, or Plumbing to see a dropdown of all subcategories. Click to browse.</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs font-bold text-blue-700 mb-1 flex items-center gap-1"><Highlight label="B" color="blue" /> Search Bar</p>
              <p className="text-xs text-blue-800">Type a product name, SKU, or keyword. Results appear instantly as you type.</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-xs font-bold text-red-700 mb-1 flex items-center gap-1"><Highlight label="C" color="red" /> Special Sections</p>
              <p className="text-xs text-red-800">Quick access to Express Bath and Clearance products with dedicated views.</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1"><Highlight label="D" color="green" /> User Menu</p>
              <p className="text-xs text-emerald-800">Click your name to access Admin settings (if authorized) or Sign Out.</p>
            </div>
            <div className="bg-violet-50 rounded-xl p-3 sm:col-span-2">
              <p className="text-xs font-bold text-violet-700 mb-1 flex items-center gap-1"><Highlight label="E" color="purple" /> Quote List Badge</p>
              <p className="text-xs text-violet-800">Shows the number of items on your quote list. Click to open the full list page where you can review, edit quantities, and push to a NetSuite estimate.</p>
            </div>
          </div>
        </section>

        <section>
          <SectionHeader number={3} title="Browse & Filter Products" subtitle="Navigate categories and narrow down results with filters, search, and view options" />
          <ProductListingDiagram />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1"><Highlight label="1" /> Filters Button</p>
              <p className="text-xs text-amber-800">Click to expand attribute-based filters (finish, brand, size, etc.).</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs font-bold text-blue-700 mb-1 flex items-center gap-1"><Highlight label="2" color="blue" /> Refine Results</p>
              <p className="text-xs text-blue-800">Type here to search within the current category by name or SKU.</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1"><Highlight label="3" color="green" /> View Toggle</p>
              <p className="text-xs text-emerald-800">Switch between Grid view (large images) and List view (compact details).</p>
            </div>
            <div className="bg-violet-50 rounded-xl p-3">
              <p className="text-xs font-bold text-violet-700 mb-1 flex items-center gap-1"><Highlight label="4" color="purple" /> Facet Filters</p>
              <p className="text-xs text-violet-800">Select specific attribute values to narrow your product results.</p>
            </div>
          </div>
          <Callout color="bg-emerald-50 text-emerald-800">
            Use the <strong>In Stock</strong> toggle to quickly hide out-of-stock items. Green badges = in stock, amber = special order, red = out of stock.
          </Callout>
        </section>

        <section>
          <SectionHeader number={4} title="Product Detail Popup" subtitle="Click any product to see full details, images, pricing, and related items" />
          <ProductModalDiagram />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1"><Highlight label="A" /> Image Gallery</p>
              <p className="text-xs text-amber-800">Click "Click to enlarge" to open a full-screen lightbox. Multiple images show as thumbnails below.</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs font-bold text-blue-700 mb-1 flex items-center gap-1"><Highlight label="B" color="blue" /> Details</p>
              <p className="text-xs text-blue-800">Full product description and feature list pulled directly from NetSuite.</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1"><Highlight label="C" color="green" /> Pricing & Info</p>
              <p className="text-xs text-emerald-800">Our price, retail price, SKU (click to copy), manufacturer, and live stock status.</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3">
              <p className="text-xs font-bold text-red-700 mb-1 flex items-center gap-1"><Highlight label="D" color="red" /> Discovery Tabs</p>
              <p className="text-xs text-red-800">Browse more products from the same category, related items, specs, and collection.</p>
            </div>
            <div className="bg-violet-50 rounded-xl p-3 sm:col-span-2">
              <p className="text-xs font-bold text-violet-700 mb-1 flex items-center gap-1"><Highlight label="E" color="purple" /> Add to Quote List</p>
              <p className="text-xs text-violet-800">Set your quantity and click <strong>+ Add to List</strong>. The button turns green to confirm. If it's already on your list, you'll see quantity controls and a Remove option instead.</p>
            </div>
          </div>
        </section>

        <section>
          <SectionHeader number={5} title="Quote List & Push to Estimate" subtitle="Review your selections and send them to a NetSuite estimate" />
          <QuoteListDiagram />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div className="bg-amber-50 rounded-xl p-3">
              <p className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1"><Highlight label="A" /> Item List</p>
              <p className="text-xs text-amber-800">All added products with quantity controls and line totals. Adjust quantities or remove items directly.</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3">
              <p className="text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1"><Highlight label="B" color="green" /> Push to Estimate</p>
              <p className="text-xs text-emerald-800">Search for a NetSuite estimate by number or customer name, select it, then click Push to add all items.</p>
            </div>
          </div>
          <Callout color="bg-blue-50 text-blue-800">
            Your quote list is <strong>saved automatically</strong> in your browser. It persists across sessions — you won't lose it if you close the tab.
          </Callout>
          <Callout color="bg-red-50 text-red-800">
            Items without a valid NetSuite ID will show a warning and <strong>cannot be pushed</strong> to an estimate. These are rare but check for the alert before pushing.
          </Callout>
        </section>

        <section>
          <SectionHeader number={6} title="Special Sections" subtitle="Dedicated views for Express Bath, Clearance, and Admin" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border-2 border-amber-300 rounded-2xl p-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <Sparkles size={20} className="text-amber-600" />
              </div>
              <p className="text-sm font-bold text-gray-900 mb-1">Express Bath</p>
              <p className="text-xs text-gray-500 leading-relaxed">Quick-ship bath products organized by category: Cabinetry, Countertops, Sinks, and Fixtures. Filter with pill tabs at the top.</p>
            </div>
            <div className="bg-white border-2 border-emerald-300 rounded-2xl p-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <Tag size={20} className="text-emerald-600" />
              </div>
              <p className="text-sm font-bold text-gray-900 mb-1">Clearance</p>
              <p className="text-xs text-gray-500 leading-relaxed">All products with active promotional pricing. Green prices show the reduced amount with original retail crossed out.</p>
            </div>
            <div className="bg-white border-2 border-violet-300 rounded-2xl p-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mx-auto mb-3">
                <Shield size={20} className="text-violet-600" />
              </div>
              <p className="text-sm font-bold text-gray-900 mb-1">Admin Panel</p>
              <p className="text-xs text-gray-500 leading-relaxed">Managers can trigger data syncs, set the sync schedule, view uncategorized products, and update the hero image.</p>
            </div>
          </div>
        </section>

      </div>

      <div className="mt-14 bg-gray-900 rounded-2xl p-6 text-center">
        <p className="text-white/80 text-sm mb-3">You're all set! Start browsing products now.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          Go to Home Page
        </Link>
      </div>
    </div>
  );
}
