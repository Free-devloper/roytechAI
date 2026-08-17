import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import initSqlJs from "sql.js";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  for (const name of [".env", ".dev.vars"]) {
    try {
      const text = readFileSync(join(root, name), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq < 1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    } catch {
      // optional
    }
  }
}

function chunkMarkdown(source, markdown) {
  const blocks = [];
  const parts = markdown.split(/\n(?=#{1,3} )/g);
  for (const part of parts) {
    const lines = part.trim().split("\n");
    const heading = lines[0]?.replace(/^#+\s*/, "") || source;
    const body = part.trim();
    const windowSize = 900;
    if (body.length <= windowSize) {
      blocks.push({ source, section: heading, text: body });
      continue;
    }
    let start = 0;
    let index = 0;
    while (start < body.length) {
      const slice = body.slice(start, start + windowSize);
      blocks.push({ source, section: `${heading} (${index + 1})`, text: slice.trim() });
      start += windowSize - 120;
      index += 1;
    }
  }
  return blocks.filter((block) => block.text.length > 40);
}

async function embedBatch(inputs, models, apiKey) {
  let lastError = "No embedding model succeeded.";
  for (const model of models) {
    const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://www.roytechworkforce.com",
        "X-Title": "RoytechAI Assistant ingest",
      },
      body: JSON.stringify({ model, input: inputs }),
    });
    if (response.ok) {
      const json = await response.json();
      return json.data.sort((a, b) => a.index - b.index).map((row) => row.embedding);
    }
    lastError = `Embedding failed (${response.status}): ${await response.text()}`;
  }
  throw new Error(lastError);
}

async function main() {
  loadEnv();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is required to ingest embeddings.");
  }
  const models = Array.from(
    new Set([
      process.env.OPENROUTER_EMBEDDING_MODEL || "qwen/qwen3-embedding-8b",
      "qwen/qwen3-embedding-8b",
      "qwen/qwen3-embedding-4b",
      "openai/text-embedding-3-small",
    ]),
  );
  const knowledgeDir = join(root, "knowledge");
  const files = readdirSync(knowledgeDir).filter((name) => name.endsWith(".md")).sort();
  const chunks = files.flatMap((file) => chunkMarkdown(file, readFileSync(join(knowledgeDir, file), "utf8")));

  const SQL = await initSqlJs({
    locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm"),
  });
  const database = new SQL.Database();
  database.run(`
    CREATE TABLE chunks (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      section TEXT NOT NULL,
      text TEXT NOT NULL,
      embedding TEXT NOT NULL
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitor_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE visitors (
      id TEXT PRIMARY KEY,
      lead_name TEXT,
      lead_email TEXT,
      handoff_sent INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);

  const stored = [];
  const batchSize = 16;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const embeddings = await embedBatch(batch.map((item) => item.text), models, apiKey);
    const insert = database.prepare("INSERT INTO chunks (id, source, section, text, embedding) VALUES (?, ?, ?, ?, ?)");
    batch.forEach((item, offset) => {
      const id = `${item.source}:${i + offset}`;
      const embedding = embeddings[offset];
      insert.run([id, item.source, item.section, item.text, JSON.stringify(embedding)]);
      stored.push({ id, source: item.source, section: item.section, text: item.text, embedding });
    });
    insert.free();
    console.log(`Embedded ${Math.min(i + batchSize, chunks.length)} / ${chunks.length}`);
  }

  const outDir = join(root, "data");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "assistant.db");
  writeFileSync(outPath, Buffer.from(database.export()));
  writeFileSync(join(outDir, "chunks.json"), JSON.stringify(stored));
  console.log(`Wrote ${stored.length} chunks to ${outPath} and data/chunks.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
