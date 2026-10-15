import { describe, expect, it } from "vitest";
import {
	DEFAULT_POWER_MODE,
	describePowerModeChange,
	getPowerMode,
	normalizePowerMode,
} from "sidebarApps/aiChat/powerMode";

describe("power mode", () => {
	it("padrao e low (economia)", () => {
		expect(DEFAULT_POWER_MODE).toBe("low");
		expect(getPowerMode(undefined).id).toBe("low");
		expect(getPowerMode("low").maxTokens).toBe(600);
		expect(getPowerMode("low").nudge).toContain("conciso");
		expect(normalizePowerMode("max")).toBe("maximo");
		expect(normalizePowerMode("economia")).toBe("low");
		expect(normalizePowerMode("qualquer-coisa")).toBe("low");
	});

	it("modo padrao sem limite e maximo com limite alto", () => {
		expect(getPowerMode("padrao").maxTokens).toBeNull();
		expect(getPowerMode("maximo").maxTokens).toBeGreaterThan(1000);
		expect(getPowerMode("maximo").nudge).toContain("detalhada");
	});

	it("descreve o que muda entre modos", () => {
		const text = describePowerModeChange("low", "maximo");
		expect(text).toContain("Econômico → Máximo");
		expect(text).toContain("2400 tokens");
	});

	it("sem mudanca entre modos iguais", () => {
		expect(describePowerModeChange("padrao", "padrao")).toContain(
			"Padrão → Padrão",
		);
	});
});
