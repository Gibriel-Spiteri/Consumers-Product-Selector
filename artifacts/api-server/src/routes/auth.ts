import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import {
  getEmployeeByEmail,
  getEmployeeByNetsuiteId,
} from "../lib/employees";
import { verifyPassword } from "../lib/password";
import { bearerToken, signSession, verifySession } from "../lib/session";

const router: IRouter = Router();

router.post("/auth/login", async (req, res) => {
  if (process.env.NODE_ENV === "production" && !req.secure) {
    logger.warn(
      { protocol: req.protocol },
      "Rejected login over insecure transport",
    );
    return res
      .status(400)
      .json({ error: "Login must be performed over HTTPS" });
  }

  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const emp = await getEmployeeByEmail(String(email));

    if (!emp) {
      logger.info({ email }, "Login failed: employee not found");
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!emp.giveAccess) {
      logger.info({ email }, "Login failed: no system access");
      return res.status(403).json({ error: "Your account does not have system access" });
    }

    if (!emp.webstoreAccess) {
      logger.info({ email }, "Login failed: no webstore access");
      return res.status(403).json({ error: "Your account is not authorized to access the Product Selector" });
    }

    const passwordOk = await verifyPassword(String(password), emp.passwordHash);
    if (!passwordOk) {
      logger.info({ email }, "Login failed: wrong password");
      return res.status(401).json({ error: "Invalid email or password" });
    }

    logger.info({ email, employeeId: emp.netsuiteId }, "Employee logged in");

    res.json({
      token: signSession(emp.netsuiteId),
      employee: {
        id: emp.netsuiteId,
        entityId: emp.entityId,
        email: emp.email,
        firstName: emp.firstName,
        lastName: emp.lastName,
        isAdmin: emp.webstoreAdmin,
        locationId: emp.locationId ?? null,
        locationName: emp.locationName ?? null,
      },
    });
  } catch (err: any) {
    logger.error({ err }, "Login error");
    res.status(500).json({ error: "Authentication service unavailable" });
  }
});

router.post("/auth/verify", async (req, res) => {
  // 2026-11-03: the employee comes from the signed sign-in token, not from an
  // id the browser sends (anyone could send any id). Browsers signed in before
  // this have no token and are asked to sign in again once.
  // const { employeeId } = req.body ?? {};
  //
  // if (!employeeId) {
  //   return res.status(400).json({ valid: false });
  // }
  const employeeId = verifySession(bearerToken(req));
  if (!employeeId) {
    return res.json({ valid: false });
  }

  try {
    const emp = await getEmployeeByNetsuiteId(String(employeeId));

    if (!emp) {
      return res.json({ valid: false });
    }

    const valid = emp.giveAccess && emp.webstoreAccess;

    res.json({
      valid,
      // Fresh token on every app load, so active users stay signed in.
      ...(valid ? { token: signSession(emp.netsuiteId) } : {}),
      employee: valid
        ? {
            id: emp.netsuiteId,
            entityId: emp.entityId,
            email: emp.email,
            firstName: emp.firstName,
            lastName: emp.lastName,
            isAdmin: emp.webstoreAdmin,
            locationId: emp.locationId ?? null,
            locationName: emp.locationName ?? null,
          }
        : undefined,
    });
  } catch {
    res.json({ valid: false });
  }
});

export default router;
