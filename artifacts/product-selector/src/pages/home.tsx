import { Building2, ArrowRight, PackageSearch, Layers, Zap } from "lucide-react";
import { Link } from "wouter";
import { useGetCategories } from "@workspace/api-client-react";

export default function Home() {
  const { data } = useGetCategories();
  const categories = data?.categories || [];
  const level1 = categories.filter(c => c.level === 1);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12 lg:py-16">
      {/* Hero Section */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl mb-16 bg-primary">
        {/* modern bright kitchen interior with white cabinets */}
        <img 
          src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1920&q=80&fit=crop" 
          alt="Modern Kitchen Hero" 
          className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/90 to-transparent"></div>
        
        <div className="relative z-10 p-10 sm:p-16 lg:p-24 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent text-white text-xs font-bold uppercase tracking-widest mb-8 shadow-lg">
            <Zap size={14} className="fill-current" />
            Live Catalog
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-white uppercase tracking-tight leading-[1.1] mb-6">
            Find the perfect product for your next project
          </h2>
          <p className="text-lg sm:text-xl text-primary-foreground/80 font-medium leading-relaxed mb-10 max-w-2xl">
            Browse our extensive catalog of bath, kitchen, plumbing, and home products. Synchronized directly with NetSuite for real-time inventory precision.
          </p>
          
          <div className="flex items-center gap-4 text-sm font-semibold text-white/60 uppercase tracking-wider">
            <ArrowRight className="animate-pulse text-accent" />
            Select a category above to start browsing
          </div>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-border hover:shadow-md transition-shadow group">
          <div className="w-14 h-14 bg-secondary rounded-xl flex items-center justify-center text-primary mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300">
            <Layers size={28} />
          </div>
          <h3 className="text-xl font-display font-bold text-foreground mb-3 uppercase tracking-wide">Deep Hierarchy</h3>
          <p className="text-muted-foreground leading-relaxed">
            Navigate through our comprehensive 3-level catalog structure designed to help you find exactly what you need with precision.
          </p>
        </div>
        
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-border hover:shadow-md transition-shadow group">
          <div className="w-14 h-14 bg-secondary rounded-xl flex items-center justify-center text-primary mb-6 group-hover:scale-110 group-hover:bg-accent group-hover:text-white transition-all duration-300">
            <PackageSearch size={28} />
          </div>
          <h3 className="text-xl font-display font-bold text-foreground mb-3 uppercase tracking-wide">Instant Search</h3>
          <p className="text-muted-foreground leading-relaxed">
            Know exactly what you're looking for? Use our powerful search tool to find products instantly by name or exact SKU match.
          </p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-border hover:shadow-md transition-shadow group">
          <div className="w-14 h-14 bg-secondary rounded-xl flex items-center justify-center text-primary mb-6 group-hover:scale-110 group-hover:bg-green-600 group-hover:text-white transition-all duration-300">
            <Building2 size={28} />
          </div>
          <h3 className="text-xl font-display font-bold text-foreground mb-3 uppercase tracking-wide">NetSuite Powered</h3>
          <p className="text-muted-foreground leading-relaxed">
            Our data flows directly from NetSuite ERP via a secure Machine-to-Machine connection, ensuring you always see accurate information.
          </p>
        </div>
      </div>
      
      {/* Quick Categories */}
      {level1.length > 0 && (
        <div>
          <h3 className="text-2xl font-display font-bold text-primary mb-8 uppercase tracking-tight flex items-center gap-3">
            Quick Categories
            <div className="h-0.5 flex-1 bg-border rounded-full"></div>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {level1.slice(0, 6).map(cat => (
              <div key={cat.id} className="bg-white border border-border rounded-xl p-6 text-center hover:border-accent hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-default">
                <span className="font-bold text-sm text-foreground uppercase tracking-wider">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
