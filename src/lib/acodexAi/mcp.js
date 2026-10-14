/**
 * Cliente MCP (Model Context Protocol) para o Acodex AI.
 *
 * Implementa o transporte "Streamable HTTP" do MCP via JSON-RPC 2.0:
 * inicializa a sessão, lista ferramentas do servidor e executa chamadas.
 * Projetado para rodar no app (fetch do Cordova/navegador), sem depender
 * de subprocessos nem de SDKs nativas.
 */

/** Versão do protocolo que o cliente negocia com o servidor. */
export const MCP_PROTOCOL_VERSION = "2025-06-18";

/** Tempo padrão de espera por resposta do servidor (ms). */
export const DEFAULT_TIMEOUT_MS = 30000;

/** Nome exibido para este cliente no handshake. */
export const CLIENT_INFO = { name: "acodex-ai", version: "1.0.0" };

/**
 * Extrai as mensagens JSON de um corpo text/event-stream.
 * @param {string} text corpo bruto da resposta
 * @param {number} [id] id da requisição que queremos
 * @returns {object|null} primeira mensagem com o id (ou a última, se sem id)
 */
export function parseSseBody(text, id) {
	const events = [];
	let buffer = [];
	for (const line of text.split(/\r?\n/)) {
		if (line.startsWith("data:")) {
			buffer.push(line.slice(5).trimStart());
		} else if (!line.trim() && buffer.length) {
			events.push(buffer.join("\n"));
			buffer = [];
		}
	}
	if (buffer.length) events.push(buffer.join("\n"));
	let last = null;
	for (const raw of events) {
		let message;
		try {
			message = JSON.parse(raw);
		} catch {
			continue;
		}
		if (id !== undefined && message?.id === id) return message;
		last = message;
	}
	return last;
}

/**
 * Normaliza o inputSchema de uma tool MCP para o formato de parâmetros
 * OpenAI-compatible usado pelo registry do acodex.
 * @param {object|undefined} inputSchema
 */
export function toOpenAiParameters(inputSchema) {
	if (
		inputSchema &&
		typeof inputSchema === "object" &&
		inputSchema.type === "object"
	) {
		return inputSchema;
	}
	return { type: "object", properties: {} };
}

/**
 * Cria um cliente MCP conectado a um servidor Streamable HTTP.
 *
 * @param {{url: string, name?: string, headers?: Record<string,string>, fetchImpl?: typeof fetch, timeoutMs?: number}} options
 * @returns {{initialize: (signal?: AbortSignal) => Promise<void>, listTools: (signal?: AbortSignal) => Promise<Array<{name: string, description: string, parameters: object}>>, callTool: (name: string, args: object, signal?: AbortSignal) => Promise<{content?: string, error?: string}>, getSessionId: () => (string|null)}}
 */
export function createMcpClient(options) {
	const {
		url,
		name = "acodex",
		headers = {},
		fetchImpl = fetch,
		timeoutMs = DEFAULT_TIMEOUT_MS,
	} = options;
	if (!url) throw new Error("URL do servidor MCP é obrigatória.");

	let sessionId = null;
	let nextId = 0;
	let initialized = false;

	/** Envia uma requisição/notificação JSON-RPC e devolve o `result`. */
	async function rpc(method, params, { signal, notification = false } = {}) {
		const message = { jsonrpc: "2.0", method };
		if (!notification) message.id = ++nextId;
		if (params !== undefined) message.params = params;
		const timeoutSignal = AbortSignal.timeout(timeoutMs);
		let response;
		try {
			response = await fetchImpl(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json, text/event-stream",
					...headers,
					...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
				},
				body: JSON.stringify(message),
				signal: signal ?? timeoutSignal,
			});
		} catch (error) {
			if (error?.name === "AbortError" && !signal) {
				throw new Error(`Servidor MCP não respondeu em ${timeoutMs / 1000}s.`);
			}
			throw error;
		}
		// sessão expirada no servidor: informa em vez de insistir em cego
		if (response.status === 404 && sessionId) {
			throw new Error("Sessão MCP expirou no servidor. Reconecte.");
		}
		if (!response.ok) {
			throw new Error(`Servidor MCP respondeu HTTP ${response.status}.`);
		}
		const newSession = response.headers?.get?.("mcp-session-id");
		if (newSession) sessionId = newSession;
		const contentType =
			response.headers?.get?.("content-type")?.toLowerCase() ?? "";
		const text = await response.text();
		if (!text.trim()) return notification ? null : undefined;
		let payload;
		try {
			payload =
				contentType.includes("text/event-stream") ||
				text.trimStart().startsWith("event") ||
				text.includes("data:")
					? parseSseBody(text, message.id)
					: JSON.parse(text);
		} catch {
			throw new Error("Resposta do servidor MCP não é JSON válido.");
		}
		if (!payload) return notification ? null : undefined;
		if (payload.error) {
			throw new Error(
				payload.error.message || "Erro reportado pelo servidor MCP.",
			);
		}
		return payload.result;
	}

	return {
		async initialize(signal) {
			const result = await rpc(
				"initialize",
				{
					protocolVersion: MCP_PROTOCOL_VERSION,
					capabilities: {},
					clientInfo: { ...CLIENT_INFO, name },
				},
				{ signal },
			);
			const serverVersion = result?.protocolVersion;
			if (!serverVersion)
				throw new Error("Servidor não parece ser um MCP válido.");
			await rpc("notifications/initialized", undefined, {
				notification: true,
				signal,
			});
			initialized = true;
		},
		async listTools(signal) {
			if (!initialized) throw new Error("Cliente MCP não inicializado.");
			const result = await rpc("tools/list", {}, { signal });
			const tools = (result?.tools ?? []).map((tool) => ({
				name: String(tool.name),
				description: String(tool.description ?? `Ferramenta MCP ${tool.name}.`),
				parameters: toOpenAiParameters(tool.inputSchema),
			}));
			return tools;
		},
		async callTool(toolName, args, signal) {
			if (!initialized) throw new Error("Cliente MCP não inicializado.");
			const result = await rpc(
				"tools/call",
				{ name: toolName, arguments: args ?? {} },
				{ signal },
			);
			const parts = (result?.content ?? []).filter(
				(part) => typeof part?.text === "string",
			);
			const text = parts.map((part) => part.text).join("\n");
			if (result?.isError) return { error: text || "Tool MCP retornou erro." };
			return { content: text };
		},
		getSessionId: () => sessionId,
	};
}
