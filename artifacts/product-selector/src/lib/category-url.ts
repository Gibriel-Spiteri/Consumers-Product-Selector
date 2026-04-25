export function slugifyCategoryName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface CategoryLike {
  id: number;
  name?: string | null;
  children?: unknown[];
}

export function categoryOverviewHref(cat: { id: number; name?: string | null }): string {
  const slug = slugifyCategoryName(cat.name);
  return slug ? `/category/${slug}-${cat.id}` : `/category/${cat.id}`;
}

export function categoryProductsHref(cat: { id: number; name?: string | null }): string {
  const slug = slugifyCategoryName(cat.name);
  return slug ? `/products/${slug}-${cat.id}` : `/products/${cat.id}`;
}

export function categoryHref(cat: CategoryLike): string {
  const hasChildren = Array.isArray(cat.children) && cat.children.length > 0;
  return hasChildren ? categoryOverviewHref(cat) : categoryProductsHref(cat);
}

export function parseCategoryIdParam(param: string | undefined | null): number {
  if (!param) return NaN;
  const s = String(param);
  if (/^\d+$/.test(s)) return Number(s);
  const match = s.match(/-(\d+)$/);
  if (!match) return NaN;
  return Number(match[1]);
}

const BARE_CATEGORY_URL = /^\/(?:category|products)\/\d+$/;
export function isBareCategoryUrl(path: string): boolean {
  return BARE_CATEGORY_URL.test(path);
}
