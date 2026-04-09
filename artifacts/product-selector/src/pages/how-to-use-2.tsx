import { ArrowLeft, Search, MousePointer2, LayoutGrid, List, Filter, ClipboardList, Plus, Send, ZoomIn, Tag, Sparkles, Shield, ChevronRight, ShoppingCart, Copy, ToggleRight, Layers } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

const tutorials = [
  {
    id: "navigate",
    title: "Navigate Categories",
    icon: MousePointer2,
    color: "bg-blue-500",
    steps: [
      {
        title: "Hover over a top-level category",
        description: "The header shows three main categories: Bath, Home, and Plumbing. Hover over any one to reveal a mega-menu dropdown with all subcategories.",
      },
      {
        title: "Click a subcategory",
        description: "Select a subcategory from the dropdown to see a category overview page showing all the sub-sections within it.",
      },
      {
        title: "Browse deeper levels",
        description: "Click into a specific sub-section to land on the product listing page. Categories can be multiple levels deep — just keep drilling down.",
      },
      {
        title: "Use the breadcrumb trail",
        description: "At the top of every listing page, a breadcrumb trail shows your current location. Click any part of it to jump back up the hierarchy.",
      },
    ],
  },
  {
    id: "search",
    title: "Search for Products",
    icon: Search,
    color: "bg-amber-500",
    steps: [
      {
        title: "Click the search bar",
        description: "The search bar is always visible at the top center of the screen. Click into it and start typing a product name, SKU, or keyword.",
      },
      {
        title: "Review live suggestions",
        description: "As you type, the search bar shows matching products and categories in a dropdown. Products show their name, SKU, and price.",
      },
      {
        title: "Click a suggestion to open it",
        description: "Click any product in the dropdown to open its detail popup immediately, or click a category suggestion to jump to that category page.",
      },
      {
        title: "Press Enter for full results",
        description: "Press Enter to see all matching results on a dedicated search results page. This is useful when there are many matches.",
      },
    ],
  },
  {
    id: "filter",
    title: "Filter & Refine",
    icon: Filter,
    color: "bg-violet-500",
    steps: [
      {
        title: "Open the filters panel",
        description: "On any product listing page, click the Filters button to expand attribute-based filters like finish, size, brand, style, and more.",
      },
      {
        title: "Select filter values",
        description: "Click on any filter value to narrow the results. You can combine multiple filters — for example, selecting both a finish and a size.",
      },
      {
        title: "Toggle 'In Stock Only'",
        description: "Use the In Stock toggle to instantly hide all products that are out of stock. Only warehouse-available items will remain visible.",
      },
      {
        title: "Use 'Refine results'",
        description: "Type in the Refine results search box to further filter the visible products by name or SKU. This works on top of your active filters.",
      },
      {
        title: "Switch between Grid and List view",
        description: "Use the Grid and List icons at the top-right of the listing to change the display. Grid shows larger images; List is compact with more details.",
      },
    ],
  },
  {
    id: "product",
    title: "View Product Details",
    icon: ZoomIn,
    color: "bg-emerald-500",
    steps: [
      {
        title: "Click any product card",
        description: "Clicking a product anywhere in the app opens a detail popup with the full product information — images, description, pricing, and stock status.",
      },
      {
        title: "Browse the image gallery",
        description: "Products may have multiple images. Click the thumbnails below the main image to switch views, or use the left/right arrows.",
      },
      {
        title: "Zoom into images",
        description: "Click 'Click to enlarge' on the main image to open a full-screen lightbox. Navigate between images using the arrows or click outside to close.",
      },
      {
        title: "Copy the SKU",
        description: "Click the SKU badge to instantly copy it to your clipboard. A checkmark confirms it's been copied.",
      },
      {
        title: "Explore the bottom tabs",
        description: "Below the product info, four tabs let you discover more: 'More from this Category' shows sibling products, 'Related Items' shows linked products, 'Specifications' shows detailed specs, and 'Collection' groups products by manufacturer.",
      },
    ],
  },
  {
    id: "quote",
    title: "Build a Quote List",
    icon: ClipboardList,
    color: "bg-rose-500",
    steps: [
      {
        title: "Set the quantity",
        description: "In the product detail popup, use the + and - buttons at the bottom to set how many units you want before adding.",
      },
      {
        title: "Click '+ Add to List'",
        description: "Click the orange '+ Add to List' button. It turns green briefly to confirm the item has been added to your quote list.",
      },
      {
        title: "Adjust items already on the list",
        description: "If a product is already on your list, the popup footer shows 'On list' with quantity controls. Adjust up or down, or click Remove.",
      },
      {
        title: "Open your quote list",
        description: "Click the list icon (with the item count badge) in the top-right corner of the header to view your full quote list.",
      },
      {
        title: "Review totals and quantities",
        description: "The quote list page shows every item with its name, SKU, price, and quantity. The running total is calculated automatically.",
      },
    ],
  },
  {
    id: "estimate",
    title: "Push to NetSuite Estimate",
    icon: Send,
    color: "bg-sky-500",
    steps: [
      {
        title: "Open your quote list",
        description: "Navigate to the quote list by clicking the list icon in the header. Make sure you have items added.",
      },
      {
        title: "Find the Push section",
        description: "Below your list items, you'll see the Push to Estimate section. This is where you connect your list to a NetSuite estimate.",
      },
      {
        title: "Search for an estimate",
        description: "Type an estimate number or customer name into the search field. Matching estimates will appear for you to select.",
      },
      {
        title: "Select and push",
        description: "Click the correct estimate, then press 'Push to Estimate'. All items from your list will be added as line items on that NetSuite estimate.",
      },
      {
        title: "Check for warnings",
        description: "If any items are missing a NetSuite ID, the system will warn you before pushing. These items won't be included in the estimate.",
      },
    ],
  },
  {
    id: "special",
    title: "Special Sections",
    icon: Sparkles,
    color: "bg-orange-500",
    steps: [
      {
        title: "Express Bath",
        description: "Click 'Express Bath' in the top navigation to browse products in the Express Bath program. Use the category pill tabs (Cabinetry, Countertops, Sinks, Fixtures) to filter by type.",
      },
      {
        title: "Clearance",
        description: "Click 'Clearance' to see all products with active promotional pricing reductions. Clearance prices are highlighted in green with the original retail price crossed out.",
      },
      {
        title: "Internal",
        description: "The 'Internal' section contains products categorized for internal use. These are separate from the main customer-facing catalog.",
      },
      {
        title: "Admin panel (managers only)",
        description: "Click your name in the top-right, then 'Admin' to access the admin panel. Here you can trigger data syncs, set the sync schedule, view uncategorized products, and update the homepage hero image.",
      },
    ],
  },
];

