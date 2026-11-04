import { useState } from "react";
import { AlertCircle, Info, Loader2, RotateCcw } from "lucide-react";
import {
  useGetSpecialOrderProductLines,
  useGetSpecialOrderTypes,
  getGetSpecialOrderProductLinesQueryKey,
  getGetSpecialOrderTypesQueryKey,
} from "@workspace/api-client-react";
import type { PriceBasis, QuoteItem, SpecialOrderInput } from "@/context/quote-list-context";
import { cn, fmtPrice } from "@/lib/utils";
import { specialOrderPrices } from "@/lib/special-order-pricing";
import { specialOrderLookupRetry } from "@/lib/special-order-query";
import ProductLineLogos from "@/components/product-line-logos";
import SpecialOrderCategories from "@/components/special-order-categories";
import type { SpecialOrderPrefill } from "@/lib/vendor-picks";

// NetSuite's Model / Coll/Desc / Color columns are Free-Form Text, 300 characters each.
const LIMITS = { model: 300, color: 300, description: 300 };
const PER_ORDER_FORM = "Per Attached Order Form";
const typedSpec = (v: string | undefined) => (v && v !== PER_ORDER_FORM ? v : "");
const MAX_PRICE = 99999999;
const MAX_QTY = 1000000;
// 2026-11-04: replaced by "always start on Retail" (Gib). Was: remember the rep's last Retail / CRD choice.
// const BASIS_KEY = "ps_so_price_basis";
// function lastBasis(): PriceBasis {
//   try {
//     return localStorage.getItem(BASIS_KEY) === "crd" ? "crd" : "retail";
//   } catch {
//     return "retail";
//   }
// }

type Errors = Partial<Record<"productLine" | "type" | "quantity" | "model" | "description" | "color" | "listPrice", string>>;

const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 focus:bg-white transition-all disabled:opacity-60";
const labelCls = "block text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5";

