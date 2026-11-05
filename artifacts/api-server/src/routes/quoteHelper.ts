import { Router, type IRouter } from "express";
import { requireEmployee } from "../lib/session";
import { quoteHelperPackage, quoteHelperVersion } from "../lib/quoteHelper";
import { QUICKADD_UPDATE_URL, quickAddPolicyValue, quickAddRelease, quickAddUpdateXml } from "../lib/quickAdd";

// Staff download of the Consumers Quote Helper extension (signed-in employees only).
const router: IRouter = Router();
router.use("/quote-helper", requireEmployee);

// router.get("/quote-helper", (_req, res) => {
//   const version = quoteHelperVersion();
//   res.json({ available: version != null, version });
// });
router.get("/quote-helper", (_req, res) => {
  const version = quoteHelperVersion();
  // 1.5.1: what IT needs for the Group Policy install, when a signed release is on this server.
  const release = quickAddRelease();
  const policy = release
    ? { extensionId: release.id, version: release.version, updateUrl: QUICKADD_UPDATE_URL, value: quickAddPolicyValue(release.id) }
    : null;
  res.json({ available: version != null, version, policy });
});

// Consumers QuickAdd for the Group Policy install. Public on purpose: Edge fetches these without a signed-in user.
router.get("/quickadd/update.xml", (_req, res) => {
  const release = quickAddRelease();
  if (!release) {
    res.status(404).type("text/plain").send("No QuickAdd release on this server.");
    return;
  }
  res.setHeader("Cache-Control", "no-cache");
  res.type("application/xml").send(quickAddUpdateXml(release));
});

router.get("/quickadd/:file", (req, res) => {
  const release = quickAddRelease();
  if (!release || req.params.file !== `consumers-quickadd-${release.version}.crx`) {
    res.status(404).type("text/plain").send("Not found.");
    return;
  }
  req.log.info({ version: release.version }, "QuickAdd package fetched");
  res.setHeader("Content-Type", "application/x-chrome-extension");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(release.crx);
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
