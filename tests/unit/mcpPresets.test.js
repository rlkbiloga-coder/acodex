import { describe, expect, it } from "vitest";
import { MCP_SERVER_PRESETS, getMcpPreset } from "settings/mcpPresets";

describe("presets MCP publicos", () => {
	it("tem os tres servidores verificados", () => {
		expect(MCP_SERVER_PRESETS.length).toBe(3);
		const ids = MCP_SERVER_PRESETS.map((p) => p.id);
		expect(ids).toContain("context7");
		expect(ids).toContain("deepwiki");
		expect(ids).toContain("huggingface");
	});

	it("todas as URLs sao https e terminam em /mcp", () => {
		for (const p of MCP_SERVER_PRESETS) {
			expect(p.url).toMatch(/^https:\/\/.+\/mcp$/);
		}
	});

	it("busca por id e null para desconhecido", () => {
		expect(getMcpPreset("context7").name).toBe("Context7");
		expect(getMcpPreset("nada")).toBeNull();
	});
});
