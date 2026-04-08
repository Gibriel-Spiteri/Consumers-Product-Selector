import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { logger } from "../lib/logger";
import { executeSuiteQL } from "../lib/netsuite";

const router: IRouter = Router();

const HERO_DIR = path.resolve(
  process.cwd(),
  "../product-selector/public"
);

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
    }
  },
});

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const employeeId = req.headers["x-employee-id"] as string | undefined;
  if (!employeeId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const result = await executeSuiteQL<{
      id: string;
      giveaccess: string;
      custentity_webstore_access: string;
      custentity_webstore_admin: string;
    }>(
      `SELECT id, giveaccess, custentity_webstore_access, custentity_webstore_admin
       FROM Employee WHERE id = ${Number(employeeId)}`
    );

    if (
      result.items.length === 0 ||
      result.items[0].giveaccess !== "T" ||
      result.items[0].custentity_webstore_access !== "T" ||
      result.items[0].custentity_webstore_admin !== "T"
    ) {
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  } catch {
    return res.status(500).json({ error: "Authorization check failed" });
  }
}

router.get("/admin/hero-image", (_req, res) => {
  const heroPath = path.join(HERO_DIR, "hero-kitchen.png");
  if (fs.existsSync(heroPath)) {
    res.json({ exists: true, url: `${process.env.BASE_URL || "/"}hero-kitchen.png` });
  } else {
    res.json({ exists: false, url: null });
  }
});

router.post("/admin/hero-image", requireAdmin, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided" });
  }

  try {
    if (!fs.existsSync(HERO_DIR)) {
      fs.mkdirSync(HERO_DIR, { recursive: true });
    }

    const destPath = path.join(HERO_DIR, "hero-kitchen.png");
    fs.writeFileSync(destPath, req.file.buffer);

    logger.info("Hero image updated");
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "Failed to update hero image");
    res.status(500).json({ error: "Failed to save image" });
  }
});

export default router;