function FieldError({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return <p id={id} role="alert" className="mt-1 text-[12px] text-red-600">{msg}</p>;
}

export default function SpecialOrderForm({ initial, prefill, onSubmit, onCancel, categoriesAboveForm = false }: {
  initial?: QuoteItem;
  // A product a customer picked on a vendor website (Consumers Quote Helper extension); the rep confirms it.
  prefill?: SpecialOrderPrefill;
  onSubmit: (input: SpecialOrderInput) => void;
  onCancel: () => void;
  categoriesAboveForm?: boolean;
}) {
  const so = initial?.specialOrder;
  const [selectedItemId, setSelectedItemId] = useState(initial?.netsuiteId ?? prefill?.netsuiteItemId ?? "");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [typeId, setTypeId] = useState(so?.typeId ?? "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? prefill?.quantity ?? 1));
  // Typed specs only; an order-form line's "Per Attached Order Form" is not carried into the inputs.
  const [model, setModel] = useState(typedSpec(so?.model ?? prefill?.model));
  const [description, setDescription] = useState(typedSpec(so?.description ?? prefill?.description));
  const [color, setColor] = useState(typedSpec(so?.color ?? prefill?.color));
  const [listPrice, setListPrice] = useState(so ? String(so.listPrice) : prefill?.listPrice != null ? String(prefill.listPrice) : "");
  // 2026-11-04: a new special order always starts on Retail (Gib); editing keeps the line's choice.
  // Was: initial ? (initial.priceBasis ?? "retail") : lastBasis()
  const [priceBasis, setPriceBasis] = useState<PriceBasis>(initial?.priceBasis ?? "retail");
  const [errors, setErrors] = useState<Errors>({});

  const lines = useGetSpecialOrderProductLines({ query: { queryKey: getGetSpecialOrderProductLinesQueryKey(), ...specialOrderLookupRetry } });
  const line = lines.data?.find(l => l.netsuiteItemId === selectedItemId);
  const categories = Array.from(new Map(
    (lines.data ?? []).flatMap(l => l.categories ?? []).map(c => [c.id, c] as const)
  ).values()).sort((a, b) => a.name.localeCompare(b.name));
  const visibleLines = (lines.data ?? []).filter(l =>
    !selectedCategory || l.categories?.some(c => c.id === selectedCategory)
  );
  const selectCategory = (id: string) => {
    setSelectedCategory(id);
    if (line && id && !line.categories?.some(c => c.id === id)) {
      setSelectedItemId("");
      setTypeId("");
    }
  };
  const productLineId = line?.id ?? "";
  const types = useGetSpecialOrderTypes(productLineId, {
    query: { enabled: !!productLineId, queryKey: getGetSpecialOrderTypesQueryKey(productLineId), ...specialOrderLookupRetry },
  });

  const type = types.data?.find(t => t.id === typeId);
  // A Type that requires an attachment takes an order form instead of typed specs, as NetSuite's Item Options
  // popup does: Model, Color and Collection / Description are locked to "Per Attached Order Form".
  const perOrderForm = !!type?.requiresAttachment;
  const staleLine = !!so && selectedItemId === initial?.netsuiteId && lines.isSuccess && !line;
  const typedPrice = Number(listPrice.trim());
  const preview = line && listPrice.trim() && Number.isFinite(typedPrice) && typedPrice > 0
    ? specialOrderPrices(Math.round(typedPrice * 100) / 100, line) : null;

  const validate = (): SpecialOrderInput | null => {
    const e: Errors = {};
    // const m = model.trim(), d = description.trim(), c = color.trim();
    const [m, d, c] = perOrderForm ? [PER_ORDER_FORM, PER_ORDER_FORM, PER_ORDER_FORM] : [model.trim(), description.trim(), color.trim()];
    const q = Number(quantity);
    const p = Number(listPrice.trim());
    if (!line) e.productLine = "Select a product line.";
    if (!type) e.type = "Select a type.";
    if (!/^\d+$/.test(quantity.trim()) || !Number.isInteger(q) || q < 1 || q > MAX_QTY) e.quantity = `Enter a whole number from 1 to ${MAX_QTY.toLocaleString()}.`;
    if (!m) e.model = "Model is required."; else if (m.length > LIMITS.model) e.model = `Max ${LIMITS.model} characters.`;
    if (!d) e.description = "Collection / description is required."; else if (d.length > LIMITS.description) e.description = `Max ${LIMITS.description} characters.`;
    if (!c) e.color = "Color is required."; else if (c.length > LIMITS.color) e.color = `Max ${LIMITS.color} characters.`;
    if (!listPrice.trim() || !Number.isFinite(p) || p < 0 || p > MAX_PRICE) e.listPrice = `Enter a price from 0 to ${MAX_PRICE.toLocaleString()}.`;
    setErrors(e);
    if (Object.keys(e).length > 0 || !line || !type) return null;
    return {
      netsuiteId: line.netsuiteItemId,
      sku: line.sku || null,
      quantity: q,
      details: {
        productLineId: line.id,
        productLineName: line.name.trim(),
        typeId: type.id,
        typeName: type.name.trim(),
        model: m,
        description: d,
        color: c,
        listPrice: Math.round(p * 100) / 100,
      },
      priceBasis,
    };
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const v = validate();
    if (!v) return;
    // 2026-11-04: no longer remembered; new lines always start on Retail.
    // try {
    //   localStorage.setItem(BASIS_KEY, v.priceBasis);
    // } catch {
    //   // ignore storage errors
    // }
    onSubmit(v);
  };

  const aria = (k: keyof Errors) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `so-err-${k}` : undefined });

  const categoryFilters = categories.length > 0 && (
        <div className={categoriesAboveForm ? "mb-6" : "px-6 py-4 border-b border-gray-100"}>
          <SpecialOrderCategories categories={categories} selected={selectedCategory} onSelect={selectCategory} />
        </div>
      );

  return (
    <>
      {categoriesAboveForm && categoryFilters}
      {categoriesAboveForm && selectedCategory && <ProductLineLogos lines={visibleLines} />}
      <form onSubmit={submit} noValidate className="bg-white rounded-2xl border border-gray-100 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200" data-testid="form-special-order" aria-label={initial ? "Edit special order" : "Add special order"}>
      <div className="px-6 py-5 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-[15px] mb-1">{initial ? "Edit Special Order" : "Add Special Order"}</h3>
        <p className="text-[13px] text-gray-400">Choose a product line first, then its type. The selling price is list price x the product line's multipliers, the same as NetSuite.</p>
        {prefill && !initial && (
          <div className="mt-3 flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-[13px] text-blue-900" role="status" data-testid="text-vendor-prefill">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>
              Filled in from the{" "}
              <a href={prefill.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline font-medium">vendor page</a>.
              {" "}{prefill.netsuiteItemId ? "" : prefill.candidateNames.length > 1
                ? `Pick the product line (${prefill.candidateNames.join(" or ")}). `
                : "Pick the product line. "}
              Choose the Type and check the list price: a vendor site can show a sale price.
            </span>
          </div>
        )}
      </div>
      {!categoriesAboveForm && categoryFilters}
      <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="so-line" className={labelCls}>Product Line</label>
          {lines.isLoading || (lines.isFetching && lines.isError) ? (
            <div className="h-[42px] rounded-xl bg-gray-100 animate-pulse" aria-label="Loading product lines" />
          ) : lines.isError ? (
            <div className="flex items-center gap-2 text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle size={14} /> Could not load product lines.
              <button type="button" onClick={() => lines.refetch()} className="ml-auto flex items-center gap-1 font-medium hover:opacity-70" data-testid="button-retry-lines">
                <RotateCcw size={12} /> Retry
              </button>
            </div>
          ) : (
            <select id="so-line" value={selectedItemId} onChange={e => { setSelectedItemId(e.target.value); setTypeId(""); }} className={inputCls} {...aria("productLine")} data-testid="select-product-line">
              <option value="">{visibleLines.length ? "Select a product line" : "No product lines available"}</option>
              {visibleLines.map(l => <option key={l.netsuiteItemId} value={l.netsuiteItemId}>{l.name}</option>)}
            </select>
          )}
          {staleLine && <p className="mt-1 text-[12px] text-amber-700">"{so?.productLineName}" is no longer available. Choose another product line.</p>}
          <FieldError id="so-err-productLine" msg={errors.productLine} />
        </div>

        <div>
          <label htmlFor="so-type" className={labelCls}>Type</label>
          {productLineId && (types.isLoading || (types.isFetching && types.isError)) ? (
            <div className="h-[42px] rounded-xl bg-gray-100 animate-pulse" aria-label="Loading types" />
          ) : types.isError ? (
            <div className="flex items-center gap-2 text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle size={14} /> Could not load types.
              <button type="button" onClick={() => types.refetch()} className="ml-auto flex items-center gap-1 font-medium hover:opacity-70" data-testid="button-retry-types">
                <RotateCcw size={12} /> Retry
              </button>
            </div>
          ) : (
            <select id="so-type" value={typeId} disabled={!productLineId} onChange={e => { setTypeId(e.target.value); setErrors(prev => ({ ...prev, type: undefined, model: undefined, color: undefined, description: undefined })); }} className={inputCls} {...aria("type")} data-testid="select-type">
              <option value="">{!productLineId ? "Select a product line first" : types.data?.length ? "Select a type" : "No types for this product line"}</option>
              {types.data?.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <FieldError id="so-err-type" msg={errors.type} />
        </div>

        {type?.requiresAttachment && (
          <div className="md:col-span-2 flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-800 animate-in fade-in duration-200" role="status" data-testid="text-requires-attachment">
            <Info size={14} className="shrink-0 mt-0.5" />
            {/* <span>The {type.name} type requires an attachment. Add it to the estimate in NetSuite after pushing.</span> */}
            <span>The {type.name} type requires an order form, so Model, Color and Collection / Description are set to "{PER_ORDER_FORM}". Attach the order form to the estimate in NetSuite after pushing.</span>
          </div>
        )}

        <div>
          <label htmlFor="so-model" className={labelCls}>Model</label>
          <input id="so-model" value={perOrderForm ? PER_ORDER_FORM : model} disabled={perOrderForm} maxLength={LIMITS.model} onChange={e => setModel(e.target.value)} className={inputCls} {...aria("model")} data-testid="input-model" />
          <FieldError id="so-err-model" msg={errors.model} />
        </div>
        <div>
          <label htmlFor="so-color" className={labelCls}>Color</label>
          <input id="so-color" value={perOrderForm ? PER_ORDER_FORM : color} disabled={perOrderForm} maxLength={LIMITS.color} onChange={e => setColor(e.target.value)} className={inputCls} {...aria("color")} data-testid="input-color" />
          <FieldError id="so-err-color" msg={errors.color} />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="so-desc" className={labelCls}>Collection / Description</label>
          <textarea id="so-desc" rows={3} value={perOrderForm ? PER_ORDER_FORM : description} disabled={perOrderForm} maxLength={LIMITS.description} onChange={e => setDescription(e.target.value)} className={cn(inputCls, "resize-y")} {...aria("description")} data-testid="input-description" />
          <FieldError id="so-err-description" msg={errors.description} />
        </div>
        <div>
          <label htmlFor="so-qty" className={labelCls}>Quantity</label>
          <input id="so-qty" type="number" inputMode="numeric" min={1} max={MAX_QTY} step={1} value={quantity} onChange={e => setQuantity(e.target.value)} className={inputCls} {...aria("quantity")} data-testid="input-quantity" />
          <FieldError id="so-err-quantity" msg={errors.quantity} />
        </div>
        <div>
          <label htmlFor="so-price" className={labelCls}>List Price (each)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
            <input id="so-price" type="number" inputMode="decimal" min={0} max={MAX_PRICE} step="0.01" value={listPrice} onChange={e => setListPrice(e.target.value)} className={cn(inputCls, "pl-7")} {...aria("listPrice")} data-testid="input-list-price" />
          </div>
          <FieldError id="so-err-listPrice" msg={errors.listPrice} />
          {/* Was: both prices.
          {preview && (
            <p className="mt-1 text-[12px] text-gray-500" data-testid="text-selling-price-preview">
              Selling price each: <span className="font-medium text-gray-800">Retail ${fmtPrice(preview.retail)}</span>, CRD ${fmtPrice(preview.crd)}
            </p>
          )} */}
          {preview && (
            <p className="mt-1 text-[12px] text-gray-500" data-testid="text-selling-price-preview">
              Selling price each: <span className="font-medium text-gray-800">${fmtPrice(preview[priceBasis])} {priceBasis === "retail" ? "Retail" : "CRD"}</span>
            </p>
          )}
        </div>
        <div className="md:col-span-2">
          <span className={labelCls} id="so-basis-label">Price As</span>
          <div role="radiogroup" aria-labelledby="so-basis-label" className="inline-flex p-1 bg-gray-100 rounded-xl" data-testid="toggle-price-basis">
            {(["retail", "crd"] as const).map(b => (
              <button
                key={b}
                type="button"
                role="radio"
                aria-checked={priceBasis === b}
                onClick={() => setPriceBasis(b)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-lg transition-colors",
                  priceBasis === b ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800",
                )}
                data-testid={`button-price-basis-${b}`}
              >
                {b === "retail" ? "Retail" : "CRD"}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[12px] text-gray-400">Sets the price shown in the quote list. The estimate is still priced by its customer (Retail or CRD), as in NetSuite.</p>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-xl transition-colors" data-testid="button-cancel-special-order">Cancel</button>
        <button type="submit" disabled={lines.isLoading} className="flex items-center gap-1.5 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-xl hover:bg-gray-700 transition-colors disabled:opacity-50" data-testid="button-save-special-order">
          {lines.isLoading && <Loader2 size={14} className="animate-spin" />}
          {initial ? "Save Changes" : "Add to List"}
        </button>
      </div>
    </form>
    </>
  );
}
