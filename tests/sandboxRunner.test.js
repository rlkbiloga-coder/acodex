import { describe, expect, it } from "vitest";
import {
	canRun,
	detectCodeLanguage,
	formatLines,
	resolveLanguage,
	runCode,
} from "../src/sidebarApps/aiChat/sandboxRunner";

describe("sandboxRunner (chat IA)", () => {
	it("resolve aliases para js/py/sh", () => {
		expect(resolveLanguage("javascript")).toBe("js");
		expect(resolveLanguage("py")).toBe("py");
		expect(resolveLanguage("Bash")).toBe("sh");
		expect(resolveLanguage("rust")).toBeNull();
		expect(resolveLanguage("")).toBeNull();
	});

	it("detecta linguagem pelo class do code", () => {
		const fake = (cls) => ({ getAttribute: () => cls });
		expect(detectCodeLanguage(fake("language-python"))).toBe("py");
		expect(detectCodeLanguage(fake(""))).toBeNull();
		expect(detectCodeLanguage(null)).toBeNull();
	});

	it("py e sh sempre disponíveis", () => {
		expect(canRun("py")).toBe(true);
		expect(canRun("sh")).toBe(true);
		expect(canRun("rust")).toBe(false);
	});

	it("formatLines marca erro e resultado", () => {
		expect(
			formatLines([
				{ type: "log", text: "a" },
				{ type: "result", text: "2" },
			]),
		).toEqual({ ok: true, output: "a\n=> 2" });
		expect(formatLines([{ type: "error", text: "x" }]).ok).toBe(false);
		expect(formatLines(null)).toEqual({ ok: true, output: "" });
	});

	it("shell emulado roda echo e rejeita comando desconhecido", async () => {
		expect(await runCode("sh", "echo oi")).toEqual({ ok: true, output: "oi" });
		const bad = await runCode("sh", "rm -rf x");
		expect(bad.ok).toBe(false);
		expect(bad.output).toContain("não suportado");
	});
});
