// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { transformSync } from "@babel/core";
import { describe, expect, it, vi } from "vitest";
import * as trace from "../../src/sidebarApps/aiChat/traceEvents.js";

const requireFromRoot = createRequire(path.resolve("package.json"));
requireFromRoot("html-tag-js/polyfill");
const tag = requireFromRoot("html-tag-js");

function transform(file) {
	const filename = path.resolve(file);
	return transformSync(readFileSync(filename, "utf8"), {
		filename,
		babelrc: false,
		configFile: false,
		presets: [
			[
				"@babel/preset-env",
				{ targets: { node: "current" }, modules: "commonjs" },
			],
		],
		plugins: [
			"html-tag-js/jsx/syntax-parser.js",
			"html-tag-js/jsx/jsx-to-tag.js",
		],
	}).code;
}

function load() {
	const activityLogExports = {};
	vm.runInNewContext(transform("src/sidebarApps/aiChat/activityLog.js"), {
		module: { exports: activityLogExports },
		exports: activityLogExports,
		tag,
		document,
		navigator,
	});

	const out = {};
	const sandbox = {
		module: { exports: out },
		exports: out,
		tag,
		document,
		navigator,
		Date,
		setInterval,
		clearInterval,
		require(spec) {
			if (spec === "./traceEvents") return trace;
			if (spec === "./activityLog") return activityLogExports;
			throw new Error(`import inesperado: ${spec}`);
		},
	};
	vm.runInNewContext(transform("src/sidebarApps/aiChat/agentActivity.js"), sandbox);
	return out;
}

const { createAgentActivity, formatDuration } = load();

function make(options) {
	const bus = trace.createTraceBus({ taskId: "t" });
	const tracer = trace.createAgentTracer(bus, {
		labels: { replace_active_file: "Editando arquivo", get_active_file: "Lendo" },
		fileTools: { replace_active_file: "modified" },
	});
	const panel = createAgentActivity(bus, options);
	return { bus, tracer, panel };
}

const q = (el, sel) => el.querySelector(sel);
const qa = (el, sel) => [...el.querySelectorAll(sel)];

describe("formatDuration", () => {
	it("formata ms, s e min", () => {
		expect(formatDuration(42)).toBe("42 ms");
		expect(formatDuration(1500)).toBe("1.5 s");
		expect(formatDuration(65000)).toBe("1m 5s");
		expect(formatDuration(undefined)).toBe("");
	});
});

