import { Router, type IRouter } from "express";
import { syncFromNetSuite } from "../lib/syncService";
import { isNetSuiteConfigured } from "../lib/netsuite";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db";
import { TriggerNetSuiteSyncResponse, GetNetSuiteStatusResponse } from "@workspace/api-zod";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.post("/netsuite/sync", async (req, res) => {
  const result = await syncFromNetSuite();
  const response = TriggerNetSuiteSyncResponse.parse(result);
  return res.json(response);
});

router.get("/netsuite/status", async (req, res) => {
  const connected = isNetSuiteConfigured();

  let lastSyncAt: string | null = null;
  try {
    const rows = await db
      .select({ updatedAt: categoriesTable.updatedAt })
      .from(categoriesTable)
      .orderBy(sql`${categoriesTable.updatedAt} DESC`)
      .limit(1);
    if (rows.length > 0 && rows[0].updatedAt) {
      lastSyncAt = rows[0].updatedAt.toISOString();
    }
  } catch {
    lastSyncAt = null;
  }

  const response = GetNetSuiteStatusResponse.parse({
    connected,
    accountId: process.env.NETSUITE_ACCOUNT_ID ?? null,
    lastSyncAt,
  });

  return res.json(response);
});

export default router;
