import { describe, expect, it } from "vitest";
import {
	NVIDIA_NIM_BASE_URL,
	NVIDIA_NIM_MODELS,
} from "sidebarApps/aiChat/nimPresets";

describe("NVIDIA NIM presets", () => {
	it("aponta para o endpoint publico do NIM", () => {
		expect(NVIDIA_NIM_BASE_URL).toBe("https://integrate.api.nvidia.com/v1");
	});

	it("lista modelos fortes com baseUrl do NIM", () => {
		expect(NVIDIA_NIM_MODELS.length).toBeGreaterThanOrEqual(8);
		for (const model of NVIDIA_NIM_MODELS) {
			expect(model.baseUrl).toBe(NVIDIA_NIM_BASE_URL);
			expect(model.id).toMatch(/^[\w.-]+\/[\w.-]+$/);
		}
		const ids = NVIDIA_NIM_MODELS.map((model) => model.id);
		expect(ids).toContain("meta/llama-3.2-90b-vision-instruct");
		expect(ids).toContain("moonshotai/kimi-k3");
		expect(ids).toContain("z-ai/glm-5.3");
		expect(ids).toContain("z-ai/glm-5.3-flash");
	});
});
