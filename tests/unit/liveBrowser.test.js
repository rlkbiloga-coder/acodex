import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createLiveBrowserClient,
	ensureSession,
	normalizeServerUrl,
	parseEndpointError,
	setSessionId,
} from "../../src/lib/acodexAi/liveBrowser";
import { registerLiveBrowserTools } from "../../src/lib/acodexAi/liveBrowserTools";
import { createToolRegistry } from "../../src/lib/acodexAi/tools";

/** Registry falso que só expõe registerTool/definitions/execute. */
function fakeRegistry() {
	const tools = {};
	return {
		registerTool: (name, tool) => (tools[name] = tool),
		removeTool: (name) => delete tools[name],
		get definitions() {
			return Object.keys(tools);
		},
		execute: async (name, rawArgs) => {
			const tool = tools[name];
			if (!tool) return { error: "unknown" };
			try {
				return (await tool.run(JSON.parse(rawArgs || "{}"))) ?? { ok: true };
			} catch (error) {
				return { error: error?.message || String(error) };
			}
		},
	};
}

function jsonResponse(body, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		headers: { get: () => "application/json" },
		json: async () => body,
	};
}

describe("normalizeServerUrl", () => {
	it("normaliza http com barra final", () => {
		expect(normalizeServerUrl("http://192.168.1.20:3000/")).toBe(
			"http://192.168.1.20:3000",
		);
	});

	it("aceita https", () => {
		expect(normalizeServerUrl(" https://me.dominio.dev ")).toBe(
			"https://me.dominio.dev",
		);
	});

	it("rejeita protocolo que não seja http(s)", () => {
		expect(() => normalizeServerUrl("ftp://exemplo.com")).toThrow();
	});

	it("rejeita vazio", () => {
		expect(() => normalizeServerUrl("   ")).toThrow();
	});
});

describe("parseEndpointError", () => {
	it("usa a mensagem e o código do backend", () => {
		const error = parseEndpointError(
			{ error: "Sessão não encontrada.", code: "HTTP_ERROR" },
			404,
		);
		expect(error.message).toBe("Sessão não encontrada.");
		expect(error.status).toBe(404);
	});

	it("torna APPROVAL_REQUIRED reconhecível", () => {
		const error = parseEndpointError(
			{ error: "aprovação necessária", code: "APPROVAL_REQUIRED" },
			409,
		);
		expect(error.code).toBe("APPROVAL_REQUIRED");
	});
});

describe("createLiveBrowserClient", () => {
	it("envia token em x-acx-token nas chamadas", async () => {
		const fetchImpl = vi.fn(async () =>
			jsonResponse({ id: "s1", state: { url: "about:blank" } }),
		);
		const client = createLiveBrowserClient({
			baseUrl: "http://srv:3000",
			token: "tok123",
			fetchImpl,
		});
		await client.createSession();
		const [, init] = fetchImpl.mock.calls[0];
		expect(init.headers["x-acx-token"]).toBe("tok123");
		expect(init.headers["Content-Type"]).toBe("application/json");
	});

	it("explode com o código quando a resposta é de erro", async () => {
		const fetchImpl = vi.fn(async () =>
			jsonResponse({ error: "IP privado bloqueado.", code: "ERROR" }, 400),
		);
		const client = createLiveBrowserClient({
			baseUrl: "http://srv:3000",
			fetchImpl,
		});
		await expect(client.navigate("s1", "http://10.0.0.5")).rejects.toThrow(
			/IP privado/,
		);
	});

	it("navega com timeout maior e body correto", async () => {
		const fetchImpl = vi.fn(async () => jsonResponse({ ok: true, state: {} }));
		const client = createLiveBrowserClient({
			baseUrl: "http://srv:3000",
			fetchImpl,
		});
		await client.navigate("abc", "https://exemplo.com");
		const [url, init] = fetchImpl.mock.calls[0];
		expect(url).toBe("http://srv:3000/api/browser/abc/navigate");
		expect(init.method).toBe("POST");
		expect(JSON.parse(init.body)).toEqual({ url: "https://exemplo.com" });
	});
});

