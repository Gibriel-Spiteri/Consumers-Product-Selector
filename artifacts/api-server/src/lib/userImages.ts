import { db, productUserImagesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

export const DISPLAYS_FOR_SALE_CATEGORY_ID = 1829;

export type ImageSource = "netsuite" | "user" | null;

export interface ResolvedImage {
  imageUrl: string | null;
  imageSource: ImageSource;
}

/**
 * Build a lookup from netsuiteId -> served URL for products in the Displays For
 * Sale category that lack a NetSuite image. Returns an empty map if no products
 * qualify.
 */
export async function fetchUserImageMap(
  products: Array<{ netsuiteId: string | null; imageUrl: string | null; categoryId: number | null }>
): Promise<Map<string, string>> {
  const candidateIds = products
    .filter(
      (p) =>
        p.netsuiteId != null &&
        p.imageUrl == null &&
        p.categoryId === DISPLAYS_FOR_SALE_CATEGORY_ID
    )
    .map((p) => p.netsuiteId as string);

  if (candidateIds.length === 0) return new Map();

  const rows = await db
    .select({ netsuiteId: productUserImagesTable.netsuiteId, objectKey: productUserImagesTable.objectKey })
    .from(productUserImagesTable)
    .where(inArray(productUserImagesTable.netsuiteId, candidateIds));

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.netsuiteId, objectKeyToUrl(row.objectKey));
  }
  return map;
}

/**
 * Convert a stored object key (`/objects/<uuid>`) to the URL the browser uses
 * to fetch it through the api-server's storage route.
 */
export function objectKeyToUrl(objectKey: string): string {
  const trimmed = objectKey.startsWith("/objects/")
    ? objectKey.slice("/objects/".length)
    : objectKey;
  return `/api/storage/objects/${trimmed}`;
}

export interface UserImageDetail {
  uploadedByEmployeeId: string | null;
  uploadedByEmployeeName: string | null;
  uploadedAt: Date;
}

/**
 * Fetch attribution / metadata for a single user-uploaded photo. Returns null
 * when the product has no user image on file.
 */
export async function fetchUserImageDetail(
  netsuiteId: string
): Promise<UserImageDetail | null> {
  const rows = await db
    .select({
      uploadedByEmployeeId: productUserImagesTable.uploadedByEmployeeId,
      uploadedByEmployeeName: productUserImagesTable.uploadedByEmployeeName,
      uploadedAt: productUserImagesTable.uploadedAt,
    })
    .from(productUserImagesTable)
    .where(eq(productUserImagesTable.netsuiteId, netsuiteId))
    .limit(1);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    uploadedByEmployeeId: r.uploadedByEmployeeId,
    uploadedByEmployeeName: r.uploadedByEmployeeName,
    uploadedAt: r.uploadedAt,
  };
}

/**
 * Resolve which image and source to expose for a single product, given the
 * user-uploaded image lookup.
 */
export function resolveImage(
  p: { netsuiteId: string | null; imageUrl: string | null; categoryId: number | null },
  userImages: Map<string, string>
): ResolvedImage {
  if (p.imageUrl) return { imageUrl: p.imageUrl, imageSource: "netsuite" };
  if (
    p.netsuiteId != null &&
    p.categoryId === DISPLAYS_FOR_SALE_CATEGORY_ID &&
    userImages.has(p.netsuiteId)
  ) {
    return { imageUrl: userImages.get(p.netsuiteId)!, imageSource: "user" };
  }
  return { imageUrl: null, imageSource: null };
}
