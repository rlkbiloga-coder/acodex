import express from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { WebSocketServer } from "ws";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import os from "node:os";
import net from "node:net";
import crypto from "node:crypto";
import http from "node:http";

/**
 * AcodeX Live Browser — backend open source (self-hosted).
 *
 * Melhorias sobre o starter:
 *  - autenticação por token (ACX_BROWSER_TOKEN) em REST e WebSocket
 *  - limite de sessões simultâneas e de criação por IP
 *  - terminal restrito desligado por padrão (ACX_ENABLE_TERMINAL=true liga)
 *  - /api/config informa capacidades ao app
 *  - guards SSRF mantidos e reforçados (metadata cloud, IPv6, .internal)
 *  - CORS configurável via ALLOWED_ORIGIN
 */

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

/**
 * Origem padrão autorizada no CORS: o WebView do app Cordova serve em
 * https://localhost. Nunca usamos "*" — defina ALLOWED_ORIGIN para liberar
 * outra origem (ex.: um front web próprio com HTTPS).
 */
const DEFAULT_CORS_ORIGIN = "https://localhost";
const CORS_ORIGIN = process.env.ALLOWED_ORIGIN || DEFAULT_CORS_ORIGIN;

const PORT = Number(process.env.PORT || 3000);
const TOKEN = (process.env.ACX_BROWSER_TOKEN || "").trim();
const AUTH_REQUIRED = TOKEN.length > 0;
const MAX_SESSIONS = Number(process.env.MAX_SESSIONS || 4);
const SESSIONS_PER_HOUR_PER_IP = Number(process.env.SESSIONS_PER_HOUR || 12);
const TERMINAL_ENABLED = process.env.ACX_ENABLE_TERMINAL === "true";
const TTL_MS = Number(process.env.SESSION_TTL_MINUTES || 30) * 60_000;

const sessions = new Map();
const sessionCreations = new Map(); // ip -> timestamps

const terminalLimiter = rateLimit({
	windowMs: 60_000,
	limit: 20,
	standardHeaders: true,
	legacyHeaders: false,
	message: { error: "Muitas execuções; aguarde um minuto.", code: "RATE_LIMITED" },
});

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: "32kb" }));

function sendEvent(event) {
	const payload = JSON.stringify({ ...event, timestamp: Date.now() });
	for (const client of wss.clients) {
		if (client.readyState === 1) client.send(payload);
	}
}

wss.on("connection", (ws, req) => {
	if (AUTH_REQUIRED) {
		const url = new URL(req.url, "http://localhost");
		if (url.searchParams.get("token") !== TOKEN) {
			ws.close(4401, "unauthorized");
			return;
		}
	}
	ws.send(JSON.stringify({ type: "connected" }));
});

/** Autenticação REST: header x-acx-token quando um token foi configurado. */
function authMiddleware(req, res, next) {
	if (!AUTH_REQUIRED) return next();
	if (req.get("x-acx-token") === TOKEN) return next();
	res.status(401).json({ error: "Token inválido ou ausente.", code: "UNAUTHORIZED" });
}

function isPrivateIPv4(ip) {
	const p = ip.split(".").map(Number);
	return (
		p.length === 4 &&
		(p[0] === 10 ||
			p[0] === 127 ||
			p[0] === 0 ||
			(p[0] === 169 && p[1] === 254) ||
			(p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
			(p[0] === 192 && p[1] === 168) ||
			(p[0] === 100 && p[1] >= 64 && p[1] <= 127))
	);
}

export function validatePublicUrl(raw) {
	let u;
	try {
		u = new URL(raw);
	} catch {
		throw new Error("URL inválida.");
	}
	if (!["http:", "https:"].includes(u.protocol)) {
		throw new Error("Somente URLs HTTP/HTTPS são permitidas.");
	}
	const host = u.hostname.toLowerCase();
	const blockedHosts = [
		"localhost",
		"metadata.google.internal",
		"metadata.goog",
		"169.254.169.254",
	];
	if (
		blockedHosts.includes(host) ||
		host.endsWith(".localhost") ||
		host.endsWith(".local") ||
		host.endsWith(".internal")
	) {
		throw new Error("Destino local/interno bloqueado.");
	}
	if (net.isIP(host) === 4 && isPrivateIPv4(host)) {
		throw new Error("IP privado bloqueado.");
	}
	if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) {
		throw new Error("IP IPv6 local/privado bloqueado.");
	}
	return u.toString();
}

