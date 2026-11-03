import type { SpecialOrderDetails, SpecialOrderProductLine, SpecialOrderType } from "@workspace/api-zod";
import { AddEstimateItemsBody } from "@workspace/api-zod";
import { executeSuiteQL } from "./netsuite";

type TypeRecord = SpecialOrderType & { classId: string | null };
const TTL = 5 * 60 * 1000;
let productLinesCache: { expires: number; data: SpecialOrderProductLine[] } | undefined;
const typesCache = new Map<string, { expires: number; data: TypeRecord[] }>();

export class SpecialOrderValidationError extends Error {}

// Orval currently emits z.number() for OpenAPI integers; enforce whole quantities explicitly.
export const EstimateItemsSchema = AddEstimateItemsBody.superRefine((value, ctx) => {
  value.items.forEach((item, index) => {
    if (!Number.isInteger(item.quantity)) {
      ctx.addIssue({ code: "custom", path: ["items", index, "quantity"], message: "Quantity must be a whole number" });
    }
  });
});

export function positiveId(value: unknown): string {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new SpecialOrderValidationError("Invalid NetSuite identifier");
  }
  return value;
}

export async function getSpecialOrderProductLines(fresh = false): Promise<SpecialOrderProductLine[]> {
  if (!fresh && productLinesCache && productLinesCache.expires > Date.now()) return productLinesCache.data;
  const result = await executeSuiteQL<{ id: string; name: string; itemid: string; sku: string }>(`
    SELECT pl.id, pl.name, i.id AS itemid, i.itemid AS sku
    FROM customrecord_pl pl
    INNER JOIN item i ON i.custitem_prodline = pl.id
    WHERE pl.isinactive = 'F' AND i.isinactive = 'F' AND i.itemid LIKE 'SP-%'
      AND UPPER(BUILTIN.DF(pl.custrecord_pl_type)) = 'INVENTORY'
      AND EXISTS (
        SELECT 1 FROM customrecord_specord_nondb_types st
        WHERE st.custrecord_specord_nondb_type_prodline = pl.id AND st.isinactive = 'F'
      )
    ORDER BY pl.name, i.itemid
  `);
  // Do not silently pick an arbitrary special-order item when a product line has several.
  const counts = new Map<string, number>();
  for (const row of result.items) counts.set(String(row.id), (counts.get(String(row.id)) ?? 0) + 1);
  const data = result.items.map(row => ({
    id: String(row.id),
    name: counts.get(String(row.id))! > 1 ? `${row.name} (${row.sku})` : row.name,
    netsuiteItemId: String(row.itemid),
    sku: row.sku,
  }));
  productLinesCache = { data, expires: Date.now() + TTL };
  return data;
}

export async function getSpecialOrderTypes(productLineId: string, fresh = false): Promise<TypeRecord[]> {
  const id = positiveId(productLineId);
  const cached = typesCache.get(id);
  if (!fresh && cached && cached.expires > Date.now()) return cached.data;
  const result = await executeSuiteQL<{
    id: string; name: string; classid: string | null; requiresattachment: string | null;
  }>(`
    SELECT id, name, custrecord_specord_nondb_type_class AS classid,
      BUILTIN.DF(custrecord_specord_nondb_type_reqattach) AS requiresattachment
    FROM customrecord_specord_nondb_types
    WHERE custrecord_specord_nondb_type_prodline = ${id} AND isinactive = 'F'
    ORDER BY name
  `);
  const data = result.items.map(row => ({
    id: String(row.id), name: row.name,
    classId: row.classid ? String(row.classid) : null,
    requiresAttachment: row.requiresattachment?.toLowerCase() === "yes",
  }));
  // Bound cache size even if many arbitrary IDs are requested.
  if (typesCache.size >= 500) typesCache.clear();
  typesCache.set(id, { data, expires: Date.now() + TTL });
  return data;
}

export function specialOrderLine(
  itemId: string,
  quantity: number,
  details: SpecialOrderDetails,
  productLine: SpecialOrderProductLine,
  type: TypeRecord,
) {
  if (productLine.id !== details.productLineId || productLine.netsuiteItemId !== itemId || type.id !== details.typeId) {
    throw new SpecialOrderValidationError("The special-order item, product line and Type do not match");
  }
  if (![details.model, details.description, details.color].every(s => s.trim())) {
    throw new SpecialOrderValidationError("Model, Collection / Description and Color are required");
  }
  return {
    item: { id: itemId },
    quantity,
    custcol_specord_prodline: { id: productLine.id },
    custcol_specord_type: { id: type.id },
    ...(type.classId ? { custcol_specord_class: { id: type.classId } } : {}),
    custcol_specord_model: details.model.trim(),
    custcol_specord_style: details.description.trim(),
    custcol_specord_color: details.color.trim(),
    custcol_list_selling_rate: details.listPrice,
    custcol_list_selling_amt: Math.round(details.listPrice * quantity * 100) / 100,
    // List Price is not a selling rate. Leave NetSuite's price level/rate sourcing intact.
  };
}
