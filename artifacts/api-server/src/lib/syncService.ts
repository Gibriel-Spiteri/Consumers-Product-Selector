import { db } from "@workspace/db";
import { categoriesTable, productsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  fetchNetSuiteCategories,
  fetchNetSuiteItems,
  isNetSuiteConfigured,
  type NetSuiteCategory,
} from "./netsuite";
import { logger } from "./logger";

export interface SyncResult {
  success: boolean;
  message: string;
  categoriesSynced: number;
  productsSynced: number;
}

function buildCategoryLevels(
  categories: NetSuiteCategory[]
): Map<string, { level: number; parentNetsuiteId: string | null }> {
  const idToParent = new Map<string, string | null>();
  for (const cat of categories) {
    idToParent.set(cat.id, cat.parent ?? null);
  }

  const levels = new Map<string, { level: number; parentNetsuiteId: string | null }>();

  function getLevel(id: string): number {
    const parent = idToParent.get(id);
    if (!parent) return 1;
    return getLevel(parent) + 1;
  }

  for (const cat of categories) {
    levels.set(cat.id, {
      level: getLevel(cat.id),
      parentNetsuiteId: cat.parent ?? null,
    });
  }

  return levels;
}

export async function syncFromNetSuite(): Promise<SyncResult> {
  if (!isNetSuiteConfigured()) {
    return {
      success: false,
      message: "NetSuite credentials not configured. Set NETSUITE_ACCOUNT_ID, NETSUITE_CLIENT_ID, and NETSUITE_CLIENT_SECRET environment variables.",
      categoriesSynced: 0,
      productsSynced: 0,
    };
  }

  try {
    logger.info("Starting NetSuite sync");

    const nsCategories = await fetchNetSuiteCategories();
    logger.info({ count: nsCategories.length }, "Fetched categories from NetSuite");

    const categoryLevels = buildCategoryLevels(nsCategories);

    const netsuiteIdToDbId = new Map<string, number>();

    let categoriesSynced = 0;
    for (const cat of nsCategories) {
      const meta = categoryLevels.get(cat.id);
      if (!meta) continue;

      const existing = await db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.netsuiteId, cat.id))
        .limit(1);

      let parentDbId: number | null = null;
      if (meta.parentNetsuiteId) {
        parentDbId = netsuiteIdToDbId.get(meta.parentNetsuiteId) ?? null;
      }

      if (existing.length > 0) {
        const [updated] = await db
          .update(categoriesTable)
          .set({
            name: cat.name,
            level: meta.level,
            parentId: parentDbId,
            updatedAt: new Date(),
          })
          .where(eq(categoriesTable.netsuiteId, cat.id))
          .returning();
        netsuiteIdToDbId.set(cat.id, updated.id);
      } else {
        const [inserted] = await db
          .insert(categoriesTable)
          .values({
            netsuiteId: cat.id,
            name: cat.name,
            level: meta.level,
            parentId: parentDbId,
          })
          .returning();
        netsuiteIdToDbId.set(cat.id, inserted.id);
      }
      categoriesSynced++;
    }

    const nsItems = await fetchNetSuiteItems();
    logger.info({ count: nsItems.length }, "Fetched items from NetSuite");

    let productsSynced = 0;
    for (const item of nsItems) {
      const categoryDbId = item.category
        ? (netsuiteIdToDbId.get(item.category) ?? null)
        : null;

      const name = item.displayname || item.itemid;

      const existing = await db
        .select()
        .from(productsTable)
        .where(eq(productsTable.netsuiteId, item.id))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(productsTable)
          .set({
            name,
            sku: item.itemid,
            price: item.salesprice ? String(item.salesprice) : null,
            categoryId: categoryDbId,
            updatedAt: new Date(),
          })
          .where(eq(productsTable.netsuiteId, item.id));
      } else {
        await db.insert(productsTable).values({
          netsuiteId: item.id,
          name,
          sku: item.itemid,
          price: item.salesprice ? String(item.salesprice) : null,
          categoryId: categoryDbId,
        });
      }
      productsSynced++;
    }

    logger.info({ categoriesSynced, productsSynced }, "NetSuite sync complete");

    return {
      success: true,
      message: "Sync completed successfully",
      categoriesSynced,
      productsSynced,
    };
  } catch (err) {
    logger.error({ err }, "NetSuite sync failed");
    return {
      success: false,
      message: err instanceof Error ? err.message : "Unknown error during sync",
      categoriesSynced: 0,
      productsSynced: 0,
    };
  }
}
