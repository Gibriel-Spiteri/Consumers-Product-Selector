import { createHash, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { and, eq, sql } from "drizzle-orm";
import { db, analyticsEventsTable, type InsertAnalyticsEvent } from "@workspace/db";
import { logger } from "./logger";

// A server-generated id identifies one completed NetSuite write, not an estimate
// (which can legitimately receive many pushes). Never reuse it for a new push.
export function estimateActionId(): string {
  return randomUUID();
}

export function estimateSessionId(browserSession: string | undefined, signedToken: string): string {
  const session = browserSession?.trim();
  if (session) return session.slice(0, 64);
  // Older callers have no per-tab id. One opaque fallback per signed login avoids
  // inventing a new analytics session for every push, without storing the token.
  return `server:${createHash("sha256").update(signedToken).digest("hex").slice(0, 48)}`;
}

export async function recordEstimatePush(
  actionId: string,
  event: Omit<InsertAnalyticsEvent, "eventType" | "metadata"> & { metadata: Record<string, unknown> },
): Promise<boolean> {
  const row: InsertAnalyticsEvent = {
    ...event, createdAt: new Date(), eventType: "push_to_estimate",
    metadata: { ...event.metadata, actionId, source: "server" },
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await db.transaction(async tx => {
        // The lock + existence check make retries safe even when COMMIT succeeded
        // but its response was lost. All retries use the same id and timestamp.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${actionId}))`);
        const existing = await tx.select({ id: analyticsEventsTable.id })
          .from(analyticsEventsTable)
          .where(and(
            eq(analyticsEventsTable.eventType, "push_to_estimate"),
            sql`${analyticsEventsTable.metadata}->>'actionId' = ${actionId}`,
          )).limit(1);
        if (existing.length === 0) await tx.insert(analyticsEventsTable).values(row);
      });
      return true;
    } catch (err) {
      if (attempt < 2) {
        logger.warn({ err, actionId, attempt: attempt + 1 }, "Retrying estimate analytics persistence");
        await delay(100 * (attempt + 1));
      } else {
        // The NetSuite write already succeeded. Never report a failed push here:
        // staff retrying it would append duplicate estimate lines.
        logger.error({ err, actionId, event: row }, "Estimate push succeeded but analytics persistence failed");
      }
    }
  }
  return false;
}
