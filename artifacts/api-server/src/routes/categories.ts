import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable, productsTable, productAttributesTable, relatedItemsTable } from "@workspace/db";
import { eq, or, and, ilike, sql, inArray } from "drizzle-orm";
import {
  GetCategoriesResponse,
  GetCategoryProductsResponse,
  SearchProductsResponse,
} from "@workspace/api-zod";
import { MOCK_CATEGORIES, MOCK_PRODUCTS, MOCK_STOCK } from "../lib/mockData";
import { fetchLiveInventory, probeAdditionalImages } from "../lib/netsuite";

const router: IRouter = Router();

const notDiscontinued = sql`NOT (${productsTable.noReorder} = 1 AND (${productsTable.quantityAvailable} IS NULL OR ${productsTable.quantityAvailable} <= 0))`;

interface CategoryNode {
  id: number;
  name: string;
  level: number;
  parentId: number | null;
  netsuiteId: string | null;
  children: CategoryNode[];
}

function buildCategoryTree(flatCategories: Array<{
  id: number;
  name: string;
  level: number;
  parentId: number | null;
  netsuiteId: string | null;
  isOnline: boolean;
}>, productCounts?: Map<number, number>): CategoryNode[] {
  const onlineIds = new Set(flatCategories.filter(c => c.isOnline).map(c => c.id));

  const nodeMap = new Map<number, CategoryNode>();
  for (const cat of flatCategories) {
    nodeMap.set(cat.id, { id: cat.id, name: cat.name, level: cat.level, parentId: cat.parentId, netsuiteId: cat.netsuiteId, children: [] });
  }

  const roots: CategoryNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentId == null) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        parent.children.push(node);
      }
    }
  }

  function hasOnlineDescendant(node: CategoryNode): boolean {
    if (onlineIds.has(node.id)) return true;
    return node.children.some(c => hasOnlineDescendant(c));
  }

  function hasProducts(node: CategoryNode): boolean {
    if (productCounts && productCounts.has(node.id)) return true;
    return node.children.some(c => hasProducts(c));
  }

  function pruneTree(nodes: CategoryNode[]): CategoryNode[] {
    return nodes
      .filter(n => hasOnlineDescendant(n))
      .map(n => ({ ...n, children: pruneTree(n.children) }))
      .filter(n => productCounts ? hasProducts(n) : true)
      .sort((a, b) => {
        const aIsComponents = a.name.trim().toLowerCase() === "components";
        const bIsComponents = b.name.trim().toLowerCase() === "components";
        if (aIsComponents && !bIsComponents) return 1;
        if (!aIsComponents && bIsComponents) return -1;
        return a.name.localeCompare(b.name);
      });
  }

  return pruneTree(roots);
}

async function hasDatabaseData(): Promise<boolean> {
  try {
    const rows = await db.select().from(categoriesTable).limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

router.get("/categories", async (_req, res) => {
  const hasData = await hasDatabaseData();

  if (!hasData) {
    const flat = MOCK_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      level: c.level,
      parentId: c.parentId,
      netsuiteId: c.netsuiteId,
      isOnline: true,
    }));
    const tree = buildCategoryTree(flat);
    const response = GetCategoriesResponse.parse({ categories: tree, usingMockData: true });
    return res.json(response);
  }

  const categories = await db.select().from(categoriesTable);

  const productCountRows = await db
    .select({
      categoryId: productsTable.categoryId,
      count: sql<number>`count(*)::int`,
    })
    .from(productsTable)
    .where(sql`${productsTable.categoryId} IS NOT NULL AND ${notDiscontinued}`)
    .groupBy(productsTable.categoryId);
  const productCounts = new Map(productCountRows.map(r => [r.categoryId!, r.count]));

  const flat = categories.map((c) => ({
    id: c.id,
    name: c.name,
    level: c.level,
    parentId: c.parentId ?? null,
    netsuiteId: c.netsuiteId ?? null,
    isOnline: c.isOnline,
  }));

  const tree = buildCategoryTree(flat, productCounts);
  const response = GetCategoriesResponse.parse({ categories: tree, usingMockData: false });
  return res.json(response);
});

