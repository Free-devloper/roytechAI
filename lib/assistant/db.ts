import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ChatTurn } from "./types";

export type ChunkRow = {
  id: string;
  source: string;
  section: string;
  text: string;
  embedding: number[];
};

function candidatePaths(fileName: string) {
  const paths = [
    join(process.cwd(), "data", fileName),
    join(process.cwd(), "..", "data", fileName),
  ];
  try {
    paths.push(join(dirname(fileURLToPath(import.meta.url)), "../../data", fileName));
  } catch {
    // bundled CJS has no import.meta
  }
  return paths;
}

function readFirst(fileName: string) {
  for (const path of candidatePaths(fileName)) {
    try {
      return { path, bytes: readFileSync(path) };
    } catch {
      // try next
    }
  }
  return null;
}

let cachedChunks: ChunkRow[] | null = null;

async function bundledChunks() {
  try {
    const mod = await import("../../data/chunks.json", { with: { type: "json" } });
    const data = (mod as { default?: ChunkRow[] }).default ?? (mod as unknown as ChunkRow[]);
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export async function loadChunks(): Promise<ChunkRow[]> {
  if (cachedChunks) return cachedChunks;
  const bundled = await bundledChunks();
  if (bundled && bundled.length > 0) {
    cachedChunks = bundled;
    return cachedChunks;
  }
  const json = readFirst("chunks.json");
  if (json) {
    cachedChunks = JSON.parse(json.bytes.toString("utf8")) as ChunkRow[];
    return cachedChunks;
  }
  const sqliteChunks = await loadChunksFromSqlite();
  cachedChunks = sqliteChunks;
  return sqliteChunks;
}

type SqliteEngine = {
  Database: new (data?: ArrayLike<number>) => {
    run(sql: string, params?: unknown[]): unknown;
    exec(sql: string): Array<{ values: Array<Array<string | number | null | Uint8Array>> }>;
    prepare(sql: string): {
      bind(values?: Record<string, unknown>): boolean;
      step(): boolean;
      getAsObject(): Record<string, unknown>;
      free(): boolean;
    };
    export(): Uint8Array;
  };
};

let sqlite: { engine: SqliteEngine; memory: InstanceType<SqliteEngine["Database"]> | null } | null | undefined;

async function openSqlite(writable = false) {
  if (sqlite === null) return null;
  if (sqlite?.memory && !writable) return sqlite.memory;
  try {
    const initSqlJs = (await import("sql.js")).default;
    const engine = (await initSqlJs({
      locateFile: (file: string) => join(process.cwd(), "node_modules", "sql.js", "dist", file),
    })) as unknown as SqliteEngine;
    const dbFile = readFirst("assistant.db");
    const database = dbFile ? new engine.Database(dbFile.bytes) : new engine.Database();
    database.run(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        section TEXT NOT NULL,
        text TEXT NOT NULL,
        embedding TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitor_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS visitors (
        id TEXT PRIMARY KEY,
        lead_name TEXT,
        lead_email TEXT,
        handoff_sent INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
    `);
    sqlite = { engine, memory: writable ? database : sqlite?.memory ?? null };
    if (writable) sqlite.memory = database;
    return database;
  } catch {
    sqlite = null;
    return null;
  }
}

async function loadChunksFromSqlite(): Promise<ChunkRow[]> {
  const database = await openSqlite();
  if (!database) return [];
  const result = database.exec("SELECT id, source, section, text, embedding FROM chunks");
  if (!result[0]) return [];
  return result[0].values.map((row) => ({
    id: String(row[0]),
    source: String(row[1]),
    section: String(row[2]),
    text: String(row[3]),
    embedding: JSON.parse(String(row[4])) as number[],
  }));
}

export async function loadHistory(visitorId: string): Promise<ChatTurn[]> {
  const database = await openSqlite();
  if (!database) return [];
  const stmt = database.prepare(
    "SELECT role, content FROM messages WHERE visitor_id = $id ORDER BY id ASC LIMIT 40",
  );
  stmt.bind({ $id: visitorId });
  const turns: ChatTurn[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as { role: string; content: string };
    turns.push({ role: row.role as ChatTurn["role"], content: row.content });
  }
  stmt.free();
  return turns;
}

export async function loadVisitor(visitorId: string) {
  const database = await openSqlite();
  if (!database) return { leadName: null as string | null, leadEmail: null as string | null, handoffSent: false };
  const stmt = database.prepare("SELECT lead_name, lead_email, handoff_sent FROM visitors WHERE id = $id");
  stmt.bind({ $id: visitorId });
  const row = stmt.step()
    ? (stmt.getAsObject() as { lead_name: string | null; lead_email: string | null; handoff_sent: number })
    : null;
  stmt.free();
  return row
    ? { leadName: row.lead_name, leadEmail: row.lead_email, handoffSent: Boolean(row.handoff_sent) }
    : { leadName: null, leadEmail: null, handoffSent: false };
}

function persistDb(database: { export(): Uint8Array }) {
  const found = readFirst("assistant.db");
  const path = found?.path ?? join(process.cwd(), "data", "assistant.db");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(database.export()));
}

export async function persistTurn(visitorId: string, turn: ChatTurn) {
  try {
    const database = await openSqlite(true);
    if (!database) return;
    database.run("INSERT INTO messages (visitor_id, role, content, created_at) VALUES (?, ?, ?, ?)", [
      visitorId,
      turn.role,
      turn.content,
      new Date().toISOString(),
    ]);
    persistDb(database);
  } catch {
    // Vercel filesystem is not durable; client localStorage is the fallback.
  }
}

export async function persistVisitor(
  visitorId: string,
  fields: { leadName?: string | null; leadEmail?: string | null; handoffSent?: boolean },
) {
  try {
    const database = await openSqlite(true);
    if (!database) return;
    const current = await loadVisitor(visitorId);
    const leadName = fields.leadName ?? current.leadName;
    const leadEmail = fields.leadEmail ?? current.leadEmail;
    const handoffSent = fields.handoffSent ?? current.handoffSent;
    database.run(
      `INSERT INTO visitors (id, lead_name, lead_email, handoff_sent, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         lead_name = excluded.lead_name,
         lead_email = excluded.lead_email,
         handoff_sent = excluded.handoff_sent,
         updated_at = excluded.updated_at`,
      [visitorId, leadName, leadEmail, handoffSent ? 1 : 0, new Date().toISOString()],
    );
    persistDb(database);
  } catch {
    // ignore ephemeral write failures
  }
}

export function cosine(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
