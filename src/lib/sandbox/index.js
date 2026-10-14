/**
 * Acodex Sandbox engine — runs JavaScript (Web Worker), Python (Pyodide)
 * and a minimal shell emulator. Pure helpers are exported for unit tests.
 *
 * Networking: sandboxed JS can call net.get(url). The host validates the
 * URL (public http/https only) and performs the request with the app's
 * native HTTP stack, so no external proxy server is required.
 */

import { nativeFetch } from "lib/acodexAi/nativeFetch";
import { runPythonCode } from "lib/pythonRunner";
import { createWorkerUrl, JS_WORKER_SOURCE } from "./workerSource";

/** Available sandbox modes. */
export const SANDBOX_MODES = ["js", "py", "sh"];

/** Timeout (ms) for a single sandbox net.get() request. */
export const NET_TIMEOUT_MS = 15000;

/** Maximum characters of a network response handed back to the sandbox. */
export const NET_MAX_CHARS = 262144;

/** Private/loopback IPv4 prefixes blocked from sandbox requests. */
const BLOCKED_IPV4_PREFIXES = ["0.", "10.", "127.", "169.254.", "192.168."];

function isPrivateIpv4(hostname) {
	if (!BLOCKED_IPV4_PREFIXES.some((prefix) => hostname.startsWith(prefix))) {
		return false;
	}
	return /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
}

function isPrivateIpv6(hostname) {
	const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
	return (
		host === "::1" ||
		host.startsWith("fc") ||
		host.startsWith("fd") ||
		host.startsWith("fe80")
	);
}

/**
 * Validates a URL for a sandbox network request.
 * Pure helper — exposed for unit tests.
 * @param {string} rawUrl
 * @returns {{ok: boolean, url?: string, error?: string}}
 */
export function validateNetUrl(rawUrl) {
	const value = String(rawUrl || "");
	if (!value) return { ok: false, error: "URL vazia" };
	if (value.length > 2048) return { ok: false, error: "URL muito longa" };
	let parsed;
	try {
		parsed = new URL(value);
	} catch (_) {
		return { ok: false, error: "URL invalida" };
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return { ok: false, error: "Somente http e https sao permitidos" };
	}
	const port = parsed.port;
	if (port && port !== "80" && port !== "443") {
		return { ok: false, error: `Porta ${port} nao permitida (use 80/443)` };
	}
	const host = parsed.hostname.toLowerCase();
	if (
		host === "localhost" ||
		host.endsWith(".local") ||
		host.endsWith(".internal") ||
		isPrivateIpv4(host) ||
		isPrivateIpv6(host)
	) {
		return { ok: false, error: "Endereco privado nao permitido" };
	}
	return { ok: true, url: parsed.toString() };
}

/** Prompt prefix per mode. */
export function modePrompt(mode) {
	switch (mode) {
		case "py":
			return "py>";
		case "sh":
			return "sh$";
		default:
			return "js>";
	}
}

/** Parses the first word of a command line. Exposed for tests. */
export function parseShellCommand(line) {
	const parts = String(line || "")
		.trim()
		.split(/\s+/);
	return { name: parts[0] || "", args: parts.slice(1) };
}

/**
 * Minimal shell emulator: a few no-side-effect commands that work without
 * a real filesystem. Real bash needs Termux-level native integration.
 * @param {string} line raw command line
 * @returns {{lines: Array<{type: string, text: string}>, clear?: boolean}}
 */
export function runShellCommand(line) {
	const { name, args } = parseShellCommand(line);
	const out = (text, type = "log") => ({ type, text });
	switch (name) {
		case "":
			return { lines: [] };
		case "help":
			return {
				lines: [
					out("Acodex sandbox shell (emulado)"),
					out("Comandos: help, clear, echo, date, whoami, ver"),
					out("Para bash real: integração Termux (roadmap)"),
					out("Modos: js> JavaScript • py> Python (Pyodide) • sh$ shell"),
					out('Rede (js>): net.get("https://api.exemplo.com/dados")'),
				],
			};
		case "clear":
			return { lines: [], clear: true };
		case "echo":
			return { lines: [out(args.join(" "))] };
		case "date":
			return { lines: [out(new Date().toString())] };
		case "whoami":
			return { lines: [out("acodex")] };
		case "ver":
			return { lines: [out("Acodex Sandbox 1.1 (net)")] };
		default:
			return {
				lines: [
					out(`sh: comando não suportado: ${name} (use "help")`, "error"),
				],
			};
	}
}