router.get("/categories/:categoryId/products", async (req, res) => {
  const categoryId = parseInt(req.params.categoryId, 10);
  if (isNaN(categoryId)) {
    return res.status(400).json({ error: "Invalid categoryId" });
  }

  const hasData = await hasDatabaseData();

  if (!hasData) {
    const mockProducts = MOCK_PRODUCTS.filter((p) => p.categoryId === categoryId);
    const mapped = mockProducts.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      categoryId: p.categoryId,
      netsuiteId: p.netsuiteId,
      imageUrl: null,
      fullImageUrl: null,
      stock: MOCK_STOCK[p.id] ?? null,
    }));
    const response = GetCategoryProductsResponse.parse({ products: mapped, usingMockData: true });
    return res.json(response);
  }

  const allCategories = await db
    .select({ id: categoriesTable.id, parentId: categoriesTable.parentId, isOnline: categoriesTable.isOnline, name: categoriesTable.name })
    .from(categoriesTable);
  const childMap = new Map<number, number[]>();
  for (const cat of allCategories) {
    if (cat.parentId != null) {
      const children = childMap.get(cat.parentId) ?? [];
      children.push(cat.id);
      childMap.set(cat.parentId, children);
    }
  }
  const descendantIds: number[] = [categoryId];
  const queue = [categoryId];
  while (queue.length > 0) {
    const current = queue.pop()!;
    const children = childMap.get(current) ?? [];
    for (const child of children) {
      descendantIds.push(child);
      queue.push(child);
    }
  }

  const products = await db
    .select()
    .from(productsTable)
    .where(and(inArray(productsTable.categoryId, descendantIds), notDiscontinued));

  const netsuiteIds = products.map((p) => p.netsuiteId).filter((id): id is string => id != null);
  const liveInventory = await fetchLiveInventory(netsuiteIds);

  const mapped = products.map((p) => {
    const liveQty = p.netsuiteId ? liveInventory.get(p.netsuiteId) : undefined;
    return {
      id: p.id,
      name: p.salesdescription || p.name,
      sku: p.sku ?? null,
      price: p.price ? parseFloat(p.price) : null,
      retailPrice: p.retailPrice ? parseFloat(p.retailPrice) : null,
      categoryId: p.categoryId ?? null,
      netsuiteId: p.netsuiteId ?? null,
      imageUrl: p.imageUrl ?? null,
      fullImageUrl: p.fullImageUrl ?? null,
      quantityAvailable: liveQty ?? p.quantityAvailable ?? null,
      hasActivePpr: p.hasActivePpr ?? false,
      pprName: p.pprName ?? null,
      pprPriceReductionRetail: p.pprPriceReductionRetail ? parseFloat(p.pprPriceReductionRetail) : null,
      noReorder: p.noReorder === 1,
      isSpecialOrderStock: p.isSpecialOrderStock ?? false,
      atpDate: p.atpDate ?? null,
      binNumber: p.binNumber ?? null,
    };
  });

  const productNetsuiteIds = products
    .map((p) => p.netsuiteId)
    .filter((id): id is string => id != null);

  let facets: Array<{ name: string; values: Array<{ value: string; count: number }> }> = [];
  const productAttrsMap = new Map<string, Array<{ name: string; value: string }>>();

  if (productNetsuiteIds.length > 0) {
    const attrRows = await db
      .select({
        productNetsuiteId: productAttributesTable.productNetsuiteId,
        attributeName: productAttributesTable.attributeName,
        attributeValue: productAttributesTable.attributeValue,
      })
      .from(productAttributesTable)
      .where(
        sql`${productAttributesTable.productNetsuiteId} IN (${sql.join(productNetsuiteIds.map(id => sql`${id}`), sql`, `)}) AND ${productAttributesTable.isFilter} = true`
      );

    const facetMap = new Map<string, Map<string, number>>();
    for (const row of attrRows) {
      if (!row.attributeName || !row.attributeValue) continue;
      if (!facetMap.has(row.attributeName)) facetMap.set(row.attributeName, new Map());
      const valMap = facetMap.get(row.attributeName)!;
      valMap.set(row.attributeValue, (valMap.get(row.attributeValue) ?? 0) + 1);

      if (!productAttrsMap.has(row.productNetsuiteId)) productAttrsMap.set(row.productNetsuiteId, []);
      productAttrsMap.get(row.productNetsuiteId)!.push({ name: row.attributeName, value: row.attributeValue });
    }

    facets = Array.from(facetMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, valMap]) => ({
        name,
        values: Array.from(valMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([value, count]) => ({ value, count })),
      }));
  }

  const mappedWithAttrs = mapped.map(p => ({
    ...p,
    attributes: p.netsuiteId ? (productAttrsMap.get(p.netsuiteId) ?? []) : [],
  }));

  return res.json({ products: mappedWithAttrs, facets, usingMockData: false });
});

