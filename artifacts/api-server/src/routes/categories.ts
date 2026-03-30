import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable, productsTable } from "@workspace/db";
import { eq, or, ilike } from "drizzle-orm";
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
}>): CategoryNode[] {
  const nodeMap = new Map<number, CategoryNode>();
  for (const cat of flatCategories) {
    nodeMap.set(cat.id, { ...cat, children: [] });
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

  return roots;
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
    }));
    const tree = buildCategoryTree(flat);
    const response = GetCategoriesResponse.parse({ categories: tree, usingMockData: true });
    return res.json(response);
  }

  const categories = await db.select().from(categoriesTable);
  const flat = categories.map((c) => ({
    id: c.id,
    name: c.name,
    level: c.level,
    parentId: c.parentId ?? null,
    netsuiteId: c.netsuiteId ?? null,
  }));

  const tree = buildCategoryTree(flat);
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
      stock: MOCK_STOCK[p.id] ?? null,
    }));
    const response = GetCategoryProductsResponse.parse({ products: mapped, usingMockData: true });
    return res.json(response);
  }

  const products = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.categoryId, categoryId));

  const mapped = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku ?? null,
    price: p.price ? parseFloat(p.price) : null,
    categoryId: p.categoryId ?? null,
    netsuiteId: p.netsuiteId ?? null,
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
        manufacturer: product.manufacturer ?? null,
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
      manufacturer: null,
      features: null,
    },
  });
});

export default router;
