import { useParams, Link } from "wouter";
import { useGetCategories, getGetCategoryProductsQueryOptions } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Layers, Package, PackageX } from "lucide-react";

interface Product {
  id: number;
  name: string;
  sku: string | null;
  price: number | null;
}

function Level3Section({ id, name }: { id: number; name: string }) {
  const { data, isLoading } = useQuery({
    ...getGetCategoryProductsQueryOptions(id),
    enabled: true,
  });

  const products = data?.products ?? [];

  return (
    <div className="border-t border-border/60 pt-5 mt-5 first:border-0 first:pt-0 first:mt-0">
      <div className="flex items-center gap-2 mb-3">
        <Package size={14} className="text-accent shrink-0" />
        <h3 className="font-bold text-sm text-foreground uppercase tracking-wide">
          {name}
        </h3>
        {!isLoading && (
          <span className="ml-auto text-xs text-muted-foreground font-medium">
            {products.length} item{products.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-2 pl-4">
          <Loader2 size={12} className="animate-spin" />
          Loading...
        </div>
      ) : products.length === 0 ? (
        <p className="text-xs text-muted-foreground italic pl-4 py-1">No products found.</p>
      ) : (
        <div className="rounded-lg overflow-hidden border border-border/50">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-secondary/60 border-b border-border/50">
                <th className="px-4 py-2.5 font-bold text-xs uppercase tracking-wider text-muted-foreground w-[140px]">SKU</th>
                <th className="px-4 py-2.5 font-bold text-xs uppercase tracking-wider text-muted-foreground">Product Name</th>
                <th className="px-4 py-2.5 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right w-[120px]">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 bg-white">
              {products.map((p: Product) => (
                <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.sku || "—"}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-3 text-right font-bold text-accent text-sm">
                    {p.price != null ? `$${Number(p.price).toFixed(2)}` : <span className="font-normal text-muted-foreground text-xs">Call for price</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function CategoryOverview() {
  const { categoryId } = useParams();
  const id = Number(categoryId);

  const { data: categoryData, isLoading } = useGetCategories();
  const categories = categoryData?.categories || [];

  const category = categories.find((c) => c.id === id);
  const subCategories = category?.children || [];

  const totalProducts = subCategories.reduce(
    (acc, sub) => acc + (sub.children?.length ?? 0),
    0
  );

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-accent transition-colors mb-8"
      >
        <ArrowLeft size={16} />
        Back to Home
      </Link>

      {isLoading ? (
        <div className="py-32 flex flex-col items-center justify-center bg-white rounded-2xl border border-border shadow-sm">
          <Loader2 className="animate-spin text-accent mb-4" size={40} />
          <p className="text-primary font-medium text-lg">Loading categories...</p>
        </div>
      ) : !category ? (
        <div className="py-24 px-4 text-center border-2 border-dashed border-border rounded-2xl bg-white shadow-sm">
          <p className="text-muted-foreground">Category not found.</p>
          <Link href="/" className="mt-4 inline-block text-accent font-semibold hover:underline">
            Go back home
          </Link>
        </div>
      ) : (
        <>
          {/* Page Header */}
          <div className="mb-10 flex items-center gap-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white shrink-0">
              <Layers size={22} />
            </div>
            <div>
              <h1 className="text-4xl font-display font-bold text-primary uppercase tracking-tight">
                {category.name}
              </h1>
              <p className="text-muted-foreground mt-1 font-medium">
                {subCategories.length} subcategor{subCategories.length === 1 ? "y" : "ies"} · {totalProducts} product section{totalProducts !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {subCategories.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-border rounded-2xl bg-white shadow-sm">
              <PackageX className="mx-auto text-muted-foreground mb-4" size={36} />
              <p className="text-muted-foreground">No subcategories found in this section.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {subCategories.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden"
                >
                  {/* Level 2 Header */}
                  <div className="bg-primary px-6 py-4 flex items-center gap-3">
                    <h2 className="font-display font-bold text-white uppercase tracking-widest text-sm">
                      {sub.name}
                    </h2>
                    <div className="h-px flex-1 bg-white/20" />
                    <span className="text-xs text-white/60 font-medium">
                      {(sub.children || []).length} section{(sub.children || []).length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Level 3 + Products */}
                  <div className="px-6 py-5">
                    {(sub.children || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No sub-categories.</p>
                    ) : (
                      (sub.children || []).map((item) => (
                        <Level3Section key={item.id} id={item.id} name={item.name} />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