function TutorialCard({ tutorial, isActive, onClick }: { tutorial: typeof tutorials[0]; isActive: boolean; onClick: () => void }) {
  const Icon = tutorial.icon;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
        isActive
          ? "bg-gray-900 text-white shadow-lg"
          : "bg-white hover:bg-gray-50 text-gray-700 border border-gray-100"
      }`}
    >
      <div className={`w-8 h-8 rounded-lg ${isActive ? "bg-white/20" : tutorial.color + "/10"} flex items-center justify-center shrink-0`}>
        <Icon size={16} className={isActive ? "text-white" : tutorial.color.replace("bg-", "text-")} />
      </div>
      <span className="text-sm font-medium">{tutorial.title}</span>
      <ChevronRight size={14} className={`ml-auto shrink-0 ${isActive ? "text-white/50" : "text-gray-300"}`} />
    </button>
  );
}

export default function HowToUse2() {
  const [activeId, setActiveId] = useState(tutorials[0].id);
  const active = tutorials.find(t => t.id === activeId) ?? tutorials[0];
  const ActiveIcon = active.icon;

  return (
    <div className="max-w-5xl mx-auto py-8 px-6">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Selector Tutorial</h1>
          <p className="text-sm text-gray-500">Interactive step-by-step guide</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-[260px] shrink-0 space-y-2">
          {tutorials.map(t => (
            <TutorialCard
              key={t.id}
              tutorial={t}
              isActive={activeId === t.id}
              onClick={() => setActiveId(t.id)}
            />
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className={`${active.color} px-6 py-5 flex items-center gap-3`}>
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <ActiveIcon size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{active.title}</h2>
                <p className="text-sm text-white/70">{active.steps.length} steps</p>
              </div>
            </div>

            <div className="p-6">
              <div className="relative">
                {active.steps.map((step, i) => (
                  <div key={i} className="flex gap-4 mb-0 last:mb-0">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full ${active.color} text-white flex items-center justify-center text-sm font-bold shrink-0`}>
                        {i + 1}
                      </div>
                      {i < active.steps.length - 1 && (
                        <div className="w-px flex-1 bg-gray-200 my-1" />
                      )}
                    </div>
                    <div className="pb-6 last:pb-0 flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm mb-1">{step.title}</p>
                      <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => {
                const idx = tutorials.findIndex(t => t.id === activeId);
                if (idx > 0) setActiveId(tutorials[idx - 1].id);
              }}
              disabled={activeId === tutorials[0].id}
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs text-gray-400">
              {tutorials.findIndex(t => t.id === activeId) + 1} of {tutorials.length}
            </span>
            <button
              onClick={() => {
                const idx = tutorials.findIndex(t => t.id === activeId);
                if (idx < tutorials.length - 1) setActiveId(tutorials[idx + 1].id);
              }}
              disabled={activeId === tutorials[tutorials.length - 1].id}
              className="px-4 py-2 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next Topic
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
