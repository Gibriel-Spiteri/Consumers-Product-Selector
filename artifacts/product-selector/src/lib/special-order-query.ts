// Retry only read-only lookups, never estimate writes. Auth and validation errors
// need user action, while a temporary NetSuite/network outage may recover.
export function retrySpecialOrderLookup(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof TypeError) return true;
  const status = (error as { status?: number } | null)?.status;
  return status === 408 || status === 429 || (status !== undefined && status >= 500);
}

export const specialOrderLookupRetry = {
  retry: retrySpecialOrderLookup,
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 4000),
};
