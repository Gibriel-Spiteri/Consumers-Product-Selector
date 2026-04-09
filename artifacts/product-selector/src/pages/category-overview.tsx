import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetCategories } from "@workspace/api-client-react";
import { ChevronRight, ChevronDown, Loader2, ArrowLeft } from "lucide-react";
import { useCategoryPath } from "@/hooks/use-category-path";

function linkForCategory(cat: { id: number; children?: unknown[] }) {
  const hasChildren = cat.children && cat.children.length > 0;
  return hasChildren ? `/category/${cat.id}` : `/products/${cat.id}`;
}

function CollapsibleCard({ sub, children }: { sub: { id: number; name: string; children?: unknown[] }; children: { id: number; name: string; children?: unknown[] }[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = children.length > 0;

  return (
    <div
      className="bg-white rounded-2xl border border-border shadow-sm p-6 hover:shadow-md hover:border-accent/30 transition-all"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className="flex items-center justify-between">
        <Link
          href={linkForCategory(sub)}
          className="block font-display font-bold text-primary uppercase tracking-wide text-sm border-b-2 border-accent/30 pb-3 mb-1 hover:text-accent transition-colors flex-1"
        >
          {sub.name}
        </Link>
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="ml-2 p-1 -mr-1 mb-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>
      {hasChildren && (
        <div
          className="overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: expanded ? `${children.length * 36 + 16}px` : "0px", opacity: expanded ? 1 : 0 }}
        >
          <ul className="space-y-2 pt-3">
            {children.map((item) => (
              <li key={item.id}>
                <Link
                  href={linkForCategory(item as { id: number; children?: unknown[] })}
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
          </ul>
        </div>
      )}
      {!hasChildren && (
        <p className="text-xs text-gray-300 mt-2">No subcategories</p>
      )}
    </div>
  );
}

export default function CategoryOverview() {
  const { categoryId } = useParams();
  const id = Number(categoryId);

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

  const parentLink = path.length > 1 ? `/category/${path[path.length - 2].id}` : "/";

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
      <nav className="flex items-center gap-1 text-[12px] text-gray-400 mb-4 overflow-x-auto whitespace-nowrap">
        <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
        {path.map((cat, i) => (
          <span key={cat.id} className="flex items-center gap-1">
            <ChevronRight size={11} className="text-gray-300" />
            {i < path.length - 1 ? (
              <Link href={`/category/${cat.id}`} className="hover:text-gray-600 transition-colors">
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
            <div className="py-20 text-center border-2 border-dashed border-border rounded-2xl bg-white shadow-sm text-muted-foreground">
              No subcategories found in this section.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {subCategories.map((sub) => {
                const children = sub.children || [];
                return (
                  <CollapsibleCard key={sub.id} sub={sub} children={children} />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
