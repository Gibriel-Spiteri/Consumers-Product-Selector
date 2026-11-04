import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Category = { id: string; name: string };

export default function SpecialOrderCategories({ categories, selected, onSelect }: {
  categories: Category[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const groups = new Map<string, Array<Category & { label: string }>>();
  for (const category of categories) {
    const separator = category.name.indexOf(" - ");
    const group = separator >= 0 ? category.name.slice(0, separator) : "Other";
    const label = separator >= 0 ? category.name.slice(separator + 3) : category.name;
    const entries = groups.get(group) ?? [];
    entries.push({ ...category, label });
    groups.set(group, entries);
  }

  return (
    <section aria-label="Special-order categories">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-[15px] font-semibold text-gray-800">Browse by category</h2>
        <button
          type="button"
          aria-pressed={!selected}
          onClick={() => onSelect("")}
          className={cn(
            "rounded-lg px-3 py-2 text-[12px] font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B4DA8] focus-visible:ring-offset-2",
            !selected ? "border-[#7B4DA8] bg-[#7B4DA8] text-white" : "border-gray-200 bg-white text-[#7B4DA8] hover:bg-purple-50"
          )}
        >
          All categories
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {Array.from(groups).sort(([a], [b]) => a.localeCompare(b)).map(([group, entries]) => (
          <fieldset key={group} className="min-w-0 rounded-xl border border-gray-200 bg-gray-50/70 p-3">
            <legend className="px-1 text-[13px] font-bold uppercase tracking-widest text-gray-500">{group}</legend>
            <div className="space-y-1">
              {entries.sort((a, b) => a.label.localeCompare(b.label)).map(category => {
                const active = selected === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    title={category.name}
                    aria-label={category.name}
                    aria-pressed={active}
                    onClick={() => onSelect(category.id)}
                    className={cn(
                      "w-full min-h-11 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-[13px] leading-5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B4DA8] focus-visible:ring-offset-2",
                      active ? "border-[#7B4DA8] bg-[#7B4DA8] text-white shadow-sm" : "border-transparent text-gray-700 hover:border-purple-200 hover:bg-white"
                    )}
                  >
                    <span>{category.label}</span>
                    {active && <Check size={15} className="shrink-0" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </section>
  );
}
