import express, { type ErrorRequestHandler } from "express";
import { TaskStore } from "./store.ts";
import { HttpError, parseFilters, parseId, parseTaskBody } from "./validation.ts";

export function createApp(store: TaskStore) {
  const app = express();
  app.disable("x-powered-by");
  app.set("query parser", "simple");

  app.use((req, _res, next) => {
    if (["POST", "PATCH"].includes(req.method) && !req.is("application/json")) {
      return next(new HttpError(415, "Content-Type must be application/json"));
    }
    next();
  });
  app.use(express.json({ limit: "16kb", strict: false }));

  app.get("/health", (_req, res) => {
    store.ping();
    res.json({ status: "ok" });
  });

  app.post("/tasks", (req, res) => {
    const task = store.create(parseTaskBody(req.body));
    res.location(`/tasks/${task.id}`).status(201).json({ data: task });
  });

  app.get("/tasks", (req, res) => {
    res.json(store.list(parseFilters(req.query)));
  });

  app.get("/tasks/:id", (req, res) => {
    const task = store.get(parseId(req.params.id));
    if (!task) throw new HttpError(404, "task not found");
    res.json({ data: task });
  });

  app.patch("/tasks/:id", (req, res) => {
    const id = parseId(req.params.id);
    const task = store.update(id, parseTaskBody(req.body, true));
    if (!task) throw new HttpError(404, "task not found");
    res.json({ data: task });
  });

  app.delete("/tasks/:id", (req, res) => {
    if (!store.delete(parseId(req.params.id))) throw new HttpError(404, "task not found");
    res.status(204).end();
  });

  app.use((_req, _res, next) => next(new HttpError(404, "route not found")));

  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: { message: error.message } });
      return;
    }
    const type = typeof error === "object" && error !== null && "type" in error ? error.type : undefined;
    if (type === "entity.parse.failed") {
      res.status(400).json({ error: { message: "body must be valid JSON" } });
      return;
    }
    if (type === "entity.too.large") {
      res.status(413).json({ error: { message: "JSON body exceeds 16kb" } });
      return;
    }
    if (type === "charset.unsupported" || type === "encoding.unsupported") {
      res.status(415).json({ error: { message: "unsupported request encoding" } });
      return;
    }
    console.error("Request failed:", error);
    res.status(500).json({ error: { message: "internal server error" } });
  };
  app.use(errorHandler);
  return app;
}
