// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { transformSync } from "@babel/core";
import { describe, expect, it } from "vitest";
import vm from "node:vm";

const requireFromRoot = createRequire(path.resolve("package.json"));
requireFromRoot("html-tag-js/polyfill");
const tag = requireFromRoot("html-tag-js");

function loadActivityLog() {
	const filename = path.resolve(
		"src/sidebarApps/aiChat/activityLog.js",
	);
	const code = transformSync(readFileSync(filename, "utf8"), {
		filename,
		babelrc: false,
		configFile: false,
		presets: [
			["@babel/preset-env", { targets: { node: "current" }, modules: "commonjs" }],
		],
		plugins: [
			"html-tag-js/jsx/syntax-parser.js",
			"html-tag-js/jsx/jsx-to-tag.js",
		],
	}).code;
	const exportsOfModule = {};
	vm.runInNewContext(code, {
		module: { exports: exportsOfModule },
		exports: exportsOfModule,
		tag,
		document,
		navigator,
	});
	return exportsOfModule.createActivityLog;
}

const createActivityLog = loadActivityLog();

function textOf(el, selector) {
	const found = el.querySelector(selector);
	return found ? found.textContent : "";
}

describe("createActivityLog", () => {
	it("registra etapa com comando e saída reais, sem emoji", () => {
		const log = createActivityLog();
		const step = log.addStep("Lendo arquivo ativo", {
			kind: "tool",
			command: { tool: "get_active_file", args: { path: "a.js" } },
		});
		expect(textOf(log.$el, ".ai-log-label")).toBe("Lendo arquivo ativo");
		expect(log.$el.querySelectorAll(".ai-log-block").length).toBe(1);
		expect(textOf(log.$el, ".ai-log-code")).toContain("get_active_file");

		step.done({ content: "const x = 1;" }, 42);
		expect(log.$el.querySelectorAll(".ai-log-step.done").length).toBe(1);
		expect(log.$el.querySelectorAll(".ai-log-block").length).toBe(2);
		expect(textOf(log.$el, ".ai-log-meta")).toBe("42 ms");
		expect(log.$el.textContent).toContain("const x = 1;");
		expect(/\p{Extended_Pictographic}/u.test(log.$el.textContent)).toBe(false);

		log.finish();
		expect(log.$el.classList.contains("ok")).toBe(true);
		expect(textOf(log.$el, ".ai-log-status")).toContain("1 etapa");
	});

	it("linha expande e recolhe ao clicar", () => {
		const log = createActivityLog();
		log.addStep("x", { command: { a: 1 } }).done({ b: 2 });
		const $li = log.$el.querySelector(".ai-log-step");
		const $row = log.$el.querySelector(".ai-log-row");
		expect($li.classList.contains("expanded")).toBe(false);
		$row.onclick();
		expect($li.classList.contains("expanded")).toBe(true);
		$row.onclick();
		expect($li.classList.contains("expanded")).toBe(false);
	});

	it("etapa com erro mostra bloco de erro e marca falha", () => {
		const log = createActivityLog();
		log.addStep("Executando comando", { command: { cmd: "x" } }).fail("timeout", 8000);
		log.finish({ error: true });
		expect(log.$el.querySelectorAll(".ai-log-step.fail").length).toBe(1);
		expect(log.$el.textContent).toContain("timeout");
		expect(textOf(log.$el, ".ai-log-meta")).toBe("8.0 s");
		expect(log.$el.classList.contains("failed")).toBe(true);
	});

	it("etapa sem comando nem saída fica sem chevron (plain)", () => {
		const log = createActivityLog();
		log.addStep("Preparando").done(undefined, 0);
		expect(log.$el.querySelector(".ai-log-step").classList.contains("plain")).toBe(true);
	});

	it("colapsa ao final quando há muitas etapas e ninguém mexeu", () => {
		const log = createActivityLog();
		log.addStep("a").done();
		log.addStep("b").done();
		log.addStep("c").done();
		log.finish();
		expect(log.$el.classList.contains("open")).toBe(false);
	});

	it("permanece aberto se a usuária expandir manualmente", () => {
		const log = createActivityLog({ open: false });
		expect(log.$el.classList.contains("open")).toBe(false);
		log.$el.querySelector(".ai-log-header").onclick();
		expect(log.$el.classList.contains("open")).toBe(true);
		log.addStep("x").done();
		log.addStep("y").done();
		log.addStep("z").done();
		log.finish();
		expect(log.$el.classList.contains("open")).toBe(true);
	});
});
