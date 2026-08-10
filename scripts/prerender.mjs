import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function main() {
  const workerPath = path.resolve("dist/server/index.js");
  const workerUrl = pathToFileURL(workerPath);
  workerUrl.searchParams.set("prerender", `${Date.now()}`);

  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    }
  );

  if (response.status === 200) {
    const html = await response.text();
    await writeFile("dist/client/index.html", html, "utf8");
    console.log(`Prerendered index.html successfully (${html.length} bytes).`);
  } else {
    console.error(`Failed to prerender index.html: HTTP ${response.status}`);
  }
}

main().catch((err) => {
  console.error("Prerender error:", err);
  process.exit(1);
});
