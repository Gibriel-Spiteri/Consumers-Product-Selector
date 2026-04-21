import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2, PackageX } from "lucide-react";

interface OrphanedAttribute {
  id: number;
  netsuiteId: string | null;
  productNetsuiteId: string;
  attributeName: string;
  attributeValue: string;
  attributeValueId: string | null;
  sortOrder: number | null;
  isFilter: boolean | null;
  createdAt: string;
}

export default function WithoutAttributesProducts() {
  const { data, isLoading } = useQuery({
    queryKey: ["orphanedAttributes"],
    queryFn: async () => {
      const res = await fetch("/api/attributes/orphaned");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json() as Promise<{ attributes: OrphanedAttribute[] }>;
    },
  });

  const attributes = data?.attributes ?? [];

  if (isLoading) {
    return (
      <div className="max-w-screen-xl mx-auto px-6 py-16 flex flex-col items-center gap-3 text-gray-400">
        <Loader2 className="animate-spin" size={28} />
        <p className="text-sm">Loading orphaned attributes…</p>
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-6 py-8">
      <nav className="flex items-center gap-1.5 text-[13px] text-gray-400 mb-6">
        <Link href="/" className="hover:text-gray-600 transition-colors">Home</Link>
        <ChevronRight size={12} />
        <span className="text-gray-900 font-medium">Orphaned Attributes</span>
      </nav>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orphaned Attributes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {attributes.length} attribute row{attributes.length !== 1 ? "s" : ""} not associated with any product
          </p>
        </div>
      </div>

      {attributes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <PackageX size={40} className="mb-3" />
          <p className="text-lg font-medium text-gray-500">No orphaned attributes</p>
          <p className="text-sm mt-1">Every attribute row is linked to an existing product.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Product NetSuite ID</th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Attribute</th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Value</th>
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400 text-right">Filter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {attributes.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-mono text-[12px] text-gray-700 whitespace-nowrap">{a.productNetsuiteId}</td>
                    <td className="px-5 py-3 text-gray-900">{a.attributeName}</td>
                    <td className="px-5 py-3 text-gray-700">{a.attributeValue}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {a.isFilter ? (
                        <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Yes</span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">No</span>
                      )}
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
