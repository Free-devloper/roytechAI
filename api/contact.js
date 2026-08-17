// Placeholder so Vercel matches functions.api/contact.js before npm run build.
// scripts/bundle-vercel-api.mjs overwrites this file with the real bundle.
export default function handler(_req, res) {
  res.statusCode = 503;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ error: "Contact API is not bundled yet." }));
}
