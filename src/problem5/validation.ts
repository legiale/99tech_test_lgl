import type { TaskFilters, TaskInput, TaskStatus } from "./types.ts";

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function statusValue(value: unknown): TaskStatus {
  if (value !== "pending" && value !== "in_progress" && value !== "completed") {
    throw new HttpError(400, "status must be pending, in_progress, or completed");
  }
  return value;
}

function textValue(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string`);
  }
  const text = value.trim();
  if (text.includes("\u0000")) {
    throw new HttpError(400, `${field} must not contain null characters`);
  }
  if (text.length < min || text.length > max) {
    throw new HttpError(400, `${field} must contain ${min} to ${max} characters after trimming`);
  }
  return text;
}

export function parseTaskBody(body: unknown, partial: true): Partial<TaskInput>;
export function parseTaskBody(body: unknown, partial?: false): TaskInput;
export function parseTaskBody(body: unknown, partial = false): Partial<TaskInput> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "body must be a JSON object");
  }
  const fields = body as Record<string, unknown>;
  const keys = Object.keys(fields);
  if (keys.some((key) => !["title", "description", "status"].includes(key))) {
    throw new HttpError(400, "only title, description, and status may be supplied");
  }
  if (partial && keys.length === 0) {
    throw new HttpError(400, "provide at least one field to update");
  }

  const result: Partial<TaskInput> = {};
  if (!partial || Object.hasOwn(fields, "title")) {
    result.title = textValue(fields.title, "title", 1, 200);
  }
  if (Object.hasOwn(fields, "description")) {
    result.description = textValue(fields.description, "description", 0, 2_000);
  } else if (!partial) {
    result.description = "";
  }
  if (Object.hasOwn(fields, "status")) {
    result.status = statusValue(fields.status);
  } else if (!partial) {
    result.status = "pending";
  }
  return result;
}

export function parseId(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(400, "id must be a UUID v4");
  }
  return value.toLowerCase();
}

function integerQuery(value: unknown, fallback: number, min: number, max: number, name: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new HttpError(400, `${name} must be an integer between ${min} and ${max}`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new HttpError(400, `${name} must be an integer between ${min} and ${max}`);
  }
  return number;
}

export function parseFilters(query: Record<string, unknown>): TaskFilters {
  if (Object.keys(query).some((key) => !["status", "q", "limit", "offset"].includes(key))) {
    throw new HttpError(400, "supported query parameters are status, q, limit, and offset");
  }
  const filters: TaskFilters = {
    limit: integerQuery(query.limit, 20, 1, 100, "limit"),
    offset: integerQuery(query.offset, 0, 0, Number.MAX_SAFE_INTEGER, "offset"),
  };
  if (query.status !== undefined) filters.status = statusValue(query.status);
  if (query.q !== undefined) filters.q = textValue(query.q, "q", 1, 200);
  return filters;
}
