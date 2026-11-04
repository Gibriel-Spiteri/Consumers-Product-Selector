import { Router, type IRouter } from "express";
import { requireEmployee } from "../lib/session";
import { quoteHelperPackage, quoteHelperVersion } from "../lib/quoteHelper";

// Staff download of the Consumers Quote Helper extension (signed-in employees only).
const router: IRouter = Router();
router.use("/quote-helper", requireEmployee);

router.get("/quote-helper", (_req, res) => {
  const version = quoteHelperVersion();
  res.json({ available: version != null, version });
});

router.get("/quote-helper/download", (req, res) => {
  const pkg = quoteHelperPackage();
  if (!pkg) {
    res.status(404).json({ error: "The Quote Helper files are not on this server." });
    return;
  }
  req.log.info({ employeeId: res.locals.employeeId, version: pkg.version }, "Quote Helper downloaded");
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${pkg.fileName}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(pkg.zip);
});

export default router;
