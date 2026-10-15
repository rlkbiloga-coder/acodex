import { describe, expect, it } from "vitest";
import { EXTERNAL_AGENTS, getExternalAgent } from "lib/acodexAi/externalAgents";

describe("external agents", () => {
	it("tem o agente Vesper com id da conta", () => {
		const vesper = getExternalAgent("vesper");
		expect(vesper).not.toBeNull();
		expect(vesper.baseUrl).toBe(
			"https://app.base44.com/api/agents/6a9f0d098a75c0a192a61ea7",
		);
		expect(vesper.keySetting).toBe("aiVesperApiKey");
		expect(vesper.description).toContain("Geiza");
	});

	it("id desconhecido retorna null", () => {
		expect(getExternalAgent("ninguem")).toBeNull();
	});

	it("todos os agentes tem campos obrigatorios", () => {
		for (const agent of EXTERNAL_AGENTS) {
			expect(agent.id).toBeTruthy();
			expect(agent.baseUrl).toMatch(/^https:\/\//);
			expect(agent.keySetting).toBeTruthy();
		}
	});
});
