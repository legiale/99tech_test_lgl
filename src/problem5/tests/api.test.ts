import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { createApp } from "../app.ts";
import { loadConfig } from "../config.ts";
import { TaskStore } from "../store.ts";
import type { Task } from "../types.ts";

async function fixture(t: TestContext, path = ":memory:") {
  const store = new TaskStore(path);
  const server = createApp(store).listen(0, "127.0.0.1");
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error && !("code" in error && error.code === "ERR_SERVER_NOT_RUNNING")) reject(error);
          else resolve();
        });
        server.closeAllConnections();
      });
    } finally {
      store.close();
    }
  };
  t.after(close);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;

  async function request(path: string, method = "GET", body?: unknown) {
    return fetch(`${base}${path}`, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function create(body: unknown): Promise<Task> {
    const response = await request("/tasks", "POST", body);
    assert.equal(response.status, 201);
    const json = await response.json() as { data: Task };
    assert.equal(response.headers.get("location"), `/tasks/${json.data.id}`);
    return json.data;
  }
  return { base, request, create, close, store };
}

test("CRUD lifecycle: create, list, read, patch, delete", async (t) => {
  const { request, create } = await fixture(t);
  const health = await request("/health");
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });

  const task = await create({ title: "  Interview prep  " });
  assert.equal(task.title, "Interview prep");
  assert.equal(task.description, "");
  assert.equal(task.status, "pending");
  assert.ok(Number.isFinite(Date.parse(task.createdAt)));
  assert.equal(task.createdAt, task.updatedAt);

  const read = await request(`/tasks/${task.id}`);
  assert.equal(read.status, 200);
  assert.deepEqual(await read.json(), { data: task });
  const upperCaseId = await request(`/tasks/${task.id.toUpperCase()}`);
  assert.equal(upperCaseId.status, 200);

  const list = await request("/tasks");
  assert.deepEqual(await list.json(), { data: [task], total: 1, limit: 20, offset: 0 });

  const patch = await request(`/tasks/${task.id}`, "PATCH", { status: "completed", description: " Done " });
  assert.equal(patch.status, 200);
  const updated = (await patch.json() as { data: Task }).data;
  assert.equal(updated.title, task.title);
  assert.equal(updated.description, "Done");
  assert.equal(updated.status, "completed");
  assert.equal(updated.createdAt, task.createdAt);
  assert.ok(updated.updatedAt >= task.updatedAt);

  const clear = await request(`/tasks/${task.id}`, "PATCH", { title: "New title", description: "" });
  const cleared = (await clear.json() as { data: Task }).data;
  assert.equal(cleared.title, "New title");
  assert.equal(cleared.description, "");
  assert.equal(cleared.status, "completed");

  const deletion = await request(`/tasks/${task.id}`, "DELETE");
  assert.equal(deletion.status, 204);
  assert.equal(await deletion.text(), "");
  assert.equal((await request(`/tasks/${task.id}`)).status, 404);
  assert.equal((await request(`/tasks/${task.id}`, "DELETE")).status, 404);
  assert.equal((await request("/tasks").then((r) => r.json()) as { total: number }).total, 0);
});

test("filters combine status and literal text search with stable pagination", async (t) => {
  const { request, create } = await fixture(t);
  await create({ title: "Ship API", description: "Backend release", status: "completed" });
  await create({ title: "Write tests", description: "API coverage", status: "pending" });
  await create({ title: "UI work", status: "in_progress" });
  const literal = await create({ title: "100%_done" });

  const filtered = await request("/tasks?status=pending&q=API&limit=1");
  const result = await filtered.json() as { data: Task[]; total: number; limit: number; offset: number };
  assert.equal(result.total, 1);
  assert.equal(result.data[0]?.title, "Write tests");
  assert.equal(result.limit, 1);
  assert.equal(result.offset, 0);

  const all = await request("/tasks").then((r) => r.json()) as { data: Task[] };
  const page = await request("/tasks?limit=2&offset=1").then((r) => r.json()) as { data: Task[]; total: number };
  assert.deepEqual(page.data, all.data.slice(1, 3));
  assert.equal(page.total, 4);
  const empty = await request("/tasks?offset=100").then((r) => r.json()) as { data: Task[]; total: number };
  assert.deepEqual(empty.data, []);
  assert.equal(empty.total, 4);

  const percent = await request("/tasks?q=%25_").then((r) => r.json()) as { data: Task[] };
  assert.deepEqual(percent.data, [literal]);
  const injection = await request(`/tasks?q=${encodeURIComponent("' OR 1=1 --")}`).then((r) => r.json()) as { total: number };
  assert.equal(injection.total, 0);
});

