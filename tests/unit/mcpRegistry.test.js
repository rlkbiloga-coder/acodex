import { describe, expect, it } from "vitest";
import { createToolRegistry } from "../../src/lib/acodexAi/tools";

function makeRegistry() {
	return createToolRegistry({
		getActiveFile: () => null,
		getOpenFiles: () => [],
		getEditor: () => null,
		createFile: () => {},
		openFile: () => {},
		switchFile: () => {},
		execCommand: () => {},
		listCommands: () => [],
		confirm: async () => true,
		skills: { skills: [], has: () => false, get: () => null },
	});
}

describe("registry dinamico (MCP)", () => {
	it("registerTool aparece nas definitions e executa", async () => {
		const registry = makeRegistry();
		registry.registerTool("mcp__search", {
			description: "[MCP] Busca",
			parameters: { type: "object", properties: {} },
			run: () => ({ content: "ok" }),
		});
		expect(registry.definitions.map((d) => d.function.name)).toContain("mcp__search");
		expect(await registry.execute("mcp__search", "{}")).toEqual({ content: "ok" });
	});

	it("removeTool tira a tool das definitions", async () => {
		const registry = makeRegistry();
		registry.registerTool("mcp__x", { description: "x", parameters: { type: "object", properties: {} }, run: () => null });
		registry.removeTool("mcp__x");
		expect(registry.definitions.map((d) => d.function.name)).not.toContain("mcp__x");
		expect(await registry.execute("mcp__x", "{}")).toMatchObject({ error: expect.any(String) });
	});
});
