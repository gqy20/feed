import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".ico": "image/x-icon" };
http.createServer(async (req, res) => {
  try {
    if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405); return res.end(); }
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.resolve(root, `.${pathname.endsWith("/") ? pathname + "index.html" : pathname}`);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    const info = await stat(file);
    if (!info.isFile()) throw new Error("Not a file");
    const etag = `W/"${info.size}-${info.mtimeMs}"`;
    // Revalidate edited code and data; reuse large font files between pages.
    res.setHeader("Cache-Control", file.endsWith(".woff2") ? "public, max-age=86400" : "no-cache");
    res.setHeader("ETag", etag);
    res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
    if (req.headers["if-none-match"] === etag) { res.writeHead(304); return res.end(); }
    res.setHeader("Content-Length", info.size);
    res.writeHead(200);
    res.end(req.method === "HEAD" ? undefined : await readFile(file));
  } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
}).listen(port, "127.0.0.1", () => console.log(`Trail Feed: http://127.0.0.1:${port}`));
