import settingsPage from "components/settingsPage";
import alert from "dialogs/alert";
import prompt from "dialogs/prompt";
import { nativeFetch } from "lib/acodexAi/nativeFetch";
import appSettings from "lib/settings";
import { testMcpConnection } from "./mcpConnection";

function currentUrl() {
	return appSettings.value.aiMcpUrl || "";
}

/**
 * Página "Servidores MCP": configura e testa a URL do servidor MCP usada
 * pelo Acodex AI (setting aiMcpUrl, cliente lib/acodexAi/mcp).
 */
export default function mcpSettings() {
	const items = [
		{
			key: "url",
			text: "Servidor MCP",
			info: currentUrl() || "Nenhum servidor configurado",
			icon: "terminal",
			chevron: true,
		},
		{
			key: "test",
			text: "Testar conexão",
			info: "Conecta e lista as ferramentas do servidor",
			icon: "play_arrow",
			chevron: false,
		},
		{
			key: "clear",
			text: "Remover servidor",
			info: "Limpa a URL configurada",
			icon: "delete_outline",
			chevron: false,
		},
	];

	const page = settingsPage(
		"Servidores MCP",
		items,
		async (key) => {
			if (key === "url") {
				const value = await prompt(
					"URL do servidor MCP (https://...)",
					currentUrl(),
					"text",
					{
						test: (val) => val.trim() === "" || /^https?:\/\//.test(val.trim()),
					},
				);
				if (value === null) return;
				await appSettings.update({ aiMcpUrl: value.trim() }, false);
				page.hide();
				mcpSettings();
				return;
			}
			if (key === "test") {
				const url = currentUrl();
				if (!url) {
					alert("MCP", "Configure a URL do servidor primeiro.");
					return;
				}
				try {
					const tools = await testMcpConnection(url);
					alert(
						"MCP",
						`Conectado. ${tools.length} ferramentas:\n${tools
							.map((tool) => tool.name)
							.join("\n")}`,
					);
				} catch (error) {
					alert("MCP", `Falha na conexão: ${error?.message || error}`);
				}
				return;
			}
			if (key === "clear") {
				await appSettings.update({ aiMcpUrl: "" }, false);
				page.hide();
				mcpSettings();
			}
		},
		"separate",
		{
			preserveOrder: true,
			pageClassName: "detail-settings-page",
			listClassName: "detail-settings-list",
			groupByDefault: true,
		},
	);
	page.show();
}
