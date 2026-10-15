/**
 * Cliente MCP do Acodex AI, agora sobre o SDK oficial do Model Context
 * Protocol (open source) com o transporte Streamable HTTP.
 *
 * Mantém a API simples que o chat consome: initialize -> listTools ->
 * callTool. Todo o protocolo (handshake, sessão, JSON-RPC, SSE) fica a
 * cargo do SDK oficial.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

/** Tempo padrão de espera por resposta do servidor (ms). */
export const DEFAULT_TIMEOUT_MS = 30000;

/** Nome exibido para este cliente no handshake. */
export const CLIENT_INFO = { name: "acodex-ai", version: "1.0.0" };

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
 * @param {{url: string, name?: string, headers?: Record<string,string>, timeoutMs?: number}} options
 * @returns {{initialize: (signal?: AbortSignal) => Promise<void>, listTools: (signal?: AbortSignal) => Promise<Array<{name: string, description: string, parameters: object}>>, callTool: (name: string, args: object, signal?: AbortSignal) => Promise<{content?: string, error?: string}>, getSessionId: () => (string|null), close: () => Promise<void>}}
 */
export function createMcpClient(options) {
	const {
		url,
		name = "acodex",
		headers = {},
		timeoutMs = DEFAULT_TIMEOUT_MS,
	} = options;
	if (!url) throw new Error("URL do servidor MCP é obrigatória.");

	const client = new Client({ ...CLIENT_INFO, name });
	const transport = new StreamableHTTPClientTransport(new URL(url), {
		requestInit: { headers },
	});
	const requestOptions = (signal) => ({
		signal,
		timeout: timeoutMs,
	});
	let initialized = false;

	return {
		async initialize(signal) {
			if (initialized) return;
			await client.connect(transport, requestOptions(signal));
			initialized = true;
		},
		async listTools(signal) {
			if (!initialized) throw new Error("Cliente MCP não inicializado.");
			const result = await client.listTools({}, requestOptions(signal));
			return (result?.tools ?? []).map((tool) => ({
				name: String(tool.name),
				description: String(tool.description ?? `Ferramenta MCP ${tool.name}.`),
				parameters: toOpenAiParameters(tool.inputSchema),
			}));
		},
		async callTool(toolName, args, signal) {
			if (!initialized) throw new Error("Cliente MCP não inicializado.");
			const result = await client.callTool(
				{ name: toolName, arguments: args ?? {} },
				CallToolResultSchema,
				requestOptions(signal),
			);
			const parts = (result?.content ?? []).filter(
				(part) => typeof part?.text === "string",
			);
			const text = parts.map((part) => part.text).join("\n");
			if (result?.isError) return { error: text || "Tool MCP retornou erro." };
			return { content: text };
		},
		getSessionId: () => transport.sessionId ?? null,
		async close() {
			try {
				await client.close();
			} finally {
				initialized = false;
			}
		},
	};
}