router.get("/products/search", async (req, res) => {
  const q = req.query.q as string;
  if (!q || q.trim() === "") {
    return res.status(400).json({ error: "Missing search query" });
  }

  const hasData = await hasDatabaseData();

  if (!hasData) {
    const lower = q.toLowerCase();
    const mockResults = MOCK_PRODUCTS.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        (p.sku && p.sku.toLowerCase().includes(lower))
    );
    const mapped = mockResults.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      categoryId: p.categoryId,
      netsuiteId: p.netsuiteId,
      imageUrl: null,
      fullImageUrl: null,
    }));
    const response = SearchProductsResponse.parse({ products: mapped, usingMockData: true });
    return res.json(response);
  }

  const products = await db
    .select()
    .from(productsTable)
    .where(and(or(ilike(productsTable.name, `%${q}%`), ilike(productsTable.sku, `%${q}%`), ilike(productsTable.salesdescription, `%${q}%`)), notDiscontinued));

  const netsuiteIds = products.map((p) => p.netsuiteId).filter((id): id is string => id != null);
  const liveInventory = await fetchLiveInventory(netsuiteIds);

  const mapped = products.map((p) => {
    const liveQty = p.netsuiteId ? liveInventory.get(p.netsuiteId) : undefined;
    return {
      id: p.id,
      name: p.salesdescription || p.name,
      sku: p.sku ?? null,
      price: p.price ? parseFloat(p.price) : null,
      retailPrice: p.retailPrice ? parseFloat(p.retailPrice) : null,
      categoryId: p.categoryId ?? null,
      netsuiteId: p.netsuiteId ?? null,
      imageUrl: p.imageUrl ?? null,
      fullImageUrl: p.fullImageUrl ?? null,
      quantityAvailable: liveQty ?? p.quantityAvailable ?? null,
      hasActivePpr: p.hasActivePpr ?? false,
      pprName: p.pprName ?? null,
      pprPriceReductionRetail: p.pprPriceReductionRetail ? parseFloat(p.pprPriceReductionRetail) : null,
      noReorder: p.noReorder === 1,
      isSpecialOrderStock: p.isSpecialOrderStock ?? false,
      atpDate: p.atpDate ?? null,
    };
  });

  return res.json({ products: mapped, usingMockData: false });
});

router.get("/products/uncategorized", async (_req, res) => {
  const products = await db
    .select()
    .from(productsTable)
    .where(and(sql`${productsTable.categoryId} IS NULL`, notDiscontinued));

  const netsuiteIds = products.map((p) => p.netsuiteId).filter((id): id is string => id != null);
  const liveInventory = await fetchLiveInventory(netsuiteIds);

  const mapped = products.map((p) => {
    const liveQty = p.netsuiteId ? liveInventory.get(p.netsuiteId) : undefined;
    return {
      id: p.id,
      name: p.salesdescription || p.name,
      sku: p.sku ?? null,
      price: p.price ? parseFloat(p.price) : null,
      retailPrice: p.retailPrice ? parseFloat(p.retailPrice) : null,
      categoryId: p.categoryId ?? null,
      netsuiteId: p.netsuiteId ?? null,
      imageUrl: p.imageUrl ?? null,
      fullImageUrl: p.fullImageUrl ?? null,
      quantityAvailable: liveQty ?? p.quantityAvailable ?? null,
      hasActivePpr: p.hasActivePpr ?? false,
      pprName: p.pprName ?? null,
      pprPriceReductionRetail: p.pprPriceReductionRetail ? parseFloat(p.pprPriceReductionRetail) : null,
      noReorder: p.noReorder === 1,
      isSpecialOrderStock: p.isSpecialOrderStock ?? false,
      atpDate: p.atpDate ?? null,
    };
  });

  mapped.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

  res.json({ products: mapped, usingMockData: false });
});

