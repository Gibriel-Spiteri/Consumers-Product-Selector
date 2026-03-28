import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetCategories, getGetCategoryProductsQueryOptions } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, PackageX, Loader2, ArrowLeft, ImageOff } from "lucide-react";
import { useCategoryPath } from "@/hooks/use-category-path";
import ProductModal from "@/components/product-modal";

interface Product {
  id: number;
  name: string;
  sku: string | null;
  price: number | null;
  categoryId?: number | null;
  netsuiteId?: string | null;
}

function ProductThumbnail({ id, name }: { id: number; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="w-12 h-12 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0">
        <ImageOff size={14} className="text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={`https://picsum.photos/seed/product-${id}/96/96`}
      alt={name}
      onError={() => setFailed(true)}
      className="w-12 h-12 rounded-lg object-cover border border-border shrink-0"
    />
  );
}

export default function CategoryProducts() {
  const { categoryId } = useParams();
  const id = Number(categoryId);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const { data: productsData, isLoading: isLoadingProducts } = useQuery({
    ...getGetCategoryProductsQueryOptions(id),
    enabled: !!id,
  });

  const { data: categoriesData } = useGetCategories();
  const path = useCategoryPath(categoriesData?.categories || [], id);
  const categoryPath = path.map(c => c.name).join(" › ");

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">

      <ProductModal
        product={selectedProduct}
        categoryPath={categoryPath}
        onClose={() => setSelectedProduct(null)}
      />

      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-10 overflow-x-auto whitespace-nowrap pb-2">
        <Link href="/" className="hover:text-accent transition-colors flex items-center gap-1.5">
          <ArrowLeft size={16} />
          Back to Home
        </Link>
        <div className="w-px h-4 bg-border mx-2"></div>
        {path.map((cat, index) => (
          <div key={cat.id} className="flex items-center gap-2">
            <span className={index === path.length - 1 ? "text-primary font-bold px-3 py-1 bg-white rounded-md shadow-sm border border-border" : ""}>
              {cat.name}
            </span>
            {index < path.length - 1 && <ChevronRight size={14} className="text-muted-foreground/50" />}
          </div>
        ))}
      </nav>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-primary uppercase tracking-tight">
          {path.length > 0 ? path[path.length - 1].name : "Products"}
        </h1>
        <p className="text-muted-foreground mt-2 font-medium">
          Showing {productsData?.products.length || 0} items · click any row for details
        </p>
      </div>

      {/* Product List */}
      {isLoadingProducts ? (
        <div className="py-32 flex flex-col items-center justify-center bg-white rounded-2xl border border-border shadow-sm">
          <Loader2 className="animate-spin text-accent mb-4" size={40} />
          <p className="text-primary font-medium text-lg">Loading products...</p>
        </div>
      ) : !productsData?.products || productsData.products.length === 0 ? (
        <div className="py-24 px-4 text-center border-2 border-dashed border-border rounded-2xl bg-white shadow-sm flex flex-col items-center">
          <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-6">
            <PackageX size={32} className="text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-display font-bold text-primary uppercase tracking-tight mb-2">No products found</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            There are currently no items available in this category. Try selecting a different category from the menu above.
          </p>
          <Link href="/" className="mt-8 px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-accent transition-colors shadow-md inline-block">
            Browse Categories
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-border shadow-md shadow-black/5 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-secondary/80 border-b-2 border-border">
                  <th className="px-4 lg:px-6 py-4 font-display font-bold uppercase tracking-wider text-primary w-16"></th>
                  <th className="px-4 lg:px-6 py-4 font-display font-bold uppercase tracking-wider text-primary w-[150px] whitespace-nowrap">Item SKU</th>
                  <th className="px-4 lg:px-6 py-4 font-display font-bold uppercase tracking-wider text-primary">Product Details</th>
                  <th className="px-4 lg:px-6 py-4 font-display font-bold uppercase tracking-wider text-primary text-right w-[160px] whitespace-nowrap">MSRP Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {productsData.products.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-4 lg:px-6 py-4">
                      <ProductThumbnail id={p.id} name={p.name} />
                    </td>
                    <td className="px-4 lg:px-6 py-4 font-mono text-muted-foreground font-medium group-hover:text-primary transition-colors whitespace-nowrap">
                      {p.sku || 'N/A'}
                    </td>
                    <td className="px-4 lg:px-6 py-4 font-semibold text-foreground text-base group-hover:text-primary transition-colors">
                      {p.name}
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-right whitespace-nowrap">
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
