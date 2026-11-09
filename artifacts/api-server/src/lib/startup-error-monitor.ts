import { logger } from "./logger";

// Observe fatal errors without catching them: Node must still exit rather than
// leave a potentially corrupted API process serving requests. Production Pino
// emits this as one JSON line so multiline stderr truncation cannot hide the
// exception message behind Node's "Unhandled 'error' event" header.
process.on("uncaughtExceptionMonitor", (err, origin) => {
  logger.fatal({ err, origin }, "API process terminating after an uncaught exception");
});
