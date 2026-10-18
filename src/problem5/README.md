# Problem 5: A Crude Server

## Problem statement

Develop a backend server using **ExpressJS and TypeScript**, with CRUD interfaces to:

1. Create a resource.
2. List resources with basic filters.
3. Get details of a resource.
4. Update resource details.
5. Delete a resource.

Connect the server to a simple database for persistence, and provide configuration and run instructions in a README.

## Solution and assumptions

The server uses Express 5 and a local SQLite file through Node's built-in `node:sqlite` module. 
The database and schema are created automatically on first startup; no separate database server is needed.

This solution assumes one shared task collection, uses `PATCH` for partial updates, 
and provides status and text filters plus pagination. 
No authentication or user ownership is implemented because they are outside the specified CRUD scope. 
The server listens on localhost by default.

## Requirements and setup

- Node.js **24 or newer**, with npm.
- Run all commands below from the repository root.

```sh
# If using nvm:
nvm install
nvm use

npm ci

# Optional: customize settings (defaults work without this file).
cp .env.example .env
```

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | Interface to listen on; use `0.0.0.0` if needed for a container |
| `PORT` | `3000` | Integer port from 1 to 65535 |
| `DB_PATH` | `./data/problem5.sqlite` | SQLite file; relative paths resolve from the working directory |

Scripts automatically load the root `.env` file if present. 
Existing environment variables take precedence. 
The database parent directory is created automatically and needs to be writable. 
Local `.env` and database files are excluded from Git.

## Run

```sh
npm run start:problem5

# Or restart automatically when source files change:
npm run dev:problem5
```

The default URL is `http://127.0.0.1:3000`.

```sh
curl http://127.0.0.1:3000/health
# {"status":"ok"}
```
`npm run typecheck` performs static checking separately. 


## Task representation

```json
{
  "id": "c1ff01ab-d083-4dfd-830e-b20c1b143e89",
  "title": "Prepare interview submission",
  "description": "Review the README and tests",
  "status": "pending",
  "createdAt": "2026-10-19T08:00:00.000Z",
  "updatedAt": "2026-10-19T08:00:00.000Z"
}
```

| Field | Rules |
| --- | --- |
| `id` | Server-generated UUID v4, read-only |
| `title` | Required on create; string of 1–200 UTF-16 code units after trimming |
| `description` | Optional on create, defaults to `""`; string of at most 2,000 UTF-16 code units after trimming |
| `status` | `pending`, `in_progress`, or `completed`; defaults to `pending` on create |
| `createdAt`, `updatedAt` | Server-generated ISO 8601 UTC timestamps, read-only |

Unknown body fields, null values, and strings containing null characters are rejected. JSON request bodies are limited to 16 KB. `POST` and `PATCH` require `Content-Type: application/json`.

## Endpoints

| Method | Endpoint | Success response |
| --- | --- | --- |
| `GET` | `/health` | `200`, checks database connectivity |
| `POST` | `/tasks` | `201`, `{ "data": task }`, with a `Location` header |
| `GET` | `/tasks` | `200`, `{ "data": [...], "total": 0, "limit": 20, "offset": 0 }` |
| `GET` | `/tasks/:id` | `200`, `{ "data": task }` |
| `PATCH` | `/tasks/:id` | `200`, `{ "data": updatedTask }` |
| `DELETE` | `/tasks/:id` | `204`, no body |


### List filters and pagination

| Query parameter | Behavior |
| --- | --- |
| `status` | Exact match on a supported task status |
| `q` | Literal substring in title or description; 1–200 UTF-16 code units after trimming |
| `limit` | Integer from 1 to 100; default 20 |
| `offset` | Nonnegative safe integer; default 0 |

Filters combine with AND. 
Search is case-insensitive for ASCII characters using SQLite's built-in `lower()`; 
it does not provide full Unicode case folding. `%` and `_` are treated literally. 
Unknown or repeated query parameters return `400`.

Results sort by `createdAt DESC, id DESC` for deterministic ordering. `total` counts all matching tasks before pagination. Count and page are read in one database transaction. Offset pagination can shift between separate requests when data changes.

## Example requests

Create a task:

```sh
curl -i -X POST http://127.0.0.1:3000/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Prepare interview submission","description":"Review README and tests"}'
```

Copy the returned `data.id` into `TASK_ID`:

```sh
TASK_ID='paste-returned-id-here'

# List pending tasks mentioning "interview".
curl 'http://127.0.0.1:3000/tasks?status=pending&q=interview&limit=10&offset=0'

# Read one task.
curl "http://127.0.0.1:3000/tasks/$TASK_ID"

# Update selected fields.
curl -X PATCH "http://127.0.0.1:3000/tasks/$TASK_ID" \
  -H 'Content-Type: application/json' \
  -d '{"status":"completed"}'

# Delete it.
curl -i -X DELETE "http://127.0.0.1:3000/tasks/$TASK_ID"
```

## Error responses

Errors use the same JSON shape:

```json
{ "error": { "message": "task not found" } }
```

| Status | Meaning |
| --- | --- |
| `400` | Invalid body, JSON, ID, or query parameters |
| `404` | Task or route not found |
| `413` | Body exceeds 16 KB |
| `415` | Unsupported content type, charset, or encoding |
| `500` | Unexpected server/database failure; details logged on the server |

## Tests

```sh
npm run typecheck
npm run test:problem5

# Both implemented problems:
npm test
```

Tests make actual HTTP requests to ephemeral localhost ports and use isolated SQLite databases. 
They cover the CRUD lifecycle, defaults and trimming, partial-update preservation, combined filters, pagination, literal search and SQL-injection-like input, invalid bodies/queries/IDs, malformed JSON, content types, oversized requests, missing resources, and configuration validation. 


## Design and tradeoffs

- [app.ts](app.ts): Express routes, JSON middleware, and consistent HTTP errors. The app factory keeps HTTP setup separate from startup for testing.
- [validation.ts](validation.ts): Runtime input validation; TypeScript alone cannot validate incoming JSON.
- [store.ts](store.ts): SQLite schema and parameterized queries. Updates and deletes are single statements, and status/order indexes support basic listings.
- [config.ts](config.ts) and [server.ts](server.ts): Configuration, startup, and graceful shutdown.
- [types.ts](types.ts): Shared task types.

SQLite uses WAL mode and a five-second lock timeout. 
Data survives restarts at the same `DB_PATH`. 
Back up the database using SQLite-aware tooling, or stop the server before copying the file so WAL contents are included. 
There is no schema migration framework for this initial single-table schema.

Database calls are synchronous and can block the Node event loop. This keeps a small take-home service simple; a high-throughput service would use workers or a separate database with an asynchronous driver. Substring search and total counts can scan many rows; large offsets also become slower. The native SQLite API may emit an experimental warning on some Node 24 versions.

