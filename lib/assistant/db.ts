import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import type { ChatTurn } from "./types";

const require = createRequire(import.meta.url);

function wasmPath() {
  return require.resolve("sql.js/dist/sql-wasm.wasm");
}

function dbPath() {
  try {
    return join(process.cwd(), "data", "assistant.db");
  } catch {
    return join(dirname(fileURLToPath(import.meta.url)), "../../data/assistant.db");
  }
}

let SQL: SqlJsStatic | null = null;
let memory: Database | null = null;

async function sqlEngine() {
  if (!SQL) {
    SQL = await initSqlJs({ locateFile: () => wasmPath() });
  }
  return SQL;
}

export function ensureSchema(database: Database) {
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
}

export async function openAssistantDb(writable = false) {
  const engine = await sqlEngine();
  const path = dbPath();
  let database: Database;
  try {
    const file = readFileSync(path);
    database = new engine.Database(file);
  } catch {
    database = new engine.Database();
  }
  ensureSchema(database);
  if (writable) memory = database;
  return database;
}

export function persistDb(database: Database) {
  const path = dbPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(database.export()));
}

export type ChunkRow = {
  id: string;
  source: string;
  section: string;
  text: string;
  embedding: number[];
};

export async function loadChunks(): Promise<ChunkRow[]> {
  const database = memory ?? (await openAssistantDb());
  const result = database.exec("SELECT id, source, section, text, embedding FROM chunks");
  if (!result[0]) return [];
  return result[0].values.map((row: Array<string | number | null | Uint8Array>) => ({
    id: String(row[0]),
    source: String(row[1]),
    section: String(row[2]),
    text: String(row[3]),
    embedding: JSON.parse(String(row[4])) as number[],
  }));
}

export async function loadHistory(visitorId: string): Promise<ChatTurn[]> {
  const database = memory ?? (await openAssistantDb());
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
  const database = memory ?? (await openAssistantDb());
  const stmt = database.prepare("SELECT lead_name, lead_email, handoff_sent FROM visitors WHERE id = $id");
  stmt.bind({ $id: visitorId });
  const row = stmt.step() ? (stmt.getAsObject() as { lead_name: string | null; lead_email: string | null; handoff_sent: number }) : null;
  stmt.free();
  return row
    ? { leadName: row.lead_name, leadEmail: row.lead_email, handoffSent: Boolean(row.handoff_sent) }
    : { leadName: null, leadEmail: null, handoffSent: false };
}

export async function persistTurn(visitorId: string, turn: ChatTurn) {
  try {
    const database = memory ?? (await openAssistantDb(true));
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
    const database = memory ?? (await openAssistantDb(true));
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
