// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../res/acodex-ia/banner.jpg?inline", () => ({
	default: "data:image/jpeg;base64,AAAA",
}));
vi.mock("../../res/acodex-ia/descanso.jpg", () => ({
	default: "descanso.jpg",
}));

import {
	REST_IDLE_MS,
	REST_MIN_MS,
	createCosmosBanner,
	createRestScreen,
} from "sidebarApps/aiChat/cosmos";

describe("acodex cosmos", () => {
	let host;

	beforeEach(() => {
		vi.useFakeTimers();
		host = document.createElement("div");
		document.body.append(host);
	});

	afterEach(() => {
		vi.useRealTimers();
		host.remove();
	});

	it("banner usa a arte e o rótulo AcodeX IA", () => {
		const $b = createCosmosBanner();
		expect($b.className).toBe("ai-cosmos-banner");
		expect($b.style.backgroundImage).toContain("data:image/jpeg");
		expect($b.textContent).toBe("AcodeX IA");
	});

	it("aparece só depois do tempo ocioso", () => {
		const rest = createRestScreen(host, { idleMs: 20000 });
		expect(rest.isVisible()).toBe(false);
		vi.advanceTimersByTime(19000);
		expect(rest.isVisible()).toBe(false);
		vi.advanceTimersByTime(2000);
		expect(rest.isVisible()).toBe(true);
		expect(host.querySelector(".ai-rest").classList.contains("visible")).toBe(true);
	});

	it("interação reinicia a contagem", () => {
		const rest = createRestScreen(host, { idleMs: 20000 });
		vi.advanceTimersByTime(15000);
		host.dispatchEvent(new Event("pointerdown"));
		vi.advanceTimersByTime(15000);
		expect(rest.isVisible()).toBe(false);
		vi.advanceTimersByTime(6000);
		expect(rest.isVisible()).toBe(true);
	});

	it("não cobre o chat enquanto a IA responde", () => {
		let busy = true;
		const rest = createRestScreen(host, { idleMs: 20000, isBusy: () => busy });
		vi.advanceTimersByTime(25000);
		expect(rest.isVisible()).toBe(false);
		busy = false;
		vi.advanceTimersByTime(21000);
		expect(rest.isVisible()).toBe(true);
	});

	it("toque na tela de descanso fecha e reinicia", () => {
		const rest = createRestScreen(host, { idleMs: 20000 });
		vi.advanceTimersByTime(21000);
		expect(rest.isVisible()).toBe(true);
		host.querySelector(".ai-rest").dispatchEvent(new Event("pointerdown"));
		expect(rest.isVisible()).toBe(false);
		vi.advanceTimersByTime(21000);
		expect(rest.isVisible()).toBe(true);
	});

	it("respeita o mínimo e destroy limpa tudo", () => {
		const rest = createRestScreen(host, { idleMs: 100 });
		vi.advanceTimersByTime(REST_MIN_MS - 1000);
		expect(rest.isVisible()).toBe(false);
		rest.destroy();
		expect(host.querySelector(".ai-rest")).toBeNull();
		vi.advanceTimersByTime(REST_IDLE_MS * 2);
		expect(rest.isVisible()).toBe(false);
	});
});