function getSession(id) {
	const s = sessions.get(id);
	if (!s) {
		const e = new Error("Sessão não encontrada ou expirada.");
		e.status = 404;
		throw e;
	}
	s.lastUsed = Date.now();
	return s;
}

function approvalGate(body) {
	if (body?.requiresApproval === true && body?.approved !== true) {
		const e = new Error("Esta ação exige aprovação explícita do usuário.");
		e.status = 409;
		e.code = "APPROVAL_REQUIRED";
		throw e;
	}
}

function tooManySessions(ip) {
	const now = Date.now();
	const recent = (sessionCreations.get(ip) || []).filter(
		(t) => now - t < 3_600_000,
	);
	recent.push(now);
	sessionCreations.set(ip, recent);
	return recent.length > SESSIONS_PER_HOUR_PER_IP;
}

async function stateOf(s) {
	return {
		url: s.page.url(),
		title: await s.page.title().catch(() => ""),
		loading: false,
		viewport: await s.page
			.evaluate(() => ({ width: innerWidth, height: innerHeight }))
			.catch(() => null),
	};
}

app.get("/health", (_req, res) =>
	res.json({ ok: true, service: "acodex-live-browser" }),
);

app.get("/api/config", (_req, res) =>
	res.json({
		authRequired: AUTH_REQUIRED,
		terminalEnabled: TERMINAL_ENABLED,
		maxSessions: MAX_SESSIONS,
		ttlMinutes: TTL_MS / 60_000,
	}),
);

app.use(authMiddleware);

app.post("/api/browser/sessions", async (req, res, next) => {
	try {
		if (sessions.size >= MAX_SESSIONS) {
			return res.status(429).json({
				error: `Limite de sessões simultâneas (${MAX_SESSIONS}) atingido.`,
				code: "TOO_MANY_SESSIONS",
			});
		}
		if (tooManySessions(req.ip || "unknown")) {
			return res.status(429).json({
				error: "Muitas sessões criadas recentemente. Tente mais tarde.",
				code: "RATE_LIMITED",
			});
		}
		const browser = await chromium.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-dev-shm-usage"],
		});
		const context = await browser.newContext({
			viewport: { width: 412, height: 915 },
			deviceScaleFactor: 1,
			isMobile: true,
			hasTouch: true,
		});
		const page = await context.newPage();
		const id = crypto.randomUUID();
		const session = {
			id,
			browser,
			context,
			page,
			createdAt: Date.now(),
			lastUsed: Date.now(),
		};
		page.on("domcontentloaded", () =>
			sendEvent({
				type: "browser_event",
				sessionId: id,
				event: "domcontentloaded",
				url: page.url(),
			}),
		);
		page.on("pageerror", (err) =>
			sendEvent({
				type: "browser_event",
				sessionId: id,
				event: "pageerror",
				message: String(err).slice(0, 300),
			}),
		);
		sessions.set(id, session);
		sendEvent({ type: "session_created", sessionId: id });
		res.json({ id, state: await stateOf(session) });
	} catch (e) {
		next(e);
	}
});

app.post("/api/browser/:id/navigate", async (req, res, next) => {
	try {
		const s = getSession(req.params.id);
		const url = validatePublicUrl(req.body?.url);
		await s.page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
		sendEvent({ type: "navigation", sessionId: s.id, url: s.page.url() });
		res.json({ ok: true, state: await stateOf(s) });
	} catch (e) {
		next(e);
	}
});

