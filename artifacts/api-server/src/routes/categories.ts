import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable, productsTable } from "@workspace/db";
import { eq, or, ilike, sql, inArray } from "drizzle-orm";
import {
  GetCategoriesResponse,
  GetCategoryProductsResponse,
  SearchProductsResponse,
} from "@workspace/api-zod";
import { MOCK_CATEGORIES, MOCK_PRODUCTS, MOCK_STOCK } from "../lib/mockData";

const router: IRouter = Router();

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
      .sort((a, b) => a.name.localeCompare(b.name));
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
    .where(sql`${productsTable.categoryId} IS NOT NULL`)
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
    .where(inArray(productsTable.categoryId, descendantIds));

  const mapped = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku ?? null,
    price: p.price ? parseFloat(p.price) : null,
    categoryId: p.categoryId ?? null,
    netsuiteId: p.netsuiteId ?? null,
    imageUrl: p.imageUrl ?? null,
    fullImageUrl: p.fullImageUrl ?? null,
    quantityAvailable: p.quantityAvailable ?? null,
  }));

  const response = GetCategoryProductsResponse.parse({ products: mapped, usingMockData: false });
  return res.json(response);
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
    .where(or(ilike(productsTable.name, `%${q}%`), ilike(productsTable.sku, `%${q}%`)));

  const mapped = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku ?? null,
    price: p.price ? parseFloat(p.price) : null,
    categoryId: p.categoryId ?? null,
    netsuiteId: p.netsuiteId ?? null,
    imageUrl: p.imageUrl ?? null,
    fullImageUrl: p.fullImageUrl ?? null,
    quantityAvailable: p.quantityAvailable ?? null,
  }));

  const response = SearchProductsResponse.parse({ products: mapped, usingMockData: false });
  return res.json(response);
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
  return res.json({
    product: {
      id: p.id,
      name: p.name,
      sku: p.sku ?? null,
      price: p.price ? parseFloat(p.price) : null,
      ourPrice: null,
      categoryId: p.categoryId ?? null,
      netsuiteId: p.netsuiteId ?? null,
      imageUrl: p.imageUrl ?? null,
      fullImageUrl: p.fullImageUrl ?? null,
      description: p.description ?? null,
      manufacturer: p.manufacturer ?? null,
      quantityAvailable: p.quantityAvailable ?? null,
      features: null,
    },
  });
});

export default router;
