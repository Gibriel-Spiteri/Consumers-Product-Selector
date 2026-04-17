import { db, appSettingsTable } from "@workspace/db";
import { categoriesTable, productsTable, productAttributesTable, relatedItemsTable } from "@workspace/db";
import { eq, notInArray, sql } from "drizzle-orm";
import {
  fetchNetSuiteCategories,
  fetchNetSuiteItems,
  fetchItemAttributes,
  fetchRelatedItems,
  fetchActivePprItems,
  fetchItemBins,
  isNetSuiteConfigured,
  type NetSuiteCategory,
} from "./netsuite";
import { logger } from "./logger";

export interface SyncResult {
  success: boolean;
  message: string;
  categoriesSynced: number;
  productsSynced: number;
  pprItemsSynced: number;
  attributesSynced: number;
  relatedItemsSynced: number;
  syncedBy: string;
  durationMs: number;
  completedAt: string;
}

let lastSyncResult: SyncResult | null = null;

export function getLastSyncResult(): SyncResult | null {
  return lastSyncResult;
}

export async function loadPersistedSyncResult() {
  try {
    const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "last_sync_result"));
    if (rows.length > 0) {
      lastSyncResult = JSON.parse(rows[0].value);
      logger.info({ completedAt: lastSyncResult?.completedAt }, "Loaded persisted last sync result");
    }
  } catch (err) {
    logger.error({ err }, "Failed to load persisted sync result");
  }
}

async function persistSyncResult(result: SyncResult) {
  try {
    await db
      .insert(appSettingsTable)
      .values({ key: "last_sync_result", value: JSON.stringify(result) })
      .onConflictDoUpdate({ target: appSettingsTable.key, set: { value: JSON.stringify(result) } });
  } catch (err) {
    logger.error({ err }, "Failed to persist sync result");
  }
}

export interface SyncProgress {
  stage: string;
  percent: number;
  detail: string;
}

let currentProgress: SyncProgress | null = null;

export function getSyncProgress(): SyncProgress | null {
  return currentProgress;
}

