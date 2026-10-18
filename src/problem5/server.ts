import { createApp } from "./app.ts";
import { loadConfig } from "./config.ts";
import { TaskStore } from "./store.ts";

const config = loadConfig();
const store = new TaskStore(config.dbPath);
const server = createApp(store).listen(config.port, config.host, () => {
  console.log(`Task API listening at http://${config.host}:${config.port}`);
  console.log(`SQLite database: ${config.dbPath}`);
});

server.on("error", (error) => {
  console.error("Server failed to listen:", error.message);
  store.close();
  process.exitCode = 1;
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  // Stop accepting requests, finish active requests, then close SQLite.
  const timeout = setTimeout(() => server.closeAllConnections(), 10_000);
  timeout.unref();
  server.close(() => {
    clearTimeout(timeout);
    store.close();
  });
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
