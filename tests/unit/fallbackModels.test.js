import { describe, expect, it } from "vitest";
import { getFallbackModels } from "sidebarApps/aiChat/fallbackModels";

describe("fallback de modelos", () => {
	it("NIM tem nemotron lightning e gpt-oss como reserva", () => {
		const f = getFallbackModels({ baseUrl: "https://integrate.api.nvidia.com/v1", model: "z-ai/glm-5.3" });
		expect(f[0]).toBe("nvidia/nemotron-3.5-lightning-30b-a3b");
		expect(f.length).toBeLessThanOrEqual(2);
	});

	it("nao repete o modelo em uso", () => {
		const f = getFallbackModels({ baseUrl: "https://integrate.api.nvidia.com/v1", model: "nvidia/nemotron-3.5-lightning-30b-a3b" });
		expect(f).not.toContain("nvidia/nemotron-3.5-lightning-30b-a3b");
	});

	it("endpoint desconhecido nao tem fallback", () => {
		expect(getFallbackModels({ baseUrl: "https://exemplo.com/v1", model: "x" })).toEqual([]);
	});
});