function setProgress(stage: string, percent: number, detail: string) {
  currentProgress = { stage, percent, detail };
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

export async function syncFromNetSuite(syncedBy: string = "Scheduled"): Promise<SyncResult> {
  if (!isNetSuiteConfigured()) {
    return {
      success: false,
      message:
        "NetSuite M2M credentials not configured. Ensure NETSUITE_ACCOUNT_ID, NETSUITE_CLIENT_ID (or NETSUITE_OIDC_CLIENT_ID), NETSUITE_CERTIFICATE_ID are set, and certs/private_key.pem exists.",
      categoriesSynced: 0,
      productsSynced: 0,
      pprItemsSynced: 0,
      attributesSynced: 0,
      relatedItemsSynced: 0,
      syncedBy,
      durationMs: 0,
      completedAt: "",
    };
  }

  const syncStart = Date.now();
  try {
    logger.info("Starting NetSuite sync");
    setProgress("categories", 5, "Fetching categories from NetSuite…");

    const nsCategories = await fetchNetSuiteCategories();
    logger.info({ count: nsCategories.length }, "Fetched categories from NetSuite");
    setProgress("categories", 15, `Saving ${nsCategories.length} categories…`);

    const sortedCategories = topologicalSortCategories(nsCategories);

    const netsuiteIdToDbId = new Map<string, number>();

    let categoriesSynced = 0;
    let attributesSynced = 0;
    let relatedItemsSynced = 0;
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
      if (categoriesSynced % 100 === 0 || categoriesSynced === sortedCategories.length) {
        const pct = 15 + Math.round((categoriesSynced / sortedCategories.length) * 25);
        setProgress("categories", pct, `Saved ${categoriesSynced} / ${sortedCategories.length} categories`);
      }
    }

    setProgress("items", 42, "Cleaning stale categories…");
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
        logger.info({ count: staleCategories.length }, "Removed stale categories not in current CPS Site Category sync");
      }
    }

    setProgress("items", 45, "Fetching products from NetSuite…");
    const activePprItemsMap = await fetchActivePprItems();
    const itemBinsMap = await fetchItemBins();
    const allCandidateItems = await fetchNetSuiteItems();
    logger.info({ count: allCandidateItems.length }, "Fetched all candidate items from NetSuite");

    const itemsWithCategory = allCandidateItems.filter(item => item.cpsCategoryId != null).length;
    logger.info({ itemsWithCategory, totalItems: allCandidateItems.length }, "Category assignments from SuiteQL");

    const nsItems = allCandidateItems;
    logger.info({ qualified: nsItems.length }, "Including all candidate items (uncategorized will appear in Without Category)");

    setProgress("items", 55, `Saving ${nsItems.length} products…`);

    let productsSynced = 0;
    for (const item of nsItems) {
      const nsCategoryId = item.cpsCategoryId ?? null;
      const categoryDbId = nsCategoryId
        ? (netsuiteIdToDbId.get(nsCategoryId) ?? null)
        : null;

      const name = item.fullname || item.itemid;
      const pprData = activePprItemsMap.get(item.id);
      const hasActivePpr = !!pprData;
      const pprPriceReductionRetail = pprData?.priceReductionRetail ?? null;
      const pprName = pprData?.name ?? null;
      const binNumber = itemBinsMap.get(item.id) ?? null;

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
            salesdescription: item.salesdescription ?? null,
            sku: item.itemid,
            price: item.baseprice ? String(item.baseprice) : null,
            retailPrice: item.retailPrice != null ? String(item.retailPrice) : null,
            imageUrl: item.imageUrl ?? null,
            fullImageUrl: item.fullImageUrl ?? null,
            description: item.description ?? null,
            manufacturer: item.manufacturer ?? null,
            quantityAvailable: item.quantityAvailable ?? null,
            noReorder: item.noReorder ? 1 : 0,
            hasActivePpr: hasActivePpr,
            pprName: pprName,
            pprPriceReductionRetail: pprPriceReductionRetail != null ? String(pprPriceReductionRetail) : null,
            isExpressBath: item.isExpressBath ?? false,
            isSpecialOrderStock: item.isSpecialOrderStock ?? false,
            binNumber,
            categoryId: categoryDbId,
            updatedAt: new Date(),
          })
          .where(eq(productsTable.netsuiteId, item.id));
      } else {
        await db.insert(productsTable).values({
          netsuiteId: item.id,
          name,
          salesdescription: item.salesdescription ?? null,
          sku: item.itemid,
          price: item.baseprice ? String(item.baseprice) : null,
          retailPrice: item.retailPrice != null ? String(item.retailPrice) : null,
          imageUrl: item.imageUrl ?? null,
          fullImageUrl: item.fullImageUrl ?? null,
          description: item.description ?? null,
          manufacturer: item.manufacturer ?? null,
          quantityAvailable: item.quantityAvailable ?? null,
          noReorder: item.noReorder ? 1 : 0,
          hasActivePpr: hasActivePpr,
          pprName: pprName,
          pprPriceReductionRetail: pprPriceReductionRetail != null ? String(pprPriceReductionRetail) : null,
          isExpressBath: item.isExpressBath ?? false,
          isSpecialOrderStock: item.isSpecialOrderStock ?? false,
          binNumber,
          categoryId: categoryDbId,
        });
      }
      productsSynced++;
      if (productsSynced % 50 === 0 || productsSynced === nsItems.length) {
        const pct = 55 + Math.round((productsSynced / nsItems.length) * 35);
        setProgress("items", pct, `Saved ${productsSynced} / ${nsItems.length} products`);
      }
    }

    setProgress("cleanup", 82, "Cleaning stale products…");
    const syncedProductNetsuiteIds = nsItems.map((item) => item.id);
    if (syncedProductNetsuiteIds.length > 0) {
      const deletedProducts = await db
        .delete(productsTable)
        .where(notInArray(productsTable.netsuiteId!, syncedProductNetsuiteIds));
      logger.info({ deleted: deletedProducts.rowCount ?? 0 }, "Removed stale products");
    }

    setProgress("attributes", 84, "Fetching item attributes from NetSuite…");
    try {
      const nsAttrs = await fetchItemAttributes();
      logger.info({ count: nsAttrs.length }, "Fetched item attributes from NetSuite");

      setProgress("attributes", 86, `Saving ${nsAttrs.length} attributes…`);
      await db.delete(productAttributesTable);

      const BATCH_SIZE = 500;
      for (let i = 0; i < nsAttrs.length; i += BATCH_SIZE) {
        const batch = nsAttrs.slice(i, i + BATCH_SIZE);
        await db.insert(productAttributesTable).values(
          batch.map((a) => ({
            netsuiteId: a.id,
            productNetsuiteId: a.itemNetsuiteId,
            attributeName: a.attributeName,
            attributeValueId: a.attributeValueId,
            attributeValue: a.attributeValue,
            sortOrder: a.sortOrder,
            isFilter: a.isFilter,
          }))
        );
        if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= nsAttrs.length) {
          const pct = 86 + Math.round(((i + BATCH_SIZE) / nsAttrs.length) * 6);
          setProgress("attributes", Math.min(pct, 92), `Saved ${Math.min(i + BATCH_SIZE, nsAttrs.length)} / ${nsAttrs.length} attributes`);
        }
      }
      attributesSynced = nsAttrs.length;
      logger.info({ count: nsAttrs.length }, "Synced item attributes");
    } catch (err) {
      logger.error({ err }, "Item attribute sync failed (non-fatal)");
    }

    setProgress("related-items", 92, "Fetching related items from NetSuite…");
    try {
      const nsRelated = await fetchRelatedItems();
      logger.info({ count: nsRelated.length }, "Fetched related items from NetSuite");

      setProgress("related-items", 94, `Saving ${nsRelated.length} related items…`);
      await db.delete(relatedItemsTable);

      const BATCH_SIZE = 500;
      for (let i = 0; i < nsRelated.length; i += BATCH_SIZE) {
        const batch = nsRelated.slice(i, i + BATCH_SIZE);
        await db.insert(relatedItemsTable).values(
          batch.map((r) => ({
            parentNetsuiteId: r.parentNetsuiteId,
            relatedNetsuiteId: r.relatedNetsuiteId,
            description: r.description,
            basePrice: r.basePrice,
            onlinePrice: r.onlinePrice,
          }))
        );
        if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= nsRelated.length) {
          const pct = 94 + Math.round(((i + BATCH_SIZE) / nsRelated.length) * 4);
          setProgress("related-items", Math.min(pct, 98), `Saved ${Math.min(i + BATCH_SIZE, nsRelated.length)} / ${nsRelated.length} related items`);
        }
      }
      relatedItemsSynced = nsRelated.length;
      logger.info({ count: nsRelated.length }, "Synced related items");
    } catch (err) {
      logger.error({ err }, "Related items sync failed (non-fatal)");
    }

    setProgress("done", 100, "Sync complete!");
    logger.info({ categoriesSynced, productsSynced }, "NetSuite sync complete");

    const pprItemsSynced = activePprItemsMap.size;

    const result: SyncResult = {
      success: true,
      message: "Sync completed successfully",
      categoriesSynced,
      productsSynced,
      pprItemsSynced,
      attributesSynced,
      relatedItemsSynced,
      syncedBy,
      durationMs: Date.now() - syncStart,
      completedAt: new Date().toISOString(),
    };
    lastSyncResult = result;
    persistSyncResult(result);
    setTimeout(() => { currentProgress = null; }, 5000);
    return result;
  } catch (err) {
    logger.error({ err }, "NetSuite sync failed");
    setProgress("error", 0, "Sync failed");
    setTimeout(() => { currentProgress = null; }, 5000);
    return {
      success: false,
      message:
        err instanceof Error ? err.message : "Unknown error during sync",
      categoriesSynced: 0,
      productsSynced: 0,
      pprItemsSynced: 0,
      attributesSynced: 0,
      relatedItemsSynced: 0,
      syncedBy,
      durationMs: Date.now() - syncStart,
      completedAt: new Date().toISOString(),
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
