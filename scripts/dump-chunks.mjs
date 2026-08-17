import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import initSqlJs from "sql.js";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const SQL = await initSqlJs({
    locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm"),
  });
  const database = new SQL.Database(readFileSync(join(root, "data", "assistant.db")));
  const result = database.exec("SELECT id, source, section, text, embedding FROM chunks");
  if (!result[0]) throw new Error("No chunks in assistant.db");
  const chunks = result[0].values.map((row) => ({
    id: String(row[0]),
    source: String(row[1]),
    section: String(row[2]),
    text: String(row[3]),
    embedding: JSON.parse(String(row[4])),
  }));
  const outPath = join(root, "data", "chunks.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(chunks));
  console.log(`Wrote ${chunks.length} chunks to ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
