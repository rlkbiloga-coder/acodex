/**
 * Fallback automático de modelo: quando o modelo principal falha
 * (429/5xx/rede), o client tenta os próximos da lista no mesmo endpoint.
 * Frontend puro; consumido pelo wrapper `complete` do chat.
 */

/** Modelos de reserva por endpoint (mesma baseUrl, mesma key). */
const FALLBACKS = {
	"integrate.api.nvidia.com": [
		"nvidia/nemotron-3.5-lightning-30b-a3b",
		"openai/gpt-oss-20b",
		"google/gemma-4-31b-it",
	],
	"openrouter.ai": [
		"google/gemma-4-31b-it:free",
		"mistralai/mistral-small-3.2:free",
	],
	"api.groq.com": ["llama-3.3-70b-versatile", "openai/gpt-oss-20b"],
};

/**
 * Lista de fallbacks para a config atual (sem incluir o modelo em uso).
 * @param {{baseUrl?: string, model?: string}} config
 * @returns {string[]}
 */
export function getFallbackModels(config) {
	const host = config?.baseUrl || "";
	const key = Object.keys(FALLBACKS).find((h) => host.includes(h));
	if (!key) return [];
	const model = config.model || "";
	return FALLBACKS[key].filter((m) => m !== model).slice(0, 2);
}
