/** Twelve calendar months, in UTC; leap-day anniversaries clamp to February 28. */
export function issueScreenshotExpiresAt(createdAt: Date): Date {
  const expiry = new Date(createdAt);
  const day = expiry.getUTCDate();
  expiry.setUTCDate(1);
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
  const lastDay = new Date(Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth() + 1, 0)).getUTCDate();
  expiry.setUTCDate(Math.min(day, lastDay));
  return expiry;
}

export function issueScreenshotExpired(createdAt: Date, now = new Date()): boolean {
  return issueScreenshotExpiresAt(createdAt).getTime() <= now.getTime();
}

export const ISSUE_SCREENSHOT_EXPIRED = "Screenshot deleted under the 12-month retention policy.";
