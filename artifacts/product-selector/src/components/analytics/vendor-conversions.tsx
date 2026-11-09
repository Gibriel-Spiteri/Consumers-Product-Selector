import { useState } from "react";
import { useGetVendorConversions, getGetVendorConversionsQueryKey, type GetVendorConversionsParams, type VendorConversionRow } from "@workspace/api-client-react";

type Count = "opens" | "captures" | "adds" | "pushes" | "visits" | "capturedVisits" | "addedVisits" | "pushedVisits" | "unlinkedActions";
const columns: [Count, string][] = [
  ["opens", "Open actions"], ["captures", "Capture actions"], ["adds", "Add actions"], ["pushes", "Send actions"],
  ["visits", "Distinct visits"], ["capturedVisits", "With capture"], ["addedVisits", "With list add"],
  ["pushedVisits", "With estimate send"], ["unlinkedActions", "Unlinked actions"],
];

export function VendorConversions({ range, includeAdmins }: {
  range: NonNullable<GetVendorConversionsParams["range"]>; includeAdmins: boolean;
}) {
  const [vendor, setVendor] = useState("");
  const [employee, setEmployee] = useState("");
  const params: GetVendorConversionsParams = {
    range, includeAdmins: includeAdmins ? "1" : "0",
  };
  const { data, isLoading, isError, refetch, isFetching } = useGetVendorConversions(params,
    { query: { queryKey: getGetVendorConversionsQueryKey(params), staleTime: 0, refetchOnMount: "always", refetchInterval: 30000 } });
  const rows = data?.rows ?? [];
  const vendors = [...new Set(rows.map(row => row.vendorDomain))].sort();
  const people = [...new Map(rows.map(row => [row.employeeId, row.employeeName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1]));
  const shown = rows.filter(row => (!vendor || row.vendorDomain === vendor) && (!employee || row.employeeId === employee));
  const totals = Object.fromEntries(columns.map(([key]) => [key, shown.reduce((sum, row) => sum + row[key], 0)])) as Record<Count, number>;
  const rate = (row: Pick<VendorConversionRow, "visits" | "pushedVisits">) =>
    row.visits ? `${(100 * row.pushedVisits / row.visits).toFixed(1)}%` : "—";
  return (
    <section className="border border-gray-200 rounded-xl p-4 space-y-3" data-testid="vendor-conversions">
      <div className="flex justify-between gap-3 flex-wrap">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">Vendor visits → special-order estimates</h4>
          <p className="text-xs text-gray-500 mt-1">Uses the selected date range and Include admins setting above.</p>
        </div>
        <button type="button" onClick={() => refetch()} disabled={isFetching} className="text-xs text-blue-700 disabled:opacity-50">Refresh conversions</button>
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">
        Actions are clicks, captures, list adds and successful sends, not unique people or visits. A kit is one capture action.
        Distinct visits use an explicit CPS opening ID; later stages require the same signed-in user, vendor and pick IDs.
        All stages must be recorded inside this range. Repeat sends count as actions, but a visit converts only once.
        Send actions can appear under multiple vendors when a quote contains several vendors; they are not a count of unique estimates.
      </p>
      <p className="text-xs text-amber-800 bg-amber-50 rounded-lg p-3">
        Historical events and older SmartAdd versions lack this provenance. Update SmartAdd to 1.6.0 or later for linked visits.
        Direct vendor visits, new vendor tabs, missing events, changed users or changed product lines are not guessed.
        Unlinked actions remain visible but do not count as conversions. Unattributed vendor sends may include catalog-only estimates
        because older events do not identify their special-order lines.
      </p>
      <div className="flex gap-3 flex-wrap">
        <label className="text-xs text-gray-600">Vendor
          <select aria-label="Conversion vendor" value={vendor} onChange={e => setVendor(e.target.value)} className="block mt-1 border rounded px-2 py-1.5 max-w-64">
            <option value="">All vendors</option>
            {vendors.map(domain => <option key={domain} value={domain}>{domain}</option>)}
            {vendor && !vendors.includes(vendor) && <option value={vendor}>{vendor}</option>}
          </select>
        </label>
        <label className="text-xs text-gray-600">User
          <select aria-label="Conversion user" value={employee} onChange={e => setEmployee(e.target.value)} className="block mt-1 border rounded px-2 py-1.5 max-w-64">
            <option value="">All users</option>
            {people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            {employee && !people.some(([id]) => id === employee) && <option value={employee}>Employee #{employee}</option>}
          </select>
        </label>
        {(vendor || employee) && <button className="text-xs text-blue-700 self-end py-1.5" onClick={() => { setVendor(""); setEmployee(""); }}>Clear filters</button>}
      </div>
      {isLoading ? <p className="text-sm text-gray-400" role="status">Loading conversions…</p>
        : isError ? <p className="text-sm text-red-600" role="alert">Could not load vendor conversions. Try refreshing.</p>
        : !shown.length ? <p className="text-sm text-gray-500">No vendor activity matches these filters.</p>
        : <div className="overflow-x-auto">
          <table className="w-full text-xs text-right whitespace-nowrap">
            <caption className="sr-only">Actions and distinct linked visits per vendor and user</caption>
            <thead className="bg-gray-50 text-gray-500"><tr>
              <th scope="col" className="text-left p-2">Vendor</th><th scope="col" className="text-left p-2">User</th>
              {columns.map(([key, title]) => <th scope="col" className="p-2" key={key}>{title}</th>)}
              <th scope="col" className="p-2">Visit → send</th>
            </tr></thead>
            <tbody>{shown.map(row => <tr key={`${row.vendorDomain}:${row.employeeId}`} className="border-b border-gray-100">
              <th scope="row" className="p-2 text-left font-medium">{row.vendorDomain}</th>
              <td className="p-2 text-left">{row.employeeName}</td>
              {columns.map(([key]) => <td className="p-2 tabular-nums" key={key}>{row[key].toLocaleString()}</td>)}
              <td className="p-2 font-semibold">{rate(row)}</td>
            </tr>)}</tbody>
            <tfoot className="bg-gray-50 font-semibold"><tr>
              <th scope="row" colSpan={2} className="p-2 text-left">Filtered total</th>
              {columns.map(([key]) => <td className="p-2" key={key}>{totals[key].toLocaleString()}</td>)}
              <td className="p-2">{rate(totals)}</td>
            </tr></tfoot>
          </table>
        </div>}
    </section>
  );
}
