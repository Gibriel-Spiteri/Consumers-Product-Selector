import app from "./app";
import { logger } from "./lib/logger";
import { startScheduledSync, stopScheduledSync, loadPersistedSchedule } from "./lib/scheduler";
import { loadPersistedSyncResult } from "./lib/syncService";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  loadPersistedSyncResult().then(() => {
    loadPersistedSchedule().then(() => {
      startScheduledSync();
    });
  });

  const shutdown = () => {
    logger.info("Shutting down gracefully");
    stopScheduledSync();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
});