describe("liveBrowserTools", () => {
	let registry;

	beforeEach(() => {
		registry = fakeRegistry();
		setSessionId(null);
	});

	it("registra as seis ferramentas de navegador", () => {
		const appSettings = { value: { liveBrowserUrl: "http://srv:3000" } };
		registerLiveBrowserTools(registry, { appSettings });
		const names = registry.definitions;
		expect(names).toContain("browser_create_session");
		expect(names).toContain("browser_navigate");
		expect(names).toContain("browser_get_state");
		expect(names).toContain("browser_screenshot");
		expect(names).toContain("browser_click");
		expect(names).toContain("browser_fill");
		expect(names).toHaveLength(6);
	});

	it("orienta a configurar o servidor quando ausente", async () => {
		registerLiveBrowserTools(registry, { appSettings: { value: {} } });
		const result = await registry.execute("browser_navigate", '{"url":"https://a.com"}');
		expect(result.error).toMatch(/not configured/i);
	});

	it("navigate cria sessão e repassa a URL", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ id: "xyz", state: { url: "about:blank" } }))
			.mockResolvedValueOnce(
				jsonResponse({ ok: true, state: { url: "https://exemplo.com", title: "Ex" } }),
			);
		const client = createLiveBrowserClient({
			baseUrl: "http://srv:3000",
			token: "t",
			fetchImpl,
		});
		registerLiveBrowserTools(registry, {
			appSettings: { value: {} },
			clientFactory: () => client,
		});
		const result = await registry.execute(
			"browser_navigate",
			'{"url":"https://exemplo.com"}',
		);
		expect(fetchImpl).toHaveBeenCalledTimes(2);
		expect(result.ok).toBe(true);
		expect(result.sessionId).toBe("xyz");
		expect(result.title).toBe("Ex");
	});
});

describe("ensureSession", () => {
	beforeEach(() => setSessionId(null));

	it("reusa a sessão corrente quando ela ainda vive", async () => {
		setSessionId("live1");
		const fetchImpl = vi.fn(async () =>
			jsonResponse({ url: "https://exemplo.com", title: "Ok" }),
		);
		const client = createLiveBrowserClient({
			baseUrl: "http://srv:3000",
			fetchImpl,
		});
		const session = await ensureSession(client);
		expect(session.id).toBe("live1");
		expect(fetchImpl.mock.calls[0][0]).toBe("http://srv:3000/api/browser/live1/state");
	});

	it("abre sessão nova quando a antiga morreu", async () => {
		setSessionId("dead");
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ error: "expirada" }, 404))
			.mockResolvedValueOnce(jsonResponse({ id: "fresh", state: { url: "about:blank" } }));
		const client = createLiveBrowserClient({
			baseUrl: "http://srv:3000",
			fetchImpl,
		});
		const session = await ensureSession(client);
		expect(session.id).toBe("fresh");
	});
});

describe("registry integration", () => {
	it("as tools do navegador coexistem com o registry real", () => {
		const registry = createToolRegistry({
			getActiveFile: () => null,
			getOpenFiles: () => [],
			getEditor: () => null,
			createFile: () => {},
			openFile: () => {},
			switchFile: () => {},
			execCommand: () => {},
			listCommands: () => [],
			confirm: async () => true,
		});
		registerLiveBrowserTools(registry, {
			appSettings: { value: { liveBrowserUrl: "http://srv:3000" } },
		});
		const names = registry.definitions.map((d) => d.function.name);
		expect(names).toContain("browser_navigate");
		expect(names).toContain("get_active_file");
		expect(
			registry.definitions.find((d) => d.function.name === "browser_navigate")
				.function.parameters.required,
		).toEqual(["url"]);
	});
});
