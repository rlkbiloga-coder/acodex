import { describe, expect, it, vi, afterEach } from "vitest";
import { nativeFetch } from "../../src/lib/acodexAi/nativeFetch";

afterEach(() => {
	delete globalThis.cordova;
	vi.restoreAllMocks();
});

describe("nativeFetch", () => {
	it("remove o listener de abort no AbortSignal ao finalizar a requisição", async () => {
		const controller = new AbortController();
		const signal = controller.signal;
		const addSpy = vi.spyOn(signal, "addEventListener");
		const removeSpy = vi.spyOn(signal, "removeEventListener");

		globalThis.cordova = {
			plugin: {
				http: {
					sendRequest: (url, options, success) => {
						success({ status: 200, data: "ok", headers: {} });
						return 1;
					},
				},
			},
		};

		const res = await nativeFetch("https://example.com/api", { signal });
		expect(await res.text()).toBe("ok");
		expect(addSpy).toHaveBeenCalledWith("abort", expect.any(Function));
		expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
	});

	it("remove o listener de abort quando ocorre erro HTTP", async () => {
		const controller = new AbortController();
		const signal = controller.signal;
		const removeSpy = vi.spyOn(signal, "removeEventListener");

		globalThis.cordova = {
			plugin: {
				http: {
					sendRequest: (url, options, success, error) => {
						error({ status: 500, error: "server error", headers: {} });
						return 2;
					},
				},
			},
		};

		const res = await nativeFetch("https://example.com/api", { signal });
		expect(res.status).toBe(500);
		expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
	});
});
