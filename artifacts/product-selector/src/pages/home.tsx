import { Building2, ArrowRight, PackageSearch, Layers } from "lucide-react";
import { Link } from "wouter";
import { useGetCategories } from "@workspace/api-client-react";

export default function Home() {
  const { data } = useGetCategories();
  const categories = data?.categories || [];
  const level1 = categories.filter(c => c.level === 1);

  return (
    <div>
      {/* Full-bleed Hero */}
      <div className="relative w-full h-[420px] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1920&q=80&fit=crop"
          alt="Modern Kitchen"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-transparent" />
        <div className="relative z-10 h-full flex flex-col justify-center px-10 lg:px-20 max-w-2xl">
          <span className="text-amber-400 text-[11px] font-bold uppercase tracking-[0.2em] mb-4">
            New Collection 2025
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Elevate Your<br />Living Spaces.
          </h2>
          <p className="text-white/75 text-sm lg:text-base leading-relaxed max-w-md">
            Discover premium fixtures and finishes for your next home renovation project. Sourced globally, curated locally.
          </p>
          <div className="flex items-center gap-2 mt-6 text-white/50 text-xs font-semibold uppercase tracking-widest">
            <ArrowRight size={13} className="text-amber-400" />
            Select a category above to start browsing
          </div>
        </div>
      </div>

      {/* Below-hero content */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12 lg:py-16">

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-border hover:shadow-md transition-shadow group">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-primary mb-5 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300">
              <Layers size={24} />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2 uppercase tracking-wide">Deep Hierarchy</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Navigate through our comprehensive 3-level catalog structure to find exactly what you need with precision.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-border hover:shadow-md transition-shadow group">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-primary mb-5 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
              <PackageSearch size={24} />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2 uppercase tracking-wide">Instant Search</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Find products instantly by name or exact SKU match using our smart type-ahead search.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-border hover:shadow-md transition-shadow group">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-primary mb-5 group-hover:scale-110 group-hover:bg-green-600 group-hover:text-white transition-all duration-300">
              <Building2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2 uppercase tracking-wide">NetSuite Powered</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Data flows directly from NetSuite ERP via a secure Machine-to-Machine connection for real-time accuracy.
            </p>
          </div>
        </div>

        {/* Quick Categories */}
        {level1.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-5 flex items-center gap-3">
              Browse Categories
              <div className="h-px flex-1 bg-border rounded-full" />
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {level1.map(cat => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.id}`}
                  className="bg-white border border-border rounded-xl p-5 text-center hover:border-amber-400 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                >
                  <span className="font-semibold text-xs text-foreground uppercase tracking-wider">{cat.name}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