test("invalid create and update bodies are rejected without changing data", async (t) => {
  const { request, create } = await fixture(t);
  const task = await create({ title: "Unchanged" });
  const invalidBodies = [
    null, [], "text", 12, {}, { title: " " }, { title: 5 },
    { title: "x".repeat(201) }, { title: "ok", description: null },
    { title: "ok", description: "x".repeat(2001) },
    { title: "ok", status: "unknown" }, { title: "ok", id: randomUUID() },
    { title: "ok", createdAt: "forged" }, { title: "\u0000" },
  ];
  for (const body of invalidBodies) {
    const response = await request("/tasks", "POST", body);
    assert.equal(response.status, 400, JSON.stringify(body));
    const error = await response.json() as { error: { message: string } };
    assert.equal(typeof error.error.message, "string");
  }
  for (const body of [{}, { title: "" }, { status: null }, { description: 1 }, { extra: true }]) {
    assert.equal((await request(`/tasks/${task.id}`, "PATCH", body)).status, 400);
  }
  assert.deepEqual(await request(`/tasks/${task.id}`).then((r) => r.json()), { data: task });
  const list = await request("/tasks").then((r) => r.json()) as { total: number };
  assert.equal(list.total, 1);

  const boundary = await create({ title: "x".repeat(200), description: "x".repeat(2000) });
  assert.equal(boundary.title.length, 200);
  assert.equal(boundary.description.length, 2000);
});

test("invalid, repeated, and unknown query parameters return 400", async (t) => {
  const { request } = await fixture(t);
  for (const query of [
    "limit=0", "limit=101", "limit=1.2", "limit=1e2", "limit=", "limit=2&limit=3",
    "offset=-1", "offset=9007199254740992", "status=bad", "status=pending&status=completed",
    "q=", "q=a&q=b", `q=${"a".repeat(201)}`, "unknown=yes", "status[x]=pending",
  ]) {
    assert.equal((await request(`/tasks?${query}`)).status, 400, query);
  }
});

test("malformed IDs, missing tasks, and unknown routes have consistent errors", async (t) => {
  const { request } = await fixture(t);
  for (const method of ["GET", "PATCH", "DELETE"]) {
    const body = method === "PATCH" ? { title: "missing" } : undefined;
    assert.equal((await request("/tasks/not-a-uuid", method, body)).status, 400);
    const missing = await request(`/tasks/${randomUUID()}`, method, body);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: { message: "task not found" } });
  }
  const unknown = await request("/unknown");
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unknown.json(), { error: { message: "route not found" } });
});

test("JSON parsing, content type, encoding, and request size are validated", async (t) => {
  const { base, request } = await fixture(t);
  const invalidJson = await fetch(`${base}/tasks`, {
    method: "POST", headers: { "content-type": "application/json" }, body: "{",
  });
  assert.equal(invalidJson.status, 400);
  assert.deepEqual(await invalidJson.json(), { error: { message: "body must be valid JSON" } });
  const plainText = await fetch(`${base}/tasks`, { method: "POST", body: "hello" });
  assert.equal(plainText.status, 415);
  const missingBody = await fetch(`${base}/tasks`, {
    method: "POST", headers: { "content-type": "application/json" },
  });
  assert.equal(missingBody.status, 400);
  const encoding = await fetch(`${base}/tasks`, {
    method: "POST", headers: { "content-type": "application/json", "content-encoding": "unsupported" }, body: "{}",
  });
  assert.equal(encoding.status, 415);
  const largeBody = await request("/tasks", "POST", { title: "ok", description: "x".repeat(17_000) });
  assert.equal(largeBody.status, 413);
});

test("file database preserves creates, updates, and deletes after reopening", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "tech99-problem5-"));
  const dbPath = join(directory, "nested", "tasks.sqlite");
  const fixtures: Awaited<ReturnType<typeof fixture>>[] = [];
  try {
    const first = await fixture(t, dbPath);
    fixtures.push(first);
    const task = await first.create({ title: "Persistent task" });
    const removed = await first.create({ title: "Deleted task" });
    assert.equal((await first.request(`/tasks/${task.id}`, "PATCH", { status: "completed" })).status, 200);
    assert.equal((await first.request(`/tasks/${removed.id}`, "DELETE")).status, 204);
    await first.close();

    const second = await fixture(t, dbPath);
    fixtures.push(second);
    const response = await second.request(`/tasks/${task.id}`);
    assert.equal(response.status, 200);
    const saved = (await response.json() as { data: Task }).data;
    assert.equal(saved.title, task.title);
    assert.equal(saved.status, "completed");
    assert.equal(saved.createdAt, task.createdAt);
    assert.equal((await second.request(`/tasks/${removed.id}`)).status, 404);
    await second.close();
  } finally {
    for (const instance of fixtures) await instance.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("configuration validates port and empty settings", () => {
  const defaults = loadConfig({});
  assert.equal(defaults.port, 3000);
  assert.equal(defaults.host, "127.0.0.1");
  assert.ok(defaults.dbPath.endsWith("data/problem5.sqlite"));
  assert.equal(loadConfig({ PORT: "4567", HOST: "0.0.0.0" }).port, 4567);
  for (const port of ["", "0", "65536", "3.5", "-1", "abc", "1e3"]) {
    assert.throws(() => loadConfig({ PORT: port }), /PORT/);
  }
  assert.throws(() => loadConfig({ DB_PATH: " " }), /DB_PATH/);
  assert.throws(() => loadConfig({ HOST: "" }), /HOST/);
});
