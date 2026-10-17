#!/usr/bin/env node

/**
 * AcodeX Web Preview — servidor de pré-visualização no navegador.
 *
 * Caminho web já usado no deploy da Vercel: `utils/config.js` gera o
 * build.json, `utils/scripts/web-cordova-shim.js` gera o `cordova.js` stub
 * (navegador, sem plugins nativos), `rspack` compila `src/` para `www/build/`
 * e este script serve a pasta `www/` em 0.0.0.0:PORT.
 *
 * Diferença para o `npm run dev` (utils/scripts/dev.js): aqui não há
 * `cordova run android` — o alvo é um navegador. Usado pelo ambiente Base44
 * (docker-compose.base44.yml).
 */

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const WWW = path.join(ROOT, "www");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".mjs": "application/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".map": "application/json",
};

// Cliente de live reload injetado só na resposta HTTP do index.html — o
// arquivo em www/ permanece intocado.
const RELOAD_CLIENT = `<script>
(function () {
	"use strict";
	try {
		var es = new EventSource("/__reload");
		es.onmessage = function (e) {
			if (e.data === "reload") location.reload();
		};
	} catch (_e) {}
})();
</script>
`;

function log(msg) {
	console.log(`  [preview] ${msg}`);
}

/** Injeta o cliente de reload no HTML servido. */
function withReloadClient(html) {
	if (html.includes("/__reload")) return html;
	return html.includes("</body>")
		? html.replace("</body>", `${RELOAD_CLIENT}</body>`)
		: html + RELOAD_CLIENT;
}

const clients = new Set();

function broadcastReload() {
	for (const res of clients) {
		try {
			res.write("data: reload\n\n");
		} catch (_e) {
			clients.delete(res);
		}
	}
	log("reload enviado para os clientes conectados");
}

function handleRequest(req, res) {
	const urlPath = (req.url || "/").split("?")[0];

	if (urlPath === "/__reload") {
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		});
		res.write(": connected\n\n");
		clients.add(res);
		req.on("close", () => clients.delete(res));
		return;
	}

	const relative = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
	const filePath = path.join(WWW, path.normalize(relative));
	if (filePath !== WWW && !filePath.startsWith(WWW + path.sep)) {
		res.writeHead(403);
		res.end("Forbidden");
		return;
	}

	fs.readFile(filePath, (err, data) => {
		if (err) {
			res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
			res.end("Not found");
			return;
		}

		const ext = path.extname(filePath).toLowerCase();
		const isHtml = ext === ".html";
		const body = isHtml ? withReloadClient(data.toString("utf8")) : data;
		res.writeHead(200, {
			"Content-Type": MIME[ext] || "application/octet-stream",
			"Cache-Control": "no-cache, no-store, must-revalidate",
		});
		res.end(body);
	});
}

function runNodeScript(script, args = []) {
	return new Promise((resolve, reject) => {
		const proc = spawn(process.execPath, [path.join(ROOT, script), ...args], {
			cwd: ROOT,
			stdio: "inherit",
		});
		proc.on("close", (code) =>
			code === 0
				? resolve()
				: reject(new Error(`${script} exited with code ${code}`)),
		);
		proc.on("error", reject);
	});
}

function startRspackWatch() {
	const bin = path.join(ROOT, "node_modules", "@rspack", "cli", "bin", "rspack.js");
	log("iniciando rspack --watch...");
	const proc = spawn(process.execPath, [bin, "--watch", "--mode", "development"], {
		cwd: ROOT,
		stdio: ["ignore", "pipe", "pipe"],
	});
	const onOutput = (chunk) => {
		const text = chunk.toString();
		process.stdout.write(text);
		if (/compiled successfully|compiled with \d+ warning/.test(text)) {
			broadcastReload();
		}
	};
	proc.stdout.on("data", onOutput);
	proc.stderr.on("data", (chunk) => process.stderr.write(chunk));
	proc.on("close", (code) => {
		if (code) {
			log(`rspack saiu com código ${code}`);
			process.exit(code);
		}
	});
	return proc;
}

async function main() {
	log("preparando build web (config + cordova stub)...");
	const variant = process.env.APP_VARIANT === "free" ? "free" : "paid";
	await runNodeScript("utils/config.js", ["d", variant]);
	await runNodeScript("utils/scripts/web-cordova-shim.js");

	startRspackWatch();

	const server = http.createServer(handleRequest);
	server.listen(PORT, HOST, () => {
		log(`servindo ${WWW} em http://${HOST}:${PORT}`);
	});
}

main().catch((err) => {
	console.error(`  [preview] ${err.message}`);
	process.exit(1);
});