router.get("/products/clearance", async (_req, res) => {
  const dfsCategory = await db
    .select({ id: categoriesTable.id })
    .from(categoriesTable)
    .where(ilike(categoriesTable.name, "displays for sale"))
    .limit(1);
  const dfsCategoryId = dfsCategory[0]?.id ?? null;

  const products = await db
    .select()
    .from(productsTable)
    .where(and(
      or(
        sql`${productsTable.hasActivePpr} = true`,
        sql`${productsTable.noReorder} = 1`
      ),
      notDiscontinued,
      dfsCategoryId ? sql`(${productsTable.categoryId} IS NULL OR ${productsTable.categoryId} != ${dfsCategoryId})` : undefined
    ));

  const netsuiteIds = products.map((p) => p.netsuiteId).filter((id): id is string => id != null);
  const liveInventory = await fetchLiveInventory(netsuiteIds);

  const categoryIds = [...new Set(products.map(p => p.categoryId).filter((id): id is number => id != null))];
  const categoryRows = categoryIds.length > 0
    ? await db.select({ id: categoriesTable.id, name: categoriesTable.name, parentId: categoriesTable.parentId }).from(categoriesTable).where(inArray(categoriesTable.id, categoryIds))
    : [];

  const parentIds = [...new Set(categoryRows.map(c => c.parentId).filter((id): id is number => id != null))];
  const parentRows = parentIds.length > 0
    ? await db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable).where(inArray(categoriesTable.id, parentIds))
    : [];
  const parentMap = new Map(parentRows.map(p => [p.id, p.name]));

  const catToParent = new Map<number, { parentId: number; parentName: string }>();
  for (const c of categoryRows) {
    if (c.parentId && parentMap.has(c.parentId)) {
      catToParent.set(c.id, { parentId: c.parentId, parentName: parentMap.get(c.parentId)! });
    }
  }

  const mapped = products.map((p) => {
    const liveQty = p.netsuiteId ? liveInventory.get(p.netsuiteId) : undefined;
    const parent = p.categoryId ? catToParent.get(p.categoryId) : undefined;
    return {
      id: p.id,
      name: p.salesdescription || p.name,
      sku: p.sku ?? null,
      price: p.price ? parseFloat(p.price) : null,
      retailPrice: p.retailPrice ? parseFloat(p.retailPrice) : null,
      categoryId: p.categoryId ?? null,
      categoryParentId: parent?.parentId ?? null,
      categoryParentName: parent?.parentName ?? null,
      netsuiteId: p.netsuiteId ?? null,
      imageUrl: p.imageUrl ?? null,
      fullImageUrl: p.fullImageUrl ?? null,
      quantityAvailable: liveQty ?? p.quantityAvailable ?? null,
      hasActivePpr: p.hasActivePpr ?? false,
      pprName: p.pprName ?? null,
      pprPriceReductionRetail: p.pprPriceReductionRetail ? parseFloat(p.pprPriceReductionRetail) : null,
      noReorder: p.noReorder === 1,
      isSpecialOrderStock: p.isSpecialOrderStock ?? false,
      atpDate: p.atpDate ?? null,
      isClearance: p.noReorder === 1,
    };
  });

  mapped.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

  res.json({ products: mapped, usingMockData: false });
});

