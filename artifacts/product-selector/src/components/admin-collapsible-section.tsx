import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export default function AdminCollapsibleSection({ title, preview, children }: {
  title: string;
  preview?: ReactNode;
  children: ReactNode;
}) {
  return (
    <details className="group bg-white rounded-xl border border-gray-200">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {preview && <div className="mt-2 group-open:hidden">{preview}</div>}
        </div>
        <ChevronDown size={20} aria-hidden="true" className="shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-6 pb-6">{children}</div>
    </details>
  );
}
