import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";

const router = Router();

const NETSUITE_ACCOUNT_ID = process.env.NETSUITE_ACCOUNT_ID || "";

function getSuiteletBaseUrl(): string {
  let raw = NETSUITE_ACCOUNT_ID.trim();
  raw = raw.replace(/^https?:\/\//, "");
  raw = raw.replace(/\.app\.netsuite\.com\/?.*$/, "");
  raw = raw.replace(/\.suitetalk\.api\.netsuite\.com\/?.*$/, "");
  raw = raw.replace(/\/$/, "");
  const accountId = raw.toLowerCase().replace(/_/g, "-");
  return `https://${accountId}.app.netsuite.com`;
}

const SUITELET_PATH =
  "/app/site/hosting/scriptlet.nl?script=659&deploy=1";

router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    if (!NETSUITE_ACCOUNT_ID) {
      res.status(503).json({ error: "NetSuite is not configured" });
      return;
    }

    const baseUrl = getSuiteletBaseUrl();
    const url = `${baseUrl}${SUITELET_PATH}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;

    logger.info({ email }, "Employee login attempt");

    const response = await fetch(url);
    const text = await response.text();

    logger.debug({ responseText: text }, "Suitelet login response");

    if (text.startsWith("logged##")) {
      const empId = text.split("##")[1];
      const nameUrl = `${baseUrl}${SUITELET_PATH}&type=id&id=${encodeURIComponent(empId)}`;
      const nameResponse = await fetch(nameUrl);
      const empName = await nameResponse.text();

      res.json({
        status: "success",
        employeeId: empId,
        employeeName: empName.trim(),
      });
    } else if (text === "PNM") {
      res.status(401).json({ error: "Incorrect password" });
    } else if (text === "NEA") {
      res.status(403).json({ error: "No access granted for this account" });
    } else {
      res.status(401).json({ error: "Login failed" });
    }
  } catch (err) {
    logger.error({ err }, "Employee login error");
    res.status(500).json({ error: "Login service unavailable" });
  }
});

export default router;
