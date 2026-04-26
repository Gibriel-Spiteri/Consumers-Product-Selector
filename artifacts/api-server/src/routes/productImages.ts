import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, productsTable, productUserImagesTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { logger } from "../lib/logger";
import { executeSuiteQL } from "../lib/netsuite";
import { requireAdmin } from "./admin";
import { DISPLAYS_FOR_SALE_CATEGORY_ID, objectKeyToUrl } from "../lib/userImages";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const MAX_BYTES = 8 * 1024 * 1024;

async function fetchEmployeeName(employeeId: string): Promise<string | null> {
  try {
    const result = await executeSuiteQL<{ entityid: string; firstname?: string; lastname?: string }>(
      `SELECT entityid, firstname, lastname FROM Employee WHERE id = ${Number(employeeId)}`
    );
    if (result.items.length === 0) return null;
    const r = result.items[0];
    const composed = [r.firstname, r.lastname].filter(Boolean).join(" ").trim();
    return composed || r.entityid || null;
  } catch (err) {
    logger.warn({ err, employeeId }, "Failed to fetch employee name");
    return null;
  }
}

function gcsKeyFromObjectPath(objectPath: string): { bucketName: string; objectName: string } | null {
  // objectPath looks like /objects/<uuid>; the underlying GCS object lives at
  // `${PRIVATE_OBJECT_DIR}/<uuid>`. PRIVATE_OBJECT_DIR is in the form
  // /<bucketName>/<entityId>.
  const dir = process.env.PRIVATE_OBJECT_DIR;
  if (!dir) return null;
  const trimmed = objectPath.startsWith("/objects/") ? objectPath.slice("/objects/".length) : objectPath;
  const fullPath = `${dir}/${trimmed}`;
  const parts = fullPath.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const [bucketName, ...rest] = parts;
  return { bucketName, objectName: rest.join("/") };
}

async function deleteGcsObject(objectPath: string): Promise<void> {
  const parsed = gcsKeyFromObjectPath(objectPath);
  if (!parsed) return;
  try {
    const { objectStorageClient } = await import("../lib/objectStorage");
    await objectStorageClient.bucket(parsed.bucketName).file(parsed.objectName).delete({ ignoreNotFound: true });
  } catch (err) {
    logger.warn({ err, objectPath }, "Failed to delete GCS object");
  }
}

async function loadDfsProductByNetsuiteId(netsuiteId: string) {
  const rows = await db
    .select({
      id: productsTable.id,
      netsuiteId: productsTable.netsuiteId,
      categoryId: productsTable.categoryId,
      imageUrl: productsTable.imageUrl,
    })
    .from(productsTable)
    .where(eq(productsTable.netsuiteId, netsuiteId))
    .limit(1);
  return rows[0] ?? null;
}

router.post("/products/:netsuiteId/image/request-upload", async (req: Request, res: Response) => {
  const employeeId = req.headers["x-employee-id"] as string | undefined;
  if (!employeeId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const netsuiteId = req.params.netsuiteId;
  if (!netsuiteId) {
    return res.status(400).json({ error: "Missing product id" });
  }

  const product = await loadDfsProductByNetsuiteId(netsuiteId);
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }
  if (product.categoryId !== DISPLAYS_FOR_SALE_CATEGORY_ID) {
    return res.status(403).json({ error: "Image uploads are only allowed for Displays For Sale items" });
  }
  if (product.imageUrl) {
    return res
      .status(409)
      .json({ error: "Product already has a NetSuite image" });
  }

  try {
    const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
    const objectKey = objectStorageService.normalizeObjectEntityPath(uploadUrl);
    return res.json({ uploadUrl, objectKey });
  } catch (err) {
    logger.error({ err }, "Failed to generate upload URL");
    return res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

router.post("/products/:netsuiteId/image/confirm", async (req: Request, res: Response) => {
  const employeeId = req.headers["x-employee-id"] as string | undefined;
  if (!employeeId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const netsuiteId = req.params.netsuiteId;
  const { objectKey, byteSize } = req.body ?? {};
  if (!netsuiteId || typeof objectKey !== "string" || !objectKey.startsWith("/objects/")) {
    return res.status(400).json({ error: "Missing or invalid objectKey" });
  }
  if (typeof byteSize !== "number" || byteSize <= 0 || byteSize > MAX_BYTES) {
    return res.status(400).json({ error: "Invalid byteSize" });
  }

  const product = await loadDfsProductByNetsuiteId(netsuiteId);
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }
  if (product.categoryId !== DISPLAYS_FOR_SALE_CATEGORY_ID) {
    return res.status(403).json({ error: "Image uploads are only allowed for Displays For Sale items" });
  }
  if (product.imageUrl) {
    // NetSuite gave it a real image while the user was processing — discard.
    await deleteGcsObject(objectKey);
    return res.status(409).json({ error: "Product already has a NetSuite image" });
  }

  const employeeName = await fetchEmployeeName(employeeId);

  // Find any existing user image so we can clean up the previous GCS object.
  const existingRows = await db
    .select({ objectKey: productUserImagesTable.objectKey })
    .from(productUserImagesTable)
    .where(eq(productUserImagesTable.netsuiteId, netsuiteId));
  const previousKey = existingRows[0]?.objectKey ?? null;

  await db
    .insert(productUserImagesTable)
    .values({
      netsuiteId,
      objectKey,
      contentType: "image/png",
      byteSize,
      uploadedByEmployeeId: employeeId,
      uploadedByEmployeeName: employeeName,
    })
    .onConflictDoUpdate({
      target: productUserImagesTable.netsuiteId,
      set: {
        objectKey,
        contentType: "image/png",
        byteSize,
        uploadedByEmployeeId: employeeId,
        uploadedByEmployeeName: employeeName,
        uploadedAt: new Date(),
        lastSeenInSyncAt: new Date(),
      },
    });

  if (previousKey && previousKey !== objectKey) {
    void deleteGcsObject(previousKey);
  }

  return res.json({ ok: true, imageUrl: objectKeyToUrl(objectKey), imageSource: "user" });
});

router.delete("/products/:netsuiteId/image", requireAdmin, async (req: Request, res: Response) => {
  const netsuiteId = req.params.netsuiteId;
  if (!netsuiteId) {
    return res.status(400).json({ error: "Missing product id" });
  }

  const rows = await db
    .select({ objectKey: productUserImagesTable.objectKey })
    .from(productUserImagesTable)
    .where(eq(productUserImagesTable.netsuiteId, netsuiteId));

  if (rows.length === 0) {
    return res.status(404).json({ error: "No user-uploaded image for this product" });
  }

  await db.delete(productUserImagesTable).where(eq(productUserImagesTable.netsuiteId, netsuiteId));
  void deleteGcsObject(rows[0].objectKey);

  return res.status(204).end();
});

export default router;
