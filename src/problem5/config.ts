import { resolve } from "node:path";

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const rawPort = env.PORT ?? "3000";
  const port = Number(rawPort);
  if (!/^\d+$/.test(rawPort) || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer from 1 to 65535");
  }
  const host = env.HOST ?? "127.0.0.1";
  const dbPath = env.DB_PATH ?? "./data/problem5.sqlite";
  if (!host.trim() || !dbPath.trim()) throw new Error("HOST and DB_PATH must not be empty");
  return { port, host, dbPath: resolve(dbPath) };
}
