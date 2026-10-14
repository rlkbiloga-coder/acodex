import { describe, expect, it, vi } from "vitest";
import {
	createMcpClient,
	parseSseBody,
	toOpenAiParameters,
} from "../../src/lib/acodexAi/mcp";

/** Resposta fetch falsa, mínima. */
function res({ status = 200, headers = {}, body = "" } = {}) {
	return {
		status,
		ok: status < 400,
		headers: {
			get: (name) => headers[name?.toLowerCase()] ?? null,
		},
		text: async () => body,
	};
}

const sse = (events) => events.map((e) => `event: message\ndata: ${JSON.stringify(e)}\n\n`).join("");

describe("parseSseBody", () => {
	it("extrai a mensagem pelo id", () => {
		const body = sse([{ jsonrpc: "2.0", result: { a: 1 }, id: 7 }, { jsonrpc: "2.0", result: { b: 2 }, id: 8 }]);
		expect(parseSseBody(body, 8)).toEqual({ jsonrpc: "2.0", result: { b: 2 }, id: 8 });
	});

	it("ignora blocos que não são JSON", () => {
		expect(parseSseBody("data: ping\n\n", 1)).toBeNull();
	});
});

describe("toOpenAiParameters", () => {
	it("mantém object schemas e normaliza o resto", () => {
		expect(toOpenAiParameters({ type: "object", properties: { q: { type: "string" } } })).toMatchObject({ type: "object" });
		expect(toOpenAiParameters(undefined)).toEqual({ type: "object", properties: {} });
		expect(toOpenAiParameters({ type: "string" })).toEqual({ type: "object", properties: {} });
	});
});

describe("createMcpClient", () => {
	it("faz handshake, guarda a sessão e lista tools", async () => {
		const calls = [];
		const fetchImpl = vi.fn(async (url, init) => {
			calls.push({ url, init, body: JSON.parse(init.body) });
			if (calls.length === 1) {
				return res({ headers: { "mcp-session-id": "abc123", "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } }) });
			}
			if (calls.length === 2) return res({ headers: { "content-type": "application/json" }, body: "" });
			return res({
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "search", description: "Busca", inputSchema: { type: "object", properties: { q: { type: "string" } } } }] } }),
			});
		});
		const client = createMcpClient({ url: "https://srv/mcp", fetchImpl });
		await client.initialize();
		expect(client.getSessionId()).toBe("abc123");
		const tools = await client.listTools();
		expect(tools).toEqual([{ name: "search", description: "Busca", parameters: { type: "object", properties: { q: { type: "string" } } } }]);
		// sessão é reenviada nas chamadas seguintes
		expect(calls[2].init.headers["Mcp-Session-Id"]).toBe("abc123");
		// notificação initialized não tem id
		expect(calls[1].body.id).toBeUndefined();
	});

	it("converte resposta SSE em chamada de tool", async () => {
		let n = 0;
		const fetchImpl = vi.fn(async () => {
			n++;
			if (n === 1) return res({ headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } }) });
			if (n === 2) return res({ headers: { "content-type": "application/json" }, body: "" });
			return res({ headers: { "content-type": "text/event-stream" }, body: sse([{ jsonrpc: "2.0", result: { content: [{ type: "text", text: "42" }] }, id: 2 }]) });
		});
		const client = createMcpClient({ url: "https://srv/mcp", fetchImpl });
		await client.initialize();
		const out = await client.callTool("calc", { expr: "6*7" });
		expect(out).toEqual({ content: "42" });
	});

	it("retorna erro quando a tool sinaliza isError", async () => {
		let n = 0;
		const fetchImpl = vi.fn(async () => {
			n++;
			if (n === 1) return res({ headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } }) });
			if (n === 2) return res({ headers: { "content-type": "application/json" }, body: "" });
			return res({ headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, result: { isError: true, content: [{ type: "text", text: "falhou" }] } }) });
		});
		const client = createMcpClient({ url: "https://srv/mcp", fetchImpl });
		await client.initialize();
		expect(await client.callTool("bad", {})).toEqual({ error: "falhou" });
	});

	it("recusa servidor que não negocia protocolo", async () => {
		const fetchImpl = vi.fn(async () => res({ headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }) }));
		const client = createMcpClient({ url: "https://srv/mcp", fetchImpl });
		await expect(client.initialize()).rejects.toThrow("MCP");
	});

	it("recusa listTools antes do initialize e propaga erro JSON-RPC", async () => {
		const client = createMcpClient({ url: "https://srv/mcp" });
		await expect(client.listTools()).rejects.toThrow("inicializado");
		const fetchImpl = vi.fn(async () => res({ status: 500 }));
		const c2 = createMcpClient({ url: "https://srv/mcp", fetchImpl });
		await expect(c2.initialize()).rejects.toThrow("HTTP 500");
	});
});
