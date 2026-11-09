import type { VendorConversionRow } from "@workspace/api-zod";

type Meta = Record<string, unknown>;
export interface ConversionEvent {
  id: number;
  employeeId: string | null;
  eventType: string;
  metadata: unknown;
}

export const trackingId = (value: unknown): string | null =>
  typeof value === "string" && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : null;

export function vendorDomain(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z0-9.-]+$/i.test(value)) return "";
  const parts = value.toLowerCase().replace(/\.$/, "").split(".").filter(Boolean);
  const twoPart = /^(co|com|net|org|gov|ac)\.[a-z]{2}$/.test(parts.slice(-2).join("."));
  return parts.slice(twoPart ? -3 : -2).join(".");
}

const meta = (value: unknown): Meta => value && typeof value === "object" && !Array.isArray(value) ? value as Meta : {};

/** No joins on names, URL similarity, session, recency, or employee alone. */
export function buildVendorConversions(events: ConversionEvent[]): VendorConversionRow[] {
  const groups = new Map<string, {
    row: VendorConversionRow;
    stages: Set<string>[];
  }>();
  const group = (event: ConversionEvent, domain: string) => {
    const employeeId = event.employeeId ?? "anonymous";
    const key = JSON.stringify([employeeId, domain]);
    let g = groups.get(key);
    if (!g) {
      g = { row: {
        vendorDomain: domain || "Unattributed vendor", employeeId, employeeName: employeeId,
        opens: 0, captures: 0, adds: 0, pushes: 0, visits: 0,
        capturedVisits: 0, addedVisits: 0, pushedVisits: 0, unlinkedActions: 0,
      }, stages: [new Set(), new Set(), new Set(), new Set()] };
      groups.set(key, g);
    }
    return g;
  };
  // Duplicate/reused identifiers are ambiguous, even if their labels agree.
  const openings = new Map<string, ConversionEvent[]>();
  const captures = new Map<string, Array<{ event: ConversionEvent; visitId: string | null; domain: string; productLineId: unknown }>>();
  const adds = new Map<string, Array<{ event: ConversionEvent; visitId: string | null; domain: string; productLineId: unknown }>>();
  for (const event of events) {
    const m = meta(event.metadata);
    if (event.eventType === "vendor_site_visit") {
      const id = trackingId(m.visitId);
      if (id) openings.set(id, [...(openings.get(id) ?? []), event]);
    }
    if (event.eventType === "quickadd_capture") {
      const picks = Array.isArray(m.picks) ? m.picks : Array.isArray(m.pickIds) ? m.pickIds.map(pickId => ({ pickId })) : [];
      for (const raw of picks) {
        const p = meta(raw);
        const id = trackingId(p.pickId);
        if (id) captures.set(id, [...(captures.get(id) ?? []), {
          event, visitId: trackingId(m.visitId), domain: vendorDomain(m.vendorDomain), productLineId: p.productLineId,
        }]);
      }
    }
    if (event.eventType === "add_to_list") {
      const id = trackingId(m.pickId);
      if (id) adds.set(id, [...(adds.get(id) ?? []), {
        event, visitId: trackingId(m.visitId), domain: vendorDomain(m.vendorDomain), productLineId: m.productLineId,
      }]);
    }
  }
  const linkedOpen = (event: ConversionEvent, visitId: string | null, domain: string) => {
    const found = visitId ? openings.get(visitId) : undefined;
    return !!(domain && event.employeeId && found?.length === 1 && found[0].employeeId === event.employeeId
      && vendorDomain(meta(found[0].metadata).vendorDomain) === domain);
  };
  const linkedCapture = (event: ConversionEvent, m: Meta, domain: string) => {
    const id = trackingId(m.pickId);
    const found = id ? captures.get(id) : undefined;
    return !!(found?.length === 1 && found[0].event.employeeId === event.employeeId
      && found[0].domain === domain && found[0].visitId === trackingId(m.visitId)
      && (!found[0].productLineId || found[0].productLineId === m.productLineId)
      && linkedOpen(event, trackingId(m.visitId), domain));
  };
  for (const event of events) {
    const m = meta(event.metadata);
    if (event.eventType === "push_to_estimate") {
      const lines = Array.isArray(m.specialOrderLines) ? m.specialOrderLines.map(meta) : [];
      if (Array.isArray(m.specialOrderLines) && !lines.length) continue; // known catalog-only send
      // One send action can touch several vendors, but counts only once per vendor/user.
      const domains = new Set(lines.map(line => vendorDomain(line.vendorDomain)));
      if (!domains.size) domains.add("");
      for (const domain of domains) {
        const g = group(event, domain);
        g.row.pushes++;
        let linked = false;
        for (const line of lines.filter(line => vendorDomain(line.vendorDomain) === domain)) {
          const id = trackingId(line.pickId);
          const found = id ? adds.get(id) : undefined;
          if (linkedCapture(event, line, domain) && found?.length === 1
            && found[0].event.employeeId === event.employeeId && found[0].domain === domain
            && found[0].productLineId === line.productLineId && found[0].visitId === trackingId(line.visitId)) {
            g.stages[3].add(String(line.visitId));
            linked = true;
          }
        }
        if (!linked) g.row.unlinkedActions++;
      }
      continue;
    }
    if (event.eventType === "add_to_list" && !m.productLineId && !m.pickId) continue; // catalog add
    const stage = ["vendor_site_visit", "quickadd_capture", "add_to_list"].indexOf(event.eventType);
    if (stage < 0) continue;
    const domain = vendorDomain(m.vendorDomain);
    const g = group(event, domain);
    if (stage === 0) g.row.opens++;
    if (stage === 1) g.row.captures++;
    if (stage === 2) g.row.adds++;
    const visitId = trackingId(m.visitId);
    const linked = stage === 2 ? linkedCapture(event, m, domain) && adds.get(String(m.pickId))?.length === 1
      : linkedOpen(event, visitId, domain);
    if (linked && visitId) g.stages[stage].add(visitId);
    else g.row.unlinkedActions++;
  }
  return [...groups.values()].map(({ row, stages }) => ({
    ...row, visits: stages[0].size, capturedVisits: stages[1].size,
    addedVisits: stages[2].size, pushedVisits: stages[3].size,
  })).sort((a, b) => b.opens - a.opens || a.vendorDomain.localeCompare(b.vendorDomain));
}
