/**
 * Ferramenta "consultar_vesper": conecta o Acodex AI ao Superagent
 * Vesper (Superagente da Geiza no Base44) pela API pública de agentes.
 *
 * A API usa `api_key` como header. Fluxo: obter (ou criar) a conversa
 * padrão e enviar a mensagem. Helpers puros exportados para testes.
 */
import { getExternalAgent } from "lib/acodexAi/externalAgents";
import { nativeFetch } from "lib/acodexAi/nativeFetch";
import appSettings from "lib/settings";

/**
 * Extrai o primeiro valor encontrado entre chaves candidatas.
 * @param {object} obj Resposta da API
 * @param {string[]} keys Chaves candidatas em ordem de preferência
 * @returns {any}
 */
export function pickFrom(obj, keys) {
	if (!obj || typeof obj !== "object") return undefined;
	for (const key of keys) {
		if (obj[key] !== undefined && obj[key] !== null) return obj[key];
	}
	return undefined;
}

/**
 * Normaliza a resposta de "listar/criar conversa" para um id.
 * @param {object|any[]} data Resposta de GET/POST /conversations
 * @returns {string | null}
 */
export function extractConversationId(data) {
	if (Array.isArray(data)) {
		const first = data[0];
		return extractConversationId(first);
	}
	const id = pickFrom(data, ["id", "conversation_id", "conversationId"]);
	return typeof id === "string" || typeof id === "number" ? String(id) : null;
}

/**
 * Normaliza a resposta de envio de mensagem para o texto do assistente.
 * @param {object} data Resposta de POST /conversations/{id}/messages
 * @returns {string}
 */
export function extractAssistantText(data) {
	const direct = pickFrom(data, ["content", "text", "message", "answer"]);
	if (typeof direct === "string" && direct.trim()) return direct.trim();
	if (direct && typeof direct === "object") {
		const nested = pickFrom(direct, ["content", "text", "message"]);
		if (typeof nested === "string" && nested.trim()) return nested.trim();
	}
	if (Array.isArray(data)) {
		const last = data[data.length - 1];
		const text = last ? extractAssistantText(last) : "";
		return text;
	}
	return "";
}

/** Nome da tool registrada. */
export const VESPER_TOOL_NAME = "consultar_vesper";

/**
 * Envia uma mensagem ao agente e devolve a resposta.
 * @param {string} message
 * @param {{apiKey?: string, fetchImpl?: Function}} [options]
 * @returns {Promise<{ok: boolean, resposta?: string, error?: string}>}
 */
export async function askVesper(message, options = {}) {
	const agent = getExternalAgent("vesper");
	if (!agent) return { ok: false, error: "agente Vesper não registrado" };
	const apiKey = options.apiKey || appSettings.value[agent.keySetting] || "";
	if (!apiKey.trim()) {
		return { ok: false, error: "API key do Vesper ausente (Configurações)" };
	}
	const fetchImpl = options.fetchImpl || nativeFetch;
	const headers = { "Content-Type": "application/json", api_key: apiKey };
	const base = agent.baseUrl;
	try {
		let response = await fetchImpl(`${base}/conversations`, { headers });
		if (!response.ok) {
			return { ok: false, error: `conversa: HTTP ${response.status}` };
		}
		let conversationId = extractConversationId(await response.json());
		if (!conversationId) {
			response = await fetchImpl(`${base}/conversations`, {
				method: "POST",
				headers,
				body: JSON.stringify({}),
			});
			if (!response.ok) {
				return { ok: false, error: `criar conversa: HTTP ${response.status}` };
			}
			conversationId = extractConversationId(await response.json());
		}
		if (!conversationId) {
			return { ok: false, error: "id de conversa não encontrado" };
		}
		response = await fetchImpl(`${base}/conversations/${conversationId}/messages`, {
			method: "POST",
			headers,
			body: JSON.stringify({ content: message, message: message }),
		});
		if (!response.ok) {
			return { ok: false, error: `mensagem: HTTP ${response.status}` };
		}
		const text = extractAssistantText(await response.json());
		if (!text) return { ok: false, error: "resposta vazia do agente" };
		return { ok: true, resposta: text };
	} catch (error) {
		return { ok: false, error: `Vesper: ${error?.message || error}` };
	}
}

/**
 * Registra/remove a tool no registry conforme a presença da key.
 * @param {{registerTool: Function, removeTool: Function}} registry
 */
export function syncVesperTool(registry) {
	const hasKey = Boolean(
		(appSettings.value.aiVesperApiKey || "").trim(),
	);
	if (!hasKey) {
		registry.removeTool(VESPER_TOOL_NAME);
		return false;
	}
	registry.registerTool(VESPER_TOOL_NAME, {
		description:
			"Conversa com o agente Vesper (Superagent da Geiza no Base44) para tarefas fora do editor: automações, memória, pesquisas, integrações.",
		parameters: {
			type: "object",
			properties: {
				mensagem: {
					type: "string",
					description:
						"Pergunta ou comando para o Vesper. Inclua o contexto necessário.",
				},
			},
			required: ["mensagem"],
		},
		async run({ mensagem }) {
			if (!mensagem) return { error: "mensagem obrigatória" };
			return askVesper(String(mensagem));
		},
	});
	return true;
}
