/**
 * Presets de servidores MCP públicos (verificados) para a página
 * "Servidores MCP" do Acodex. Todos gratuitos e sem chave.
 */

/** @typedef {object} McpPreset
 * @property {string} id Identificador curto.
 * @property {string} name Nome de exibição.
 * @property {string} url Endpoint MCP (streamable HTTP).
 * @property {string} description O que o servidor oferece.
 */

/** @type {McpPreset[]} */
export const MCP_SERVER_PRESETS = [
	{
		id: "context7",
		name: "Context7",
		url: "https://mcp.context7.com/mcp",
		description: "Documentação atualizada de bibliotecas para o código gerado",
	},
	{
		id: "deepwiki",
		name: "DeepWiki",
		url: "https://mcp.deepwiki.com/mcp",
		description:
			"Wiki de repositórios GitHub: pergunta sobre qualquer repo open source",
	},
	{
		id: "huggingface",
		name: "Hugging Face",
		url: "https://huggingface.co/mcp",
		description: "Busca de modelos e datasets abertos do Hugging Face",
	},
];

/**
 * Busca um preset pelo id.
 * @param {string} id
 * @returns {McpPreset | null}
 */
export function getMcpPreset(id) {
	return MCP_SERVER_PRESETS.find((preset) => preset.id === id) || null;
}
