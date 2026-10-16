import { createMcpClient } from "lib/acodexAi/mcp";
import { nativeFetch } from "lib/acodexAi/nativeFetch";

/**
 * Testa a conexão com o servidor MCP configurado usando o cliente do
 * Acodex AI e devolve o resultado com a lista de ferramentas.
 * @param {string} url
 */
export async function testMcpConnection(url) {
	const client = createMcpClient({
		url,
		name: "acodex",
		fetchImpl: nativeFetch,
	});
	await client.initialize();
	const tools = await client.listTools();
	return tools;
}
