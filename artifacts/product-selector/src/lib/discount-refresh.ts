// After a push, NetSuite recalculates the estimate's discounts and deposit (2026-11-09, Gib: "Pushing from the CPS
// should recalc PRAs on the Estimate"). These are the words staff see under the push message.
export interface DiscountNote {
  state: "running" | "done" | "warn";
  text: string;
}

export function discountRefreshRunning(tranId: string): DiscountNote {
  return { state: "running", text: `Recalculating the discounts on ${tranId} in NetSuite. This can take a minute; keep this page open.` };
}

// What POST /api/estimates/:id/refresh-discounts answered (api-server lib/estimateRefresh.ts).
export function discountNoteFor(data: { status?: string; warning?: string | null }, tranId: string): DiscountNote {
  if (data.warning) {
    return { state: "warn", text: `Check the discounts on ${tranId} in NetSuite: ${data.warning}` };
  }
  if (data.status === "repriced") {
    return { state: "done", text: `Discounts recalculated on ${tranId} in NetSuite, and its deposit updated.` };
  }
  if (data.status === "saved") {
    return { state: "done", text: `${tranId} updated in NetSuite: no line discounts to reprice, deposit updated.` };
  }
  if (data.status === "notsaved") {
    return { state: "warn", text: `NetSuite could not save ${tranId} after the push. Edit and Save it in NetSuite so its deposit updates.` };
  }
  return { state: "warn", text: `NetSuite did not confirm the update on ${tranId}. Check its discounts and deposit in NetSuite.` };
}

// The refresh request failed (an error answer, or no answer at all).
export function discountRefreshFailed(tranId: string, error: string | null): DiscountNote {
  if (error === null) {
    return {
      state: "warn",
      text: `Lost contact while NetSuite was recalculating ${tranId}. It may still finish: check its discounts and deposit in NetSuite in a minute.`,
    };
  }
  return {
    state: "warn",
    text: `${error} Open ${tranId} in NetSuite, press Apply All on its Discounts tab if a discount is off, then Edit and Save it.`,
  };
}
