// .base44/serve.js — servidor estático do bundle web (www/) para o preview Base44.
// Serve www/ na porta 3000 (0.0.0.0), sem cache, para o iframe do preview.
// Não afeta builds Android/Vercel; usado apenas pelo docker-compose.base44.yml.

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const WWW = path.join(ROOT, "www");
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
  ".map": "application/json",
};

const server = http.createServer((req, res) => {
  let urlPath = (req.url || "/").split("?")[0];
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.normalize(path.join(WWW, urlPath));
  if (!filePath.startsWith(WWW + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`base44: serving ${WWW} on http://0.0.0.0:${PORT}`);
});
