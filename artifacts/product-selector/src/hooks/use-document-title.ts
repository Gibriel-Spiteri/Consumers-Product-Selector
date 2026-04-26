import { useEffect } from "react";

const DEFAULT_TITLE = "Consumers Product Selector";

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    const previous = document.title;
    document.title = title && title.trim().length > 0 ? title : DEFAULT_TITLE;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
