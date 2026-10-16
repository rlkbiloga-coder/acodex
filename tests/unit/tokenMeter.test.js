import { describe, expect, it } from "vitest";
import { createTokenMeter } from "sidebarApps/aiChat/tokenMeter";

describe("token meter", () => {
	it("comeca leve com 0 tokens", () => {
		const meter = createTokenMeter({ sessionBudgetTokens: 1000 });
		const s = meter.state();
		expect(s.percent).toBe(0);
		expect(s.level).toBe("leve");
	});

	it("estima tokens por caracteres (4 chars = 1 token)", () => {
		const meter = createTokenMeter({ sessionBudgetTokens: 1000 });
		meter.begin(400); // 100 tokens
		meter.trackOutput("x".repeat(400)); // +100 tokens
		expect(meter.state().tokens).toBe(200);
		expect(meter.state().percent).toBe(20);
	});

	it("fica pesado em 70% e esgotado em 95%", () => {
		const meter = createTokenMeter({ sessionBudgetTokens: 1000 });
		meter.begin(700 * 4); // 700 tokens = 70%
		expect(meter.state().level).toBe("pesado");
		meter.begin(960 * 4); // 700 + 960 = 1660 -> 100% (cap)
		expect(meter.state().level).toBe("acabou");
		expect(meter.state().percent).toBe(100);
		expect(meter.state().percent).toBe(100);
	});

	it("respeita limite de rpm com janela de 60s", () => {
		let now = 0;
		const meter = createTokenMeter({
			rpmLimit: 2,
			now: () => now,
		});
		meter.begin();
		expect(meter.state().rpmBlocked).toBe(false);
		now = 1000;
		meter.begin();
		expect(meter.state().rpmBlocked).toBe(true);
		expect(meter.state().level).toBe("acabou");
		expect(meter.state().waitSeconds).toBeGreaterThan(0);
		now = 60_500; // req em 0 sai da janela, req em 1000 continua
		expect(meter.state().rpm).toBe(1);
		expect(meter.state().rpmBlocked).toBe(false);
	});

	it("reset zera a sessao", () => {
		const meter = createTokenMeter({ sessionBudgetTokens: 1000 });
		meter.begin(4000);
		meter.reset();
		expect(meter.state().tokens).toBe(0);
	});
});