app.get("/api/browser/:id/state", async (req, res, next) => {
	try {
		const s = getSession(req.params.id);
		const state = await stateOf(s);
		const pageText = await s.page
			.locator("body")
			.innerText({ timeout: 4000 })
			.catch(() => "");
		res.json({ ...state, pageText: pageText.slice(0, 12_000) });
	} catch (e) {
		next(e);
	}
});

app.get("/api/browser/:id/screenshot", async (req, res, next) => {
	try {
		const s = getSession(req.params.id);
		const png = await s.page.screenshot({
			type: "png",
			fullPage: false,
			timeout: 10_000,
		});
		res.setHeader("Content-Type", "image/png");
		res.setHeader("Cache-Control", "no-store");
		res.send(png);
	} catch (e) {
		next(e);
	}
});

app.post("/api/browser/:id/click", async (req, res, next) => {
	try {
		approvalGate(req.body);
		const s = getSession(req.params.id);
		const selector = String(req.body?.selector || "").slice(0, 500);
		if (!selector) return res.status(400).json({ error: "selector obrigatório" });
		await s.page.locator(selector).first().click({ timeout: 8000 });
		res.json({ ok: true, state: await stateOf(s) });
	} catch (e) {
		next(e);
	}
});

app.post("/api/browser/:id/fill", async (req, res, next) => {
	try {
		approvalGate(req.body);
		const s = getSession(req.params.id);
		const selector = String(req.body?.selector || "").slice(0, 500);
		const value = String(req.body?.value ?? "").slice(0, 4000);
		if (!selector) return res.status(400).json({ error: "selector obrigatório" });
		await s.page.locator(selector).first().fill(value, { timeout: 8000 });
		res.json({ ok: true, state: await stateOf(s) });
	} catch (e) {
		next(e);
	}
});

app.post("/api/browser/:id/close", async (req, res, next) => {
	try {
		const s = getSession(req.params.id);
		await s.browser.close();
		sessions.delete(s.id);
		sendEvent({ type: "session_closed", sessionId: s.id });
		res.json({ ok: true });
	} catch (e) {
		next(e);
	}
});

// Terminal deliberadamente restrito: allowlist minúscula, sem shell, off por padrão.
const ALLOWED_COMMANDS = {
	"node --version": ["node", ["--version"]],
	"python --version": ["python", ["--version"]],
	pwd: ["pwd", []],
	whoami: ["whoami", []],
};

if (TERMINAL_ENABLED) {
	app.get("/api/terminal/commands", (_req, res) =>
		res.json({ commands: Object.keys(ALLOWED_COMMANDS) }),
	);

	app.post("/api/terminal/run", terminalLimiter, (req, res) => {
		const command = String(req.body?.command || "");
		const entry = ALLOWED_COMMANDS[command];
		if (!entry) {
			return res.status(403).json({
				error: "Comando não permitido.",
				allowed: Object.keys(ALLOWED_COMMANDS),
			});
		}
		const [bin, args] = entry;
		const child = spawn(bin, args, {
			shell: false,
			timeout: 5000,
			cwd: os.tmpdir(),
			env: { PATH: process.env.PATH || "" },
		});
		let output = "";
		child.stdout.on("data", (d) => (output += d.toString().slice(0, 4000)));
		child.stderr.on("data", (d) => (output += d.toString().slice(0, 4000)));
		child.on("close", (code) =>
			res.json({ command, code, output: output.slice(0, 8000) }),
		);
		child.on("error", (err) => res.status(500).json({ error: err.message }));
	});
}

app.use((err, _req, res, _next) => {
	const status = err.status || 500;
	res.status(status).json({
		error: err.message || "Erro interno",
		code: err.code || "ERROR",
	});
});

if (process.env.NODE_ENV !== "test") {
	server.listen(PORT, () => {
		console.log(`[Acodex Live Browser] Ouvindo na porta ${PORT}`);
		console.log(` - Token auth: ${AUTH_REQUIRED ? "ATIVO" : "desativado"}`);
		console.log(` - Terminal: ${TERMINAL_ENABLED ? "HABILITADO" : "desabilitado (padrão)"}`);
	});
}

export { app, server };