router.get("/products/express-bath", async (_req, res) => {
  const products = await db
    .select()
    .from(productsTable)
    .where(and(sql`${productsTable.isExpressBath} = true`, notDiscontinued));

  const netsuiteIds = products.map((p) => p.netsuiteId).filter((id): id is string => id != null);
  const liveInventory = await fetchLiveInventory(netsuiteIds);

  const categoryIds = [...new Set(products.map(p => p.categoryId).filter((id): id is number => id != null))];
  const categoryRows = categoryIds.length > 0
    ? await db.select({ id: categoriesTable.id, name: categoriesTable.name, parentId: categoriesTable.parentId }).from(categoriesTable).where(inArray(categoriesTable.id, categoryIds))
    : [];

  const parentIds = [...new Set(categoryRows.map(c => c.parentId).filter((id): id is number => id != null))];
  const parentRows = parentIds.length > 0
    ? await db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable).where(inArray(categoriesTable.id, parentIds))
    : [];
  const parentMap = new Map(parentRows.map(p => [p.id, p.name]));

  const catToParent = new Map<number, { parentId: number; parentName: string }>();
  for (const c of categoryRows) {
    if (c.parentId && parentMap.has(c.parentId)) {
      catToParent.set(c.id, { parentId: c.parentId, parentName: parentMap.get(c.parentId)! });
    }
  }

  const mapped = products.map((p) => {
    const liveQty = p.netsuiteId ? liveInventory.get(p.netsuiteId) : undefined;
    const parent = p.categoryId ? catToParent.get(p.categoryId) : undefined;
    return {
      id: p.id,
      name: p.salesdescription || p.name,
      sku: p.sku ?? null,
      price: p.price ? parseFloat(p.price) : null,
      retailPrice: p.retailPrice ? parseFloat(p.retailPrice) : null,
      categoryId: p.categoryId ?? null,
      categoryParentId: parent?.parentId ?? null,
      categoryParentName: parent?.parentName ?? null,
      netsuiteId: p.netsuiteId ?? null,
      imageUrl: p.imageUrl ?? null,
      fullImageUrl: p.fullImageUrl ?? null,
      quantityAvailable: liveQty ?? p.quantityAvailable ?? null,
      hasActivePpr: p.hasActivePpr ?? false,
      pprName: p.pprName ?? null,
      pprPriceReductionRetail: p.pprPriceReductionRetail ? parseFloat(p.pprPriceReductionRetail) : null,
      noReorder: p.noReorder === 1,
      isSpecialOrderStock: p.isSpecialOrderStock ?? false,
      atpDate: p.atpDate ?? null,
    };
  });

  mapped.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));

  res.json({ products: mapped, usingMockData: false });
});

router.get("/products/stats", async (_req, res) => {
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(productsTable)
    .where(notDiscontinued);

  const orphanResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(productsTable)
    .where(and(sql`${productsTable.categoryId} IS NULL`, notDiscontinued));

  const lastUpdatedResult = await db
    .select({ maxUpdated: sql<string>`max(${productsTable.updatedAt})` })
    .from(productsTable);

  const rawTimestamp = lastUpdatedResult[0]?.maxUpdated ?? null;
  const lastUpdated = rawTimestamp && !rawTimestamp.endsWith("Z") ? rawTimestamp + "Z" : rawTimestamp;

  res.json({
    totalProducts: Number(totalResult[0]?.count ?? 0),
    productsWithoutCategory: Number(orphanResult[0]?.count ?? 0),
    lastUpdated,
  });
});

