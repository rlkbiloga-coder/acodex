import { describe, expect, it } from "vitest";
import { GROQ_MODELS, OPENROUTER_FREE_MODELS } from "sidebarApps/aiChat/freeProviders";

describe("presets free (OpenRouter/Groq)", () => {
	it("modelos OpenRouter terminam com :free", () => {
		expect(OPENROUTER_FREE_MODELS.length).toBeGreaterThanOrEqual(5);
		for (const m of OPENROUTER_FREE_MODELS) {
			expect(m.id).toMatch(/:free$/);
			expect(m.label).toBeTruthy();
		}
	});

	it("modelos Groq tem id valido", () => {
		expect(GROQ_MODELS.length).toBeGreaterThanOrEqual(3);
		for (const m of GROQ_MODELS) {
			expect(m.id).toMatch(/^[\w/.:-]+$/);
			expect(m.label).toContain("Groq");
		}
	});

	it("sem duplicar id entre os dois pools", () => {
		const ids = new Set([
			...OPENROUTER_FREE_MODELS.map((m) => m.id),
			...GROQ_MODELS.map((m) => m.id),
		]);
		expect(ids.size).toBe(
			OPENROUTER_FREE_MODELS.length + GROQ_MODELS.length,
		);
	});
});