describe("painel Atividade do agente", () => {
	it("começa em planejamento, com título e sem nada concluído", () => {
		const { tracer, panel } = make();
		tracer.start("fazer algo");
		expect(q(panel.$el, ".aa-title").textContent).toBe("Atividade do agente");
		expect(panel.$el.dataset.state).toBe("planning");
		expect(panel.$el.classList.contains("finished")).toBe(false);
		panel.destroy();
	});

	it("mostra etapa em andamento e contadores reais", () => {
		const { tracer, panel } = make();
		tracer.start("editar");
		tracer.handleAgentEvent({
			type: "tool-start",
			id: "c1",
			name: "get_active_file",
			args: {},
		});
		tracer.handleAgentEvent({
			type: "tool",
			id: "c1",
			name: "get_active_file",
			args: {},
			ms: 9,
			result: { content: "x" },
		});
		tracer.handleAgentEvent({
			type: "tool-start",
			id: "c2",
			name: "replace_active_file",
			args: { path: "a.js" },
		});
		expect(panel.$el.dataset.state).toBe("waiting_tool");
		const chips = qa(panel.$el, ".aa-chip").map((c) => c.textContent);
		expect(chips).toContain("1 concluídas");
		expect(chips).toContain("1 em andamento");
		expect(qa(panel.$el, ".aa-step.running")).toHaveLength(1);
		panel.destroy();
	});

	it("tarefa concluída: estado done, sem spinner, arquivo listado", () => {
		const { tracer, panel } = make();
		tracer.start("editar");
		tracer.handleAgentEvent({
			type: "tool-start",
			id: "c1",
			name: "replace_active_file",
			args: { path: "src/a.js" },
		});
		tracer.handleAgentEvent({
			type: "tool",
			id: "c1",
			name: "replace_active_file",
			args: { path: "src/a.js" },
			ms: 30,
			result: { ok: true },
		});
		tracer.end("done");
		expect(panel.$el.dataset.state).toBe("done");
		expect(q(panel.$el, ".aa-spinner").hidden).toBe(true);
		expect(q(panel.$el, ".aa-files").hidden).toBe(false);
		expect(q(panel.$el, ".aa-file-path").textContent).toBe("src/a.js");
		expect(q(panel.$el, ".aa-tag").textContent.trim()).toBe("modificado");
		panel.destroy();
	});

	it("falha: marca etapa, mostra erro técnico e oferece nova tentativa", () => {
		const onRetry = vi.fn();
		const { tracer, panel } = make({ onRetry });
		tracer.start("editar");
		tracer.handleAgentEvent({
			type: "tool-start",
			id: "c1",
			name: "replace_active_file",
			args: { path: "a.js" },
		});
		tracer.handleAgentEvent({
			type: "tool",
			id: "c1",
			name: "replace_active_file",
			args: { path: "a.js" },
			ms: 5,
			result: { error: "arquivo somente leitura" },
		});
		tracer.end("failed", "O agente não conseguiu editar");
		expect(panel.$el.dataset.state).toBe("failed");
		expect(qa(panel.$el, ".aa-step.failed")).toHaveLength(1);

		// abrir detalhes da etapa mostra o erro real
		q(panel.$el, ".aa-row").onclick();
		expect(q(panel.$el, ".aa-block.error .aa-code").textContent).toContain(
			"somente leitura",
		);

		const retry = q(panel.$el, ".aa-btn.primary");
		expect(retry.textContent).toContain("Tentar novamente");
		retry.onclick();
		expect(onRetry).toHaveBeenCalledTimes(1);
		panel.destroy();
	});

	it("cancelar durante a execução chama onCancel e termina como cancelado", () => {
		const onCancel = vi.fn();
		const { tracer, panel } = make({ onCancel });
		tracer.start("t");
		tracer.beginModel();
		const btn = q(panel.$el, ".aa-btn");
		expect(btn.textContent).toContain("Cancelar");
		btn.onclick();
		expect(onCancel).toHaveBeenCalledTimes(1);

		tracer.end("cancelled");
		expect(panel.$el.dataset.state).toBe("cancelled");
		expect(qa(panel.$el, ".aa-step.cancelled")).toHaveLength(1);
		expect(qa(panel.$el, ".aa-step.done")).toHaveLength(0);
		// sem botão de retry/cancelar quando cancelado
		expect(q(panel.$el, ".aa-actions").hidden).toBe(true);
		panel.destroy();
	});

	it("nunca vaza segredos no HTML renderizado", () => {
		const { tracer, panel } = make();
		tracer.start("usar nvapi-SEGREDOSEGREDO1234 aqui");
		tracer.handleAgentEvent({
			type: "tool-start",
			id: "c1",
			name: "replace_active_file",
			args: { path: "a.js", apiKey: "sk-ABCDEFGHIJKLMNOPQRSTUV" },
		});
		q(panel.$el, ".aa-row").onclick();
		const html = panel.$el.innerHTML;
		expect(html).not.toContain("SEGREDOSEGREDO1234");
		expect(html).not.toContain("ABCDEFGHIJKLMNOPQRSTUV");
		expect(html).toContain("[REDACTED]");
		panel.destroy();
	});

	it("reconexão: um painel novo reconstrói a timeline inteira do bus", () => {
		const { bus, tracer, panel } = make();
		tracer.start("t");
		tracer.handleAgentEvent({
			type: "tool-start",
			id: "c1",
			name: "get_active_file",
			args: {},
		});
		tracer.handleAgentEvent({
			type: "tool",
			id: "c1",
			name: "get_active_file",
			args: {},
			ms: 2,
			result: {},
		});
		panel.destroy();

		const again = createAgentActivity(bus);
		expect(qa(again.$el, ".aa-step.done")).toHaveLength(1);
		tracer.end("done");
		expect(again.$el.dataset.state).toBe("done");
		again.destroy();
	});

	it("run_command aparece num bloco de terminal real", () => {
		const { tracer, panel } = make();
		tracer.start("rodar");
		tracer.handleAgentEvent({
			type: "tool-start",
			id: "c1",
			name: "run_command",
			args: { command: "npm test" },
		});
		expect(q(panel.$el, ".aa-term").hidden).toBe(false);
		expect(q(panel.$el, ".aa-live").textContent.trim()).toBe("Live");
		tracer.handleAgentEvent({
			type: "tool",
			id: "c1",
			name: "run_command",
			args: { command: "npm test" },
			ms: 1200,
			result: { ok: true },
		});
		expect(q(panel.$el, ".aa-live").textContent.trim()).toBe("fim");
		expect(q(panel.$el, ".aa-term .aa-code").textContent).toContain("npm test");
		panel.destroy();
	});

	it("não mostra terminal nem arquivos quando nada disso aconteceu", () => {
		const { tracer, panel } = make();
		tracer.start("só conversa");
		tracer.beginModel();
		tracer.end("done");
		expect(q(panel.$el, ".aa-term").hidden).toBe(true);
		expect(q(panel.$el, ".aa-files").hidden).toBe(true);
		panel.destroy();
	});
});
