import type { SpecialOrderProductLine } from "@workspace/api-client-react";

export interface SpecialOrderPrices {
  retail: number;
  crd: number;
}

// NetSuite's special-order selling rate (salesorder.js, and api-server specialOrderRate, which the push uses):
// List Price x product line cost multiplier x (Retail or CRD multiplier), rounded to the cent. The API already
// turns a blank or zero multiplier into 1. Keep the multiplication order so the cents match NetSuite exactly.
export function specialOrderPrices(listPrice: number, line: SpecialOrderProductLine): SpecialOrderPrices {
  const rate = (customerMulti: number) =>
    listPrice > 0 ? Math.round(listPrice * line.costMultiplier * customerMulti * 100) / 100 : 0;
  return { retail: rate(line.retailMultiplier), crd: rate(line.crdMultiplier) };
}
