import { Router, type IRouter } from "express";
import { executeSuiteQL, netsuiteRequest, isNetSuiteConfigured } from "../lib/netsuite";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/estimates/search", async (req, res) => {
  const q = (req.query.q as string || "").trim();
  if (!q) {
    return res.status(400).json({ error: "Missing search query" });
  }

  if (!isNetSuiteConfigured()) {
    return res.status(503).json({ error: "NetSuite not configured" });
  }

  try {
    const stripped = q.replace(/^es/i, "");
    const searchVariants = [q];
    if (stripped !== q) {
      searchVariants.push(stripped);
    }
    if (/^\d+$/.test(stripped)) {
      searchVariants.push(`ES${stripped}`);
    }

    const uniqueVariants = [...new Set(searchVariants.map(v => v.replace(/'/g, "''").replace(/[%_\\]/g, "\\$&")))];
    const tranIdConditions = uniqueVariants.map(v => `t.tranid LIKE '%${v}%'`).join(" OR ");

    const result = await executeSuiteQL<{
      id: string;
      tranid: string;
      entityname: string;
      status: string;
      trandate: string;
      total: string | null;
    }>(`
      SELECT
        t.id,
        t.tranid,
        BUILTIN.DF(t.entity) AS entityname,
        BUILTIN.DF(t.status) AS status,
        t.trandate,
        t.total
      FROM Estimate t
      WHERE (${tranIdConditions})
      AND t.status NOT IN ('Estimate : Voided', 'Estimate : Declined')
      ORDER BY t.trandate DESC
      FETCH FIRST 20 ROWS ONLY
    `);

    const estimates = result.items.slice(0, 20).map(row => ({
      id: Number(row.id),
      tranId: row.tranid,
      customerName: row.entityname ?? "",
      status: row.status ?? "",
      date: row.trandate ?? "",
      total: row.total ? parseFloat(row.total) : null,
    }));

    res.json({ estimates });
  } catch (err) {
    logger.error({ err }, "Failed to search estimates");
    res.status(500).json({ error: "Failed to search estimates" });
  }
});

router.post("/estimates/:estimateId/add-items", async (req, res) => {
  const estimateId = Number(req.params.estimateId);
  if (isNaN(estimateId)) {
    return res.status(400).json({ error: "Invalid estimate ID" });
  }

  const { items } = req.body as {
    items: Array<{ netsuiteId: string; quantity: number }>;
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Items array is required" });
  }

  let validatedItems: Array<{ netsuiteId: number; quantity: number }>;
  try {
    validatedItems = items.map((item, idx) => {
      const nsId = Number(item.netsuiteId);
      const qty = Math.floor(Number(item.quantity));
      if (isNaN(nsId) || nsId <= 0) {
        throw new Error(`Invalid netsuiteId at index ${idx}`);
      }
      if (isNaN(qty) || qty < 1) {
        throw new Error(`Invalid quantity at index ${idx}`);
      }
      return { netsuiteId: nsId, quantity: qty };
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }

  if (!isNetSuiteConfigured()) {
    return res.status(503).json({ error: "NetSuite not configured" });
  }

  try {
    const existing = await netsuiteRequest<{
      id: number;
      tranId: string;
      item?: {
        items?: Array<{
          item: { id: number };
          quantity: number;
          amount: number;
          line: number;
        }>;
      };
    }>(`/estimate/${estimateId}?expandSubResources=true`);

    const existingLines = existing.item?.items ?? [];

    const newLines = validatedItems.map(item => ({
      item: { id: item.netsuiteId },
      quantity: item.quantity,
    }));

    const allLines = [
      ...existingLines.map(line => ({
        item: { id: line.item.id },
        quantity: line.quantity,
        line: line.line,
      })),
      ...newLines,
    ];

    await netsuiteRequest(
      `/estimate/${estimateId}`,
      "PATCH",
      {
        custbody_weborder: true,
        item: {
          items: allLines,
        },
      }
    );

    logger.info(
      { estimateId, tranId: existing.tranId, newItemCount: validatedItems.length },
      "Added items to estimate"
    );

    res.json({
      success: true,
      estimateId,
      tranId: existing.tranId,
      itemsAdded: validatedItems.length,
    });
  } catch (err: any) {
    logger.error({ err, estimateId }, "Failed to add items to estimate");
    res.status(500).json({
      error: "Failed to add items to estimate",
      detail: err?.message ?? "Unknown error",
    });
  }
});

export default router;
