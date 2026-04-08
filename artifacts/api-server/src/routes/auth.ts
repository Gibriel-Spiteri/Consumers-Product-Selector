import { Router, type IRouter } from "express";
import { executeSuiteQL } from "../lib/netsuite";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const result = await executeSuiteQL<{
      id: string;
      entityid: string;
      email: string;
      firstname: string;
      lastname: string;
      giveaccess: string;
      custentity_webstorepassword: string;
      custentity_webstore_access: string;
      custentity_webstore_admin: string;
    }>(
      `SELECT
        id, entityid, email, firstname, lastname,
        giveaccess, custentity_webstorepassword, custentity_webstore_access,
        custentity_webstore_admin
      FROM Employee
      WHERE LOWER(email) = LOWER('${email.replace(/'/g, "''")}')`
    );

    if (result.items.length === 0) {
      logger.info({ email }, "Login failed: employee not found");
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const emp = result.items[0];

    if (emp.giveaccess !== "T") {
      logger.info({ email }, "Login failed: no system access");
      return res.status(403).json({ error: "Your account does not have system access" });
    }

    if (emp.custentity_webstore_access !== "T") {
      logger.info({ email }, "Login failed: no webstore access");
      return res.status(403).json({ error: "Your account is not authorized to access the Product Selector" });
    }

    if (emp.custentity_webstorepassword !== password) {
      logger.info({ email }, "Login failed: wrong password");
      return res.status(401).json({ error: "Invalid email or password" });
    }

    logger.info({ email, employeeId: emp.id }, "Employee logged in");

    res.json({
      employee: {
        id: emp.id,
        entityId: emp.entityid,
        email: emp.email,
        firstName: emp.firstname,
        lastName: emp.lastname,
        isAdmin: emp.custentity_webstore_admin === "T",
      },
    });
  } catch (err: any) {
    logger.error({ err }, "Login error");
    res.status(500).json({ error: "Authentication service unavailable" });
  }
});

router.post("/auth/verify", async (req, res) => {
  const { employeeId } = req.body;

  if (!employeeId) {
    return res.status(400).json({ valid: false });
  }

  try {
    const result = await executeSuiteQL<{
      id: string;
      custentity_webstore_access: string;
      custentity_webstore_admin: string;
      giveaccess: string;
      firstname: string;
      lastname: string;
      email: string;
      entityid: string;
    }>(
      `SELECT id, custentity_webstore_access, custentity_webstore_admin, giveaccess, firstname, lastname, email, entityid
       FROM Employee WHERE id = ${Number(employeeId)}`
    );

    if (result.items.length === 0) {
      return res.json({ valid: false });
    }

    const emp = result.items[0];
    const valid = emp.giveaccess === "T" && emp.custentity_webstore_access === "T";

    res.json({
      valid,
      employee: valid
        ? {
            id: emp.id,
            entityId: emp.entityid,
            email: emp.email,
            firstName: emp.firstname,
            lastName: emp.lastname,
            isAdmin: emp.custentity_webstore_admin === "T",
          }
        : undefined,
    });
  } catch {
    res.json({ valid: false });
  }
});

export default router;
