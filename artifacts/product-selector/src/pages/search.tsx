import { useParams, Link } from "wouter";
import { getSearchProductsQueryOptions } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2, ArrowLeft, PackageX } from "lucide-react";

export default function SearchPage() {
  const { query } = useParams();
  const q = decodeURIComponent(query || '');

  const { data: productsData, isLoading } = useQuery({
    ...getSearchProductsQueryOptions({ q }),
    enabled: !!q,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-accent transition-colors mb-8">
        <ArrowLeft size={16} />
        Back to Home
      </Link>

      <div className="mb-8 bg-white p-8 rounded-2xl border border-border shadow-sm flex items-center gap-6">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
          <Search size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-primary uppercase tracking-tight">
            Search Results
          </h1>
          <p className="text-muted-foreground mt-1 font-medium text-lg">
            Showing results for <span className="text-foreground font-bold italic">"{q}"</span>
          </p>
        </div>
      </div>

      {isLoading ? (
         <div className="py-32 flex flex-col items-center justify-center bg-white rounded-2xl border border-border shadow-sm">
           <Loader2 className="animate-spin text-accent mb-4" size={40} />
           <p className="text-primary font-medium text-lg">Searching catalog...</p>
         </div>
      ) : !productsData?.products || productsData.products.length === 0 ? (
         <div className="py-24 px-4 text-center border-2 border-dashed border-border rounded-2xl bg-white shadow-sm flex flex-col items-center">
           <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-6">
             <PackageX size={32} className="text-muted-foreground" />
           </div>
           <h3 className="text-2xl font-display font-bold text-primary uppercase tracking-tight mb-2">No matching products</h3>
           <p className="text-muted-foreground max-w-md mx-auto">
             We couldn't find any products matching "{q}". Try checking your spelling or using broader search terms.
           </p>
         </div>
      ) : (
         <div className="bg-white border border-border shadow-md shadow-black/5 rounded-2xl overflow-hidden">
           <div className="overflow-x-auto">
             <table className="w-full text-left text-sm whitespace-nowrap">
               <thead>
                 <tr className="bg-secondary/80 border-b-2 border-border">
                   <th className="px-6 lg:px-8 py-5 font-display font-bold uppercase tracking-wider text-primary w-[150px]">Item SKU</th>
                   <th className="px-6 lg:px-8 py-5 font-display font-bold uppercase tracking-wider text-primary">Product Details</th>
                   <th className="px-6 lg:px-8 py-5 font-display font-bold uppercase tracking-wider text-primary text-right w-[200px]">MSRP Price</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-border">
                 {productsData.products.map(p => (
                   <tr key={p.id} className="hover:bg-blue-50/50 transition-colors group">
                     <td className="px-6 lg:px-8 py-5 font-mono text-muted-foreground font-medium group-hover:text-primary transition-colors">
                       {p.sku || 'N/A'}
                     </td>
                     <td className="px-6 lg:px-8 py-5 font-semibold text-foreground text-base">
                       {p.name}
                     </td>
                     <td className="px-6 lg:px-8 py-5 text-right">
                       <span className="inline-block px-3 py-1 bg-secondary rounded-md font-bold text-accent border border-border group-hover:bg-white group-hover:border-accent/30 transition-colors">
                         {p.price ? `$${Number(p.price).toFixed(2)}` : 'Call for price'}
                       </span>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         </div>
      )}
    </div>
  );
}
