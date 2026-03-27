import { useMemo } from "react";
import type { Category } from "@workspace/api-client-react";

export function useCategoryPath(categories: Category[], targetId: number | null) {
  return useMemo(() => {
    if (!targetId || !categories || categories.length === 0) return [];

    function findPath(cats: Category[], id: number): Category[] {
      for (const cat of cats) {
        if (cat.id === id) return [cat];
        if (cat.children && cat.children.length > 0) {
          const path = findPath(cat.children, id);
          if (path.length > 0) return [cat, ...path];
        }
      }
      return [];
    }

    return findPath(categories, targetId);
  }, [categories, targetId]);
}
