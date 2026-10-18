import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { Task, TaskFilters, TaskInput } from "./types.ts";

const columns = "id, title, description, status, created_at AS createdAt, updated_at AS updatedAt";

export class TaskStore {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path, { timeout: 5_000 });
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
        description TEXT NOT NULL DEFAULT '' CHECK(length(description) <= 2000),
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK(status IN ('pending', 'in_progress', 'completed')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS tasks_created ON tasks(created_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS tasks_status_created ON tasks(status, created_at DESC, id DESC);
    `);
  }

  create(input: TaskInput): Task {
    const id = randomUUID();
    const now = new Date().toISOString();
    return this.db.prepare(`
      INSERT INTO tasks (id, title, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?) RETURNING ${columns}
    `).get(id, input.title, input.description, input.status, now, now) as unknown as Task;
  }

  list(filters: TaskFilters): { data: Task[]; total: number; limit: number; offset: number } {
    const conditions: string[] = [];
    const parameters: SQLInputValue[] = [];
    if (filters.status !== undefined) {
      conditions.push("status = ?");
      parameters.push(filters.status);
    }
    if (filters.q !== undefined) {
      // Literal substring search: '%' and '_' are not treated as wildcards.
      conditions.push("(instr(lower(title), lower(?)) > 0 OR instr(lower(description), lower(?)) > 0)");
      parameters.push(filters.q, filters.q);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    // Keep the count and page on the same SQLite read snapshot.
    this.db.exec("BEGIN");
    try {
      const count = this.db.prepare(`SELECT count(*) AS total FROM tasks ${where}`).get(...parameters)!;
      const data = this.db.prepare(`
        SELECT ${columns} FROM tasks ${where}
        ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?
      `).all(...parameters, filters.limit, filters.offset) as unknown as Task[];
      this.db.exec("COMMIT");
      return { data, total: Number(count.total), limit: filters.limit, offset: filters.offset };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  get(id: string): Task | undefined {
    return this.db.prepare(`SELECT ${columns} FROM tasks WHERE id = ?`).get(id) as unknown as Task | undefined;
  }

  update(id: string, patch: Partial<TaskInput>): Task | undefined {
    // COALESCE preserves omitted fields; validation disallows null.
    return this.db.prepare(`
      UPDATE tasks SET title = COALESCE(?, title), description = COALESCE(?, description),
        status = COALESCE(?, status), updated_at = ?
      WHERE id = ? RETURNING ${columns}
    `).get(patch.title ?? null, patch.description ?? null, patch.status ?? null,
      new Date().toISOString(), id) as unknown as Task | undefined;
  }

  delete(id: string): boolean {
    return this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id).changes > 0;
  }

  ping(): void {
    this.db.prepare("SELECT 1").get();
  }

  close(): void {
    this.db.close();
  }
}
