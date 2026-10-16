import { describe, expect, it, vi } from "vitest";

const mcpClientDouble = {
	initialize: vi.fn(async () => {}),
	listTools: vi.fn(async () => [
		{ name: "search", description: "Busca na web", parameters: {} },
	]),
};

vi.mock("lib/acodexAi/mcp", () => ({
	createMcpClient: vi.fn(() => mcpClientDouble),
}));
vi.mock("lib/acodexAi/nativeFetch", () => ({ nativeFetch: vi.fn() }));

import { createMcpClient } from "lib/acodexAi/mcp";
import { testMcpConnection } from "../../src/settings/mcpConnection";

describe("mcpConnection", () => {
	it("testa a conexao usando o cliente do Acodex AI", async () => {
		const tools = await testMcpConnection("https://mcp.exemplo.com/mcp");
		expect(createMcpClient).toHaveBeenCalledWith(
			expect.objectContaining({ url: "https://mcp.exemplo.com/mcp" }),
		);
		expect(mcpClientDouble.initialize).toHaveBeenCalled();
		expect(tools[0].name).toBe("search");
	});
});
