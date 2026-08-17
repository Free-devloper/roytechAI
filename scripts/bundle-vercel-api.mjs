import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "api"), { recursive: true });

const banner = `
import { createRequire as __createRequire } from "node:module";
import { fileURLToPath as __fileURLToPath } from "node:url";
import { dirname as __dirnameFactory } from "node:path";
const require = __createRequire(import.meta.url);
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __dirnameFactory(__filename);
`.trim();

await esbuild.build({
  absWorkingDir: root,
  entryPoints: {
    assistant: join(root, "server", "vercel-assistant.ts"),
    contact: join(root, "server", "vercel-contact.ts"),
    voice: join(root, "server", "vercel-voice.ts"),
  },
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  outdir: join(root, "api"),
  legalComments: "none",
  sourcemap: false,
  packages: "bundle",
  external: ["sql.js"],
  banner: { js: banner },
  logLevel: "info",
});

console.log("Bundled Vercel API functions into api/");
