import { useEffect } from "react";
import { useParams, useLocation, Link, Redirect } from "wouter";
import { useGetCategories } from "@workspace/api-client-react";
import { ChevronRight, Loader2, ArrowLeft } from "lucide-react";
import { useCategoryPath } from "@/hooks/use-category-path";
import { trackCategoryView } from "@/lib/analytics";
import {
  categoryHref,
  categoryOverviewHref,
  categoryProductsHref,
  parseCategoryIdParam,
} from "@/lib/category-url";

export default function CategoryOverview() {
  const { categorySlug } = useParams();
  const id = parseCategoryIdParam(categorySlug);
  const [, setLocation] = useLocation();

  const { data: categoryData, isLoading } = useGetCategories();
  const categories = categoryData?.categories || [];

  function findCategoryDeep(cats: typeof categories, targetId: number): (typeof categories)[0] | undefined {
    for (const cat of cats) {
      if (cat.id === targetId) return cat;
      if (cat.children) {
        const found = findCategoryDeep(cat.children as typeof categories, targetId);
        if (found) return found;
      }
    }
    return undefined;
  }

  const category = findCategoryDeep(categories, id);
  const subCategories = category?.children || [];
  const path = useCategoryPath(categories, id);

  const canonicalHref = category ? categoryOverviewHref(category) : null;
  useEffect(() => {
    if (!canonicalHref || !categorySlug) return;
    if (`/category/${categorySlug}` !== canonicalHref) {
      setLocation(canonicalHref, { replace: true });
    }
  }, [canonicalHref, categorySlug, setLocation]);

  useEffect(() => {
    if (Number.isFinite(id) && canonicalHref) trackCategoryView(canonicalHref, id);
  }, [id, canonicalHref]);

  const parentLink = path.length > 1 ? categoryOverviewHref(path[path.length - 2]) : "/";

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
      <nav className="flex items-center gap-1 text-[12px] text-gray-400 mb-4 overflow-x-auto whitespace-nowrap">
        <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
        {path.map((cat, i) => (
          <span key={cat.id} className="flex items-center gap-1">
            <ChevronRight size={11} className="text-gray-300" />
            {i < path.length - 1 ? (
              <Link href={categoryOverviewHref(cat)} className="hover:text-gray-600 transition-colors">
                {cat.name}
              </Link>
            ) : (
              <span className="text-gray-600">{cat.name}</span>
            )}
          </span>
        ))}
      </nav>

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
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-gray-900">
              {category.name}
            </h1>
            <p className="text-[13px] text-gray-400 mt-1">{subCategories.length} {subCategories.length === 1 ? "subcategory" : "subcategories"}</p>
          </div>

          {subCategories.length === 0 ? (
            <Redirect to={categoryProductsHref(category)} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {subCategories.map((sub) => (
                <div
                  key={sub.id}
                  className="bg-white rounded-2xl border border-border shadow-sm p-6 hover:shadow-md hover:border-accent/30 transition-all"
                >
                  <Link
                    href={categoryHref(sub)}
                    className="block font-display font-bold text-primary uppercase tracking-wide text-sm border-b-2 border-accent/30 pb-3 mb-4 hover:text-accent transition-colors"
                  >
                    {sub.name}
                  </Link>
                  {(sub.children || []).length > 0 && (
                    <ul className="space-y-2">
                      {(sub.children || []).map((item) => (
                        <li key={item.id}>
                          <Link
                            href={categoryHref(item as { id: number; name?: string; children?: unknown[] })}
                            className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center group py-0.5"
                          >
                            <ChevronRight
                              size={13}
                              className="opacity-0 -ml-3.5 group-hover:opacity-100 group-hover:ml-0 transition-all text-accent mr-1 shrink-0"
                            />
                            {(item as { name: string }).name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
