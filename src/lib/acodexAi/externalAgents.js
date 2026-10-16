/**
 * Agentes externos consultáveis pelo Acodex AI (frontend puro).
 *
 * Cada entrada descreve um Superagent do Base44 acessível pela API pública
 * `/api/agents/<agent_id>`. A chave de API de cada agente é fornecida pelo
 * dono e fica salva na configuração local (não vai para o build).
 */

/** @typedef {object} ExternalAgent
 * @property {string} id Identificador curto usado nas ferramentas.
 * @property {string} name Nome de exibição do agente.
 * @property {string} baseUrl URL pública da API do agente.
 * @property {string} keySetting Nome da configuração que guarda a API key.
 * @property {string} description O que o agente pode fazer.
 */

/** @type {ExternalAgent[]} */
export const EXTERNAL_AGENTS = [
	{
		id: "vesper",
		name: "Vesper",
		baseUrl: "https://app.base44.com/api/agents/6a9f0d098a75c0a192a61ea7",
		keySetting: "aiVesperApiKey",
		description:
			"Superagent da Geiza no Base44: conversas, memória, automações (Hotmart, Instagram) e pesquisas.",
	},
];

/**
 * Busca um agente externo pelo id.
 * @param {string} id
 * @returns {ExternalAgent | null}
 */
export function getExternalAgent(id) {
	return EXTERNAL_AGENTS.find((agent) => agent.id === id) || null;
}
