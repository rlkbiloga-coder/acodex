import { describe, expect, it } from "vitest";
import { shouldShowScrollButton, timeGreeting } from "sidebarApps/aiChat/immersion";

describe("imersao", () => {
	it("saudacao por horario", () => {
		expect(timeGreeting(new Date(2026, 9, 16, 8, 0, 0))).toBe("bom dia");
		expect(timeGreeting(new Date(2026, 9, 16, 14, 0, 0))).toBe("boa tarde");
		expect(timeGreeting(new Date(2026, 9, 16, 22, 0, 0))).toBe("boa noite");
		expect(timeGreeting(new Date(2026, 9, 16, 2, 0, 0))).toBe("boa noite");
	});

	it("botao de scroll aparece so quando rolou pra cima", () => {
		expect(
			shouldShowScrollButton({ scrollTop: 0, scrollHeight: 1000, clientHeight: 400 }),
		).toBe(true);
		expect(
			shouldShowScrollButton({ scrollTop: 600, scrollHeight: 1000, clientHeight: 400 }),
		).toBe(false);
		expect(shouldShowScrollButton(null)).toBe(false);
	});
});
