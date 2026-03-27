import { useParams, Link } from "wouter";
import { useGetCategories } from "@workspace/api-client-react";
import { ChevronRight, Loader2, ArrowLeft, Layers } from "lucide-react";

export default function CategoryOverview() {
  const { categoryId } = useParams();
  const id = Number(categoryId);

  const { data: categoryData, isLoading } = useGetCategories();
  const categories = categoryData?.categories || [];

  const category = categories.find((c) => c.id === id);
  const subCategories = category?.children || [];

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
          <div className="mb-10 flex items-center gap-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white shrink-0">
              <Layers size={22} />
            </div>
            <div>
              <h1 className="text-4xl font-display font-bold text-primary uppercase tracking-tight">
                {category.name}
              </h1>
              <p className="text-muted-foreground mt-1 font-medium">
                {subCategories.length} subcategor{subCategories.length === 1 ? "y" : "ies"}
              </p>
            </div>
          </div>

          {subCategories.length === 0 ? (
            <div className="py-20 text-center border-2 border-dashed border-border rounded-2xl bg-white shadow-sm text-muted-foreground">
              No subcategories found in this section.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {subCategories.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-white rounded-2xl border border-border shadow-sm p-6 hover:shadow-md hover:border-accent/30 transition-all"
                >
                  <h2 className="font-display font-bold text-primary uppercase tracking-wide text-sm border-b-2 border-accent/30 pb-3 mb-4">
                    {sub.name}
                  </h2>
                  <ul className="space-y-2">
                    {(sub.children || []).map((item) => (
                      <li key={item.id}>
                        <Link
                          href={`/products/${item.id}`}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center group py-0.5"
                        >
                          <ChevronRight
                            size={13}
                            className="opacity-0 -ml-3.5 group-hover:opacity-100 group-hover:ml-0 transition-all text-accent mr-1 shrink-0"
                          />
                          {item.name}
                        </Link>
                      </li>
                    ))}
                    {(sub.children || []).length === 0 && (
                      <li className="text-xs text-muted-foreground italic">No items</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
