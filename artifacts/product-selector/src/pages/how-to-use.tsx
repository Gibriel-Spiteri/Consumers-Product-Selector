import { ArrowLeft, Search, MousePointer2, LayoutGrid, List, Filter, SlidersHorizontal, ClipboardList, Plus, Minus, Send, ShoppingCart, ZoomIn, Layers, Tag, Sparkles, Shield } from "lucide-react";
import { Link } from "wouter";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Step({ number, icon: Icon, title, children }: { number: number; icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 mb-5">
      <div className="shrink-0 w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold">
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Icon size={15} className="text-amber-500" />
          <p className="font-semibold text-gray-800 text-sm">{title}</p>
        </div>
        <div className="text-sm text-gray-600 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-5 flex items-start gap-2">
      <Sparkles size={15} className="shrink-0 mt-0.5 text-amber-500" />
      <div>{children}</div>
    </div>
  );
}

export default function HowToUse() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">How to Use</h1>
          <p className="text-sm text-gray-500">A quick guide to the Product Selector</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-2xl p-6 mb-10 border border-gray-100">
        <p className="text-sm text-gray-600 leading-relaxed">
          The Product Selector helps you quickly find products, compare options, and build a quote list that can be pushed directly into a NetSuite estimate. This guide covers everything you need to get started.
        </p>
      </div>

      <Section title="1. Browsing Categories">
        <Step number={1} icon={MousePointer2} title="Use the category tabs">
          The top navigation bar shows the main categories: <strong>Bath</strong>, <strong>Home</strong>, and <strong>Plumbing</strong>. Hover over any tab to see a dropdown with subcategories.
        </Step>
        <Step number={2} icon={Layers} title="Drill into subcategories">
          Click a subcategory to see its products. Some categories have multiple levels — keep clicking to narrow your selection.
        </Step>
        <Step number={3} icon={LayoutGrid} title="Switch between views">
          On a product listing page, use the <strong>Grid</strong> and <strong>List</strong> icons in the top-right to change how products are displayed.
        </Step>
        <Tip>Look for the item count at the top of each category page to know how many products are available.</Tip>
      </Section>

      <Section title="2. Searching for Products">
        <Step number={1} icon={Search} title="Use the search bar">
          The search bar at the top of every page lets you search by <strong>product name</strong>, <strong>SKU</strong>, or <strong>keywords</strong>. Suggestions appear as you type.
        </Step>
        <Step number={2} icon={MousePointer2} title="Click a suggestion or press Enter">
          Click a product suggestion to open it directly, or press <strong>Enter</strong> to see all matching results on the search page.
        </Step>
      </Section>

      <Section title="3. Filtering Products">
        <Step number={1} icon={Filter} title="Use the Filters button">
          On any product listing page, click <strong>Filters</strong> to expand the attribute filters. These let you narrow results by things like finish, size, brand, and more.
        </Step>
        <Step number={2} icon={SlidersHorizontal} title="Toggle In Stock Only">
          Use the <strong>In Stock</strong> toggle to show only products that are currently available in the warehouse.
        </Step>
        <Step number={3} icon={Search} title="Refine results">
          Use the <strong>Refine results</strong> search box to further filter the visible products by name or SKU.
        </Step>
      </Section>

      <Section title="4. Viewing Product Details">
        <Step number={1} icon={MousePointer2} title="Click any product">
          Clicking a product opens a detail popup with the full description, images, pricing, and availability.
        </Step>
        <Step number={2} icon={ZoomIn} title="Zoom into images">
          Click on the product image to open a full-screen lightbox. Use the arrows to browse additional images when available.
        </Step>
        <Step number={3} icon={Layers} title="Explore related products">
          At the bottom of the popup, browse the <strong>More from this Category</strong>, <strong>Related Items</strong>, <strong>Specifications</strong>, and <strong>Collection</strong> tabs to discover similar products.
        </Step>
        <Tip>Click any SKU to instantly copy it to your clipboard.</Tip>
      </Section>

      <Section title="5. Building a Quote List">
        <Step number={1} icon={Plus} title="Add products to your list">
          In the product detail popup, set the quantity and click <strong>+ Add to List</strong>. The button turns green to confirm.
        </Step>
        <Step number={2} icon={Minus} title="Adjust quantities">
          Already on the list? Use the <strong>+</strong> and <strong>-</strong> buttons to change quantities, or click <strong>Remove</strong> to take it off.
        </Step>
        <Step number={3} icon={ClipboardList} title="Review your list">
          Click the <strong>list icon</strong> in the top-right corner of the header to open your full quote list. You'll see all items, quantities, and pricing.
        </Step>
        <Tip>Your quote list is saved automatically and persists between sessions — you won't lose it if you close the browser.</Tip>
      </Section>

      <Section title="6. Pushing to a NetSuite Estimate">
        <Step number={1} icon={ShoppingCart} title="Open your quote list">
          Navigate to the quote list page by clicking the list icon in the header.
        </Step>
        <Step number={2} icon={Search} title="Search for an estimate">
          In the push section, search for an existing NetSuite estimate by <strong>estimate number</strong> or <strong>customer name</strong>.
        </Step>
        <Step number={3} icon={Send} title="Push items">
          Select the estimate and click <strong>Push to Estimate</strong>. Your list items will be added directly to that NetSuite estimate.
        </Step>
        <Tip>Make sure all items have a valid NetSuite ID before pushing. The system will warn you if any are missing.</Tip>
      </Section>

      <Section title="7. Special Sections">
        <Step number={1} icon={Sparkles} title="Express Bath">
          Click <strong>Express Bath</strong> in the top navigation to browse the Express Bath program products, organized by category with quick filters.
        </Step>
        <Step number={2} icon={Tag} title="Clearance">
          Click <strong>Clearance</strong> to see all products with active promotional pricing. Clearance prices are highlighted in green.
        </Step>
        <Step number={3} icon={Shield} title="Admin (managers only)">
          Admins can access the <strong>Admin</strong> page from the user menu to trigger data syncs, manage the sync schedule, and update the homepage hero image.
        </Step>
      </Section>

      <div className="bg-gray-900 rounded-2xl p-6 text-center">
        <p className="text-white/80 text-sm mb-3">Ready to get started?</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          Start Browsing
        </Link>
      </div>
    </div>
  );
}
