import { db } from "@workspace/db";
import { categoriesTable, productsTable } from "@workspace/db";
import { eq, notInArray, sql } from "drizzle-orm";
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

function topologicalSortCategories(categories: NetSuiteCategory[]): NetSuiteCategory[] {
  const idMap = new Map<string, NetSuiteCategory>();
  for (const cat of categories) {
    idMap.set(cat.id, cat);
  }

  const visited = new Set<string>();
  const sorted: NetSuiteCategory[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const cat = idMap.get(id);
    if (!cat) return;
    if (cat.parent) {
      visit(cat.parent);
    }
    sorted.push(cat);
  }

  for (const cat of categories) {
    visit(cat.id);
  }

  return sorted;
}

export async function syncFromNetSuite(): Promise<SyncResult> {
  if (!isNetSuiteConfigured()) {
    return {
      success: false,
      message:
        "NetSuite M2M credentials not configured. Ensure NETSUITE_ACCOUNT_ID, NETSUITE_CLIENT_ID (or NETSUITE_OIDC_CLIENT_ID), NETSUITE_CERTIFICATE_ID are set, and certs/private_key.pem exists.",
      categoriesSynced: 0,
      productsSynced: 0,
    };
  }

  try {
    logger.info("Starting NetSuite sync");

    const nsCategories = await fetchNetSuiteCategories();
    logger.info({ count: nsCategories.length }, "Fetched categories from NetSuite");

    const sortedCategories = topologicalSortCategories(nsCategories);

    const netsuiteIdToDbId = new Map<string, number>();

    let categoriesSynced = 0;
    for (const cat of sortedCategories) {
      const parentNetsuiteId = cat.parent ?? null;

      let parentDbId: number | null = null;
      if (parentNetsuiteId) {
        parentDbId = netsuiteIdToDbId.get(parentNetsuiteId) ?? null;
      }

      const level = cat.fullname
        ? cat.fullname.split(" : ").length
        : parentDbId == null ? 1 : await getCategoryLevel(parentDbId, netsuiteIdToDbId);

      const existing = await db
        .select()
        .from(categoriesTable)
        .where(eq(categoriesTable.netsuiteId, cat.id))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(categoriesTable)
          .set({
            name: cat.name,
            level,
            parentId: parentDbId,
            isOnline: cat.isOnline,
            updatedAt: new Date(),
          })
          .where(eq(categoriesTable.netsuiteId, cat.id));
        netsuiteIdToDbId.set(cat.id, existing[0].id);
      } else {
        const [inserted] = await db
          .insert(categoriesTable)
          .values({
            netsuiteId: cat.id,
            name: cat.name,
            level,
            parentId: parentDbId,
            isOnline: cat.isOnline,
          })
          .returning();
        netsuiteIdToDbId.set(cat.id, inserted.id);
      }
      categoriesSynced++;
    }

    const syncedNetsuiteIds = Array.from(netsuiteIdToDbId.keys());
    if (syncedNetsuiteIds.length > 0) {
      const staleCategories = await db
        .select({ id: categoriesTable.id })
        .from(categoriesTable)
        .where(notInArray(categoriesTable.netsuiteId, syncedNetsuiteIds));
      if (staleCategories.length > 0) {
        const staleCatIds = staleCategories.map(c => c.id);
        await db
          .update(productsTable)
          .set({ categoryId: null })
          .where(sql`${productsTable.categoryId} IN (${sql.join(staleCatIds.map(id => sql`${id}`), sql`, `)})`);
        await db
          .delete(categoriesTable)
          .where(notInArray(categoriesTable.netsuiteId, syncedNetsuiteIds));
        logger.info({ count: staleCategories.length }, "Removed stale categories not in current SiteCategory sync");
      }
    }

    const nsItems = await fetchNetSuiteItems();
    logger.info({ count: nsItems.length }, "Fetched items from NetSuite");

    let productsSynced = 0;
    for (const item of nsItems) {
      const categoryDbId = item.sitecategoryid
        ? (netsuiteIdToDbId.get(item.sitecategoryid) ?? null)
        : null;

      const name = item.fullname || item.itemid;

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
            price: item.baseprice ? String(item.baseprice) : null,
            imageUrl: item.imageUrl ?? null,
            fullImageUrl: item.fullImageUrl ?? null,
            description: item.description ?? null,
            manufacturer: item.manufacturer ?? null,
            quantityAvailable: item.quantityAvailable ?? null,
            categoryId: categoryDbId,
            updatedAt: new Date(),
          })
          .where(eq(productsTable.netsuiteId, item.id));
      } else {
        await db.insert(productsTable).values({
          netsuiteId: item.id,
          name,
          sku: item.itemid,
          price: item.baseprice ? String(item.baseprice) : null,
          imageUrl: item.imageUrl ?? null,
          fullImageUrl: item.fullImageUrl ?? null,
          description: item.description ?? null,
          manufacturer: item.manufacturer ?? null,
          quantityAvailable: item.quantityAvailable ?? null,
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
      message:
        err instanceof Error ? err.message : "Unknown error during sync",
      categoriesSynced: 0,
      productsSynced: 0,
    };
  }
}

async function getCategoryLevel(
  dbId: number,
  _netsuiteIdToDbId: Map<string, number>
): Promise<number> {
  const rows = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.id, dbId))
    .limit(1);

  if (rows.length === 0) return 2;

  const parent = rows[0];
  return parent.level + 1;
}