router.get("/products/:productId", async (req, res) => {
  const productId = parseInt(req.params.productId, 10);
  if (isNaN(productId)) {
    return res.status(400).json({ error: "Invalid productId" });
  }

  const hasData = await hasDatabaseData();

  if (!hasData) {
    const product = MOCK_PRODUCTS.find((p) => p.id === productId);
    if (!product) return res.status(404).json({ error: "Product not found" });
    return res.json({
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price,
        ourPrice: product.ourPrice ?? null,
        categoryId: product.categoryId,
        netsuiteId: product.netsuiteId,
        imageUrl: null,
        fullImageUrl: null,
        description: null,
        manufacturer: null,
        quantityAvailable: null,
        features: product.features ?? null,
      },
    });
  }

  const rows = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (rows.length === 0) return res.status(404).json({ error: "Product not found" });
  const p = rows[0];

  const netsuiteIds = p.netsuiteId ? [p.netsuiteId] : [];
  const [liveInventory, additionalImages] = await Promise.all([
    fetchLiveInventory(netsuiteIds),
    probeAdditionalImages(p.imageUrl),
  ]);
  const liveQty = p.netsuiteId ? liveInventory.get(p.netsuiteId) : undefined;

  return res.json({
    product: {
      id: p.id,
      name: p.salesdescription || p.name,
      sku: p.sku ?? null,
      price: p.price ? parseFloat(p.price) : null,
      retailPrice: p.retailPrice ? parseFloat(p.retailPrice) : null,
      ourPrice: p.price ? parseFloat(p.price) : null,
      categoryId: p.categoryId ?? null,
      netsuiteId: p.netsuiteId ?? null,
      imageUrl: p.imageUrl ?? null,
      fullImageUrl: p.fullImageUrl ?? null,
      additionalImages,
      description: p.description ?? null,
      manufacturer: p.manufacturer ?? null,
      quantityAvailable: liveQty ?? p.quantityAvailable ?? null,
      hasActivePpr: p.hasActivePpr ?? false,
      pprName: p.pprName ?? null,
      pprPriceReductionRetail: p.pprPriceReductionRetail ? parseFloat(p.pprPriceReductionRetail) : null,
      noReorder: p.noReorder === 1,
      isSpecialOrderStock: p.isSpecialOrderStock ?? false,
      atpDate: p.atpDate ?? null,
      binNumber: p.binNumber ?? null,
      features: null,
    },
  });
});

router.get("/products/:productId/related", async (req, res) => {
  const productId = Number(req.params.productId);
  if (isNaN(productId)) {
    return res.status(400).json({ error: "Invalid product ID" });
  }

  const product = await db
    .select({ netsuiteId: productsTable.netsuiteId })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);

  if (product.length === 0 || !product[0].netsuiteId) {
    return res.json({ relatedItems: [] });
  }

  const related = await db
    .select()
    .from(relatedItemsTable)
    .where(eq(relatedItemsTable.parentNetsuiteId, product[0].netsuiteId));

  if (related.length === 0) {
    return res.json({ relatedItems: [] });
  }

  const relatedNetsuiteIds = related.map(r => r.relatedNetsuiteId);
  const relatedProducts = await db
    .select()
    .from(productsTable)
    .where(and(inArray(productsTable.netsuiteId!, relatedNetsuiteIds), notDiscontinued));

  const productMap = new Map(relatedProducts.map(p => [p.netsuiteId, p]));

  const netsuiteIds = relatedProducts.map(p => p.netsuiteId).filter((id): id is string => id != null);
  const liveInventory = await fetchLiveInventory(netsuiteIds);

  const items = related.map(r => {
    const p = productMap.get(r.relatedNetsuiteId);
    const liveQty = p?.netsuiteId ? liveInventory.get(p.netsuiteId) : undefined;
    return {
      id: p?.id ?? null,
      netsuiteId: r.relatedNetsuiteId,
      name: p ? (p.salesdescription || p.name) : null,
      sku: p?.sku ?? null,
      price: p?.price ? parseFloat(p.price) : (r.onlinePrice ? parseFloat(r.onlinePrice) : null),
      retailPrice: p?.retailPrice ? parseFloat(p.retailPrice) : null,
      imageUrl: p?.imageUrl ?? null,
      fullImageUrl: p?.fullImageUrl ?? null,
      quantityAvailable: liveQty ?? p?.quantityAvailable ?? null,
      hasActivePpr: p?.hasActivePpr ?? false,
      pprName: p?.pprName ?? null,
      pprPriceReductionRetail: p?.pprPriceReductionRetail ? parseFloat(p.pprPriceReductionRetail) : null,
      noReorder: p?.noReorder === 1,
      isSpecialOrderStock: p?.isSpecialOrderStock ?? false,
      atpDate: p?.atpDate ?? null,
      description: r.description ?? null,
    };
  }).filter(item => item.name != null);

  return res.json({ relatedItems: items });
});

export default router;
