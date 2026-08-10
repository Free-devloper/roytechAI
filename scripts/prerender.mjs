import { writeFile, copyFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

async function generateDynamicSitemap() {
  const domain = "https://www.roytechworkforce.com";
  const today = new Date().toISOString().split("T")[0];

  const staticRoutes = [
    { url: "/", lastmod: today, changefreq: "weekly", priority: "1.0" },
    { url: "/blog", lastmod: today, changefreq: "daily", priority: "0.9" },
    { url: "/#why", lastmod: today, changefreq: "monthly", priority: "0.8" },
    { url: "/#services", lastmod: today, changefreq: "weekly", priority: "0.9" },
    { url: "/#method", lastmod: today, changefreq: "monthly", priority: "0.8" },
    { url: "/#estimator", lastmod: today, changefreq: "weekly", priority: "0.95" },
    { url: "/#solutions", lastmod: today, changefreq: "monthly", priority: "0.8" },
    { url: "/#contact", lastmod: today, changefreq: "monthly", priority: "0.9" },
  ];

  let blogPosts = [];
  try {
    const rawData = await readFile("app/blog/data/posts.json", "utf8");
    blogPosts = JSON.parse(rawData);
  } catch (err) {
    console.warn("Could not read app/blog/data/posts.json:", err);
  }

  const blogRoutes = blogPosts.map((post) => ({
    url: `/blog/${post.slug || post.id}`,
    lastmod: post.date || today,
    changefreq: "monthly",
    priority: "0.85",
  }));

  const allRoutes = [...staticRoutes, ...blogRoutes];

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes
  .map(
    (r) => `  <url>
    <loc>${domain}${r.url}</loc>
    <lastmod>${r.lastmod}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

  await writeFile("public/sitemap.xml", xmlContent, "utf8");
  await writeFile("dist/client/sitemap.xml", xmlContent, "utf8");
  console.log(`Automatically generated sitemap.xml with ${allRoutes.length} routes (${blogRoutes.length} blog articles).`);
}

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

  // Prerender /blog page
  try {
    const blogRes = await worker.fetch(
      new Request("http://localhost/blog", {
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

    if (blogRes.status === 200) {
      const blogHtml = await blogRes.text();
      const { mkdir } = await import("node:fs/promises");
      await mkdir("dist/client/blog", { recursive: true });
      await writeFile("dist/client/blog/index.html", blogHtml, "utf8");
      await writeFile("dist/client/blog.html", blogHtml, "utf8");
      console.log(`Prerendered blog/index.html successfully (${blogHtml.length} bytes).`);
    } else {
      console.warn(`Failed to prerender /blog route: HTTP ${blogRes.status}`);
    }
  } catch (err) {
    console.warn("Could not prerender /blog route:", err);
  }

  // Generate dynamic sitemap.xml and copy robots.txt
  try {
    await copyFile("public/robots.txt", "dist/client/robots.txt");
    await generateDynamicSitemap();
  } catch (err) {
    console.warn("Could not copy robots.txt / generate sitemap:", err);
  }
}

main().catch((err) => {
  console.error("Prerender error:", err);
  process.exit(1);
});