/** Performs a sandbox net request through nativeFetch with guards. */
async function performNetRequest(url, options = {}) {
	const check = validateNetUrl(url);
	if (!check.ok) {
		throw new Error(check.error);
	}
	const init = {
		method: (options.method || "GET").toUpperCase(),
		headers: options.headers || {},
	};
	if (options.body != null) {
		init.body = String(options.body);
	}
	const response = await nativeFetch(check.url, init);
	const text = await response.text();
	return {
		status: response.status,
		ok: response.ok,
		body: String(text).slice(0, NET_MAX_CHARS),
		truncated: text.length > NET_MAX_CHARS,
	};
}

/**
 * Runs JavaScript in a fresh Web Worker, capturing console output and errors.
 * Handles net.* requests from the worker (validated, then fetched by host).
 * @param {string} code
 * @param {{timeoutMs?: number, WorkerCtor?: any, makeUrl?: Function, netFetch?: Function}} [options]
 * @returns {Promise<Array<{type: string, text: string}>>}
 */
export function runJavaScript(code, options = {}) {
	const {
		timeoutMs = 5000,
		WorkerCtor = Worker,
		makeUrl = createWorkerUrl,
		netFetch = performNetRequest,
	} = options;
	return new Promise((resolve) => {
		const lines = [];
		let worker;
		try {
			worker = new WorkerCtor(makeUrl(JS_WORKER_SOURCE));
		} catch (error) {
			resolve([
				{ type: "error", text: `Falha ao iniciar sandbox: ${error.message}` },
			]);
			return;
		}
		const extendTimer = () => {
			clearTimeout(timer);
			timer = setTimeout(() => {
				lines.push({
					type: "error",
					text: `Timeout de ${NET_TIMEOUT_MS}ms excedido`,
				});
				finish();
			}, NET_TIMEOUT_MS);
		};
		const finish = () => {
			clearTimeout(timer);
			worker.terminate();
			resolve(lines);
		};
		let timer = setTimeout(() => {
			lines.push({ type: "error", text: `Timeout de ${timeoutMs}ms excedido` });
			finish();
		}, timeoutMs);
		worker.onmessage = (event) => {
			const { type, text } = event.data || {};
			if (type === "end") {
				finish();
				return;
			}
			if (type === "net") {
				const { id, url, options: netOptions } = event.data || {};
				extendTimer();
				Promise.resolve()
					.then(() => {
						const check = validateNetUrl(url);
						if (!check.ok) throw new Error(check.error);
						return netFetch(url, netOptions);
					})
					.then((response) => {
						worker.postMessage({ type: "net-result", id, ok: true, response });
					})
					.catch((error) => {
						const message = error?.message || String(error);
						worker.postMessage({
							type: "net-result",
							id,
							ok: false,
							error: message,
						});
					});
				return;
			}
			lines.push({ type, text });
		};
		worker.onerror = (event) => {
			lines.push({ type: "error", text: event.message || "Worker error" });
			finish();
		};
		worker.postMessage({ type: "run", code });
	});
}

/**
 * Runs Python via Pyodide, returning sandbox lines.
 * @param {string} code
 * @returns {Promise<Array<{type: string, text: string}>>}
 */
export async function runPython(code) {
	const lines = [];
	const { stdout, stderr, result } = await runPythonCode(code);
	for (const line of (stdout || "").split("\n")) {
		if (line) lines.push({ type: "log", text: line });
	}
	for (const line of (stderr || "").split("\n")) {
		if (line) lines.push({ type: "error", text: line });
	}
	if (result !== null && !stdout) lines.push({ type: "result", text: result });
	return lines;
}
