import { afterEach, describe, expect, it, vi } from "vitest";
import { createMcpClient, toOpenAiParameters } from "../../src/lib/acodexAi/mcp";

/** Resposta fetch falsa com corpo fixo (json + text + body stream). */
function res(status, headers, body) {
	const map = new Map(Object.entries(headers ?? {}));
	const stream = () =>
		new ReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode(body ?? ""));
				controller.close();
			},
		});
	return {
		status,
		ok: status < 400,
		headers: { get: (n) => map.get(n) ?? null },
		text: async () => body ?? "",
		json: async () => JSON.parse(body ?? "{}"),
		get body() {
			return map.get("content-type")?.includes("event-stream")
				? stream()
				: null;
		},
	};
}

/** Servidor MCP Streamable HTTP falso sobre fetch stubado. */
function fakeServer(log = []) {
	return vi.fn(async (url, init) => {
		const message = JSON.parse(init.body);
		log.push({ message, init });
		if (message.method === "initialize") {
			return res(200, { "mcp-session-id": "abc123", "content-type": "application/json" },
				JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "t", version: "1" } } }));
		}
		if (message.method === "notifications/initialized") {
			return res(202);
		}
		if (message.method === "tools/list") {
			return res(200, { "content-type": "application/json" },
				JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { tools: [{ name: "search", description: "Busca", inputSchema: { type: "object", properties: { q: { type: "string" } } } }] } }));
		}
		if (message.method === "tools/call") {
			return res(200, { "content-type": "text/event-stream" },
				`event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text: `eco:${message.params.arguments?.t}` }] } })}\n\n`);
		}
		return res(404);
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("toOpenAiParameters", () => {
	it("mantém object schemas e normaliza o resto", () => {
		expect(toOpenAiParameters({ type: "object", properties: {} })).toMatchObject({ type: "object" });
		expect(toOpenAiParameters(undefined)).toEqual({ type: "object", properties: {} });
	});
});

describe("createMcpClient (SDK oficial)", () => {
	it("conecta, lista tools com schema mapeado e devolve a sessão", async () => {
		const log = [];
		vi.stubGlobal("fetch", fakeServer(log));
		const client = createMcpClient({ url: "https://srv/mcp" });
		await client.initialize();
		expect(client.getSessionId()).toBe("abc123");
		const tools = await client.listTools();
		expect(tools[0]).toMatchObject({
			name: "search",
			description: "Busca",
			parameters: { type: "object", properties: { q: { type: "string" } } },
		});
		// a sessão voltou nas requisições seguintes
		const listCall = log.find((e) => e.message.method === "tools/list");
		const sent = (name) =>
			listCall.init.headers instanceof Headers
				? listCall.init.headers.get(name)
				: (listCall.init.headers ?? {})[name] ??
					(listCall.init.headers ?? {})[name.toLowerCase()];
		expect(sent("Mcp-Session-Id")).toBe("abc123");
	});

	it("faz callTool com resposta SSE e devolve texto", async () => {
		vi.stubGlobal("fetch", fakeServer());
		const client = createMcpClient({ url: "https://srv/mcp" });
		await client.initialize();
		const out = await client.callTool("eco", { t: "ola" });
		expect(out).toEqual({ content: "eco:ola" });
	});

	it("recusa operações antes de inicializar", async () => {
		const client = createMcpClient({ url: "https://srv/mcp" });
		await expect(client.listTools()).rejects.toThrow();
		await expect(client.callTool("x", {})).rejects.toThrow();
	});

	it("propaga erro de servidor", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => res(500)));
		const client = createMcpClient({ url: "https://srv/mcp" });
		await expect(client.initialize()).rejects.toThrow();
	});

	it("recusa servidor que não fala MCP", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				res(200, { "content-type": "application/json" }, JSON.stringify({ jsonrpc: "2.0", id: 0, result: {} })),
			),
		);
		const client = createMcpClient({ url: "https://srv/mcp" });
		await expect(client.initialize()).rejects.toThrow();
	});

	it("converte isError da tool em error", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url, init) => {
				const message = JSON.parse(init.body);
				if (message.method === "initialize") {
					return res(200, { "content-type": "application/json" },
						JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "t", version: "1" } } }));
				}
				if (message.method === "notifications/initialized") {
					return res(202);
				}
				return res(200, { "content-type": "application/json" },
					JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { isError: true, content: [{ type: "text", text: "falhou" }] } }));
			}),
		);
		const client = createMcpClient({ url: "https://srv/mcp" });
		await client.initialize();
		expect(await client.callTool("bad", {})).toEqual({ error: "falhou" });
	});

	it("fecha cliente sem lançar unhandled rejection mesmo se não inicializado", async () => {
		const client = createMcpClient({ url: "https://srv/mcp" });
		await expect(client.close()).resolves.toBeUndefined();
	});
});
