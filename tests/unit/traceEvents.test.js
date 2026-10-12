import { describe, expect, it, vi } from "vitest";
import {
	createAgentTracer,
	createTraceBus,
	pickPath,
	reduceTrace,
	redactText,
	sanitize,
	StepStatus,
	TaskState,
	TraceType,
} from "../../src/sidebarApps/aiChat/traceEvents.js";

const LABELS = {
	get_active_file: "Lendo arquivo ativo",
	replace_active_file: "Editando arquivo",
};
const FILE_TOOLS = { replace_active_file: "modified", create_file: "created" };

function setup() {
	const bus = createTraceBus({ taskId: "t1" });
	const tracer = createAgentTracer(bus, {
		labels: LABELS,
		fileTools: FILE_TOOLS,
	});
	return { bus, tracer };
}

describe("formato dos eventos", () => {
	it("preenche task_id, event_id, seq, timestamp e message", () => {
		const bus = createTraceBus({ taskId: "abc", now: () => 123 });
		const e = bus.emit({ type: TraceType.TASK_START, message: "oi" });
		expect(e).toMatchObject({
			task_id: "abc",
			seq: 1,
			timestamp: 123,
			type: "task_start",
			message: "oi",
		});
		expect(e.event_id).toMatch(/^evt_/);
	});

	it("gera event_id único e seq estritamente crescente", () => {
		const bus = createTraceBus();
		const a = bus.emit({ type: TraceType.PROGRESS, message: "a" });
		const b = bus.emit({ type: TraceType.PROGRESS, message: "b" });
		expect(b.seq).toBe(a.seq + 1);
		expect(a.event_id).not.toBe(b.event_id);
	});
});

describe("segredos", () => {
	it("mascara chaves e tokens em texto livre", () => {
		expect(redactText("use nvapi-ABCDEFGH12345678 agora")).not.toContain(
			"ABCDEFGH12345678",
		);
		expect(redactText("Bearer abcdefghijklmnop1234")).toContain("[REDACTED]");
		expect(redactText("ghp_abcdefghijklmnopqrstuvwxyz1234")).toBe("[REDACTED]");
	});

	it("mascara por nome de chave em objetos aninhados", () => {
		const out = sanitize({
			args: { apiKey: "x", nested: { Authorization: "y", ok: 1 } },
		});
		expect(out.args.apiKey).toBe("[REDACTED]");
		expect(out.args.nested.Authorization).toBe("[REDACTED]");
		expect(out.args.nested.ok).toBe(1);
	});

	it("sanitiza metadata e message na emissão do bus", () => {
		const bus = createTraceBus();
		const e = bus.emit({
			type: TraceType.TOOL_CALL,
			message: "chave nvapi-ZZZZZZZZZZZZ1234",
			metadata: { command: { token: "segredo", path: "a.js" } },
		});
		expect(JSON.stringify(e)).not.toContain("ZZZZZZZZZZZZ1234");
		expect(JSON.stringify(e)).not.toContain("segredo");
		expect(e.metadata.command.path).toBe("a.js");
	});

	it("não quebra com objeto muito profundo", () => {
		let deep = {};
		const root = deep;
		for (let i = 0; i < 30; i++) deep = deep.n = {};
		expect(() => sanitize(root)).not.toThrow();
	});
});

describe("ordenação e eventos repetidos", () => {
	it("reduceTrace ordena por seq mesmo com eventos embaralhados", () => {
		const bus = createTraceBus({ taskId: "t" });
		bus.emit({ type: TraceType.TASK_START, message: "x" });
		bus.emit({
			type: TraceType.TOOL_CALL,
			stage: "s1",
			message: "Lendo",
			tool_name: "get_active_file",
		});
		bus.emit({
			type: TraceType.TOOL_RESULT,
			stage: "s1",
			status: StepStatus.DONE,
			message: "ok",
			duration_ms: 5,
		});
		const shuffled = bus.events.reverse();
		const view = reduceTrace(shuffled);
		expect(view.steps[0].status).toBe(StepStatus.DONE);
		expect(view.lastSeq).toBe(3);
	});

	it("ignora eventos duplicados (replay) sem contar etapas duas vezes", () => {
		const { bus, tracer } = setup();
		tracer.start("fazer algo");
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
			ms: 3,
			result: { content: "x" },
		});
		const doubled = [...bus.events, ...bus.events];
		const view = reduceTrace(doubled);
		expect(view.steps).toHaveLength(1);
		expect(view.counts.done).toBe(1);
	});
});

describe("reconexão (replay)", () => {
	it("entrega só o que o listener perdeu, em ordem", () => {
		const { bus, tracer } = setup();
		tracer.start("tarefa");
		tracer.beginModel();
		tracer.endModel();
		const seen = [];
		const unsub = bus.subscribe((e) => seen.push(e.seq));
		expect(seen).toEqual([1, 2, 3]);
		unsub();

		// painel "caiu" depois do seq 3 e reconecta
		tracer.beginModel();
		const caught = [];
		bus.subscribe((e) => caught.push(e.seq), { fromSeq: 3 });
		expect(caught).toEqual([4]);
	});

	it("reconectado continua recebendo eventos novos ao vivo", () => {
		const { bus, tracer } = setup();
		tracer.start("t");
		const got = [];
		bus.subscribe((e) => got.push(e.type), { fromSeq: bus.lastSeq });
		tracer.end("done");
		expect(got).toEqual([TraceType.TASK_END]);
	});

	it("unsubscribe para de entregar", () => {
		const { bus, tracer } = setup();
		const fn = vi.fn();
		const off = bus.subscribe(fn);
		tracer.start("t");
		off();
		tracer.beginModel();
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("um listener que lança não derruba o agente nem os outros", () => {
		const { bus, tracer } = setup();
		const good = vi.fn();
		bus.subscribe(() => {
			throw new Error("boom");
		});
		bus.subscribe(good);
		expect(() => tracer.start("t")).not.toThrow();
		expect(good).toHaveBeenCalledTimes(1);
	});
});

describe("fluxo real de ferramenta", () => {
	it("tool-start -> tool vira tool_call/tool_result com duração real", () => {
		const { bus, tracer } = setup();
		tracer.start("editar");
		tracer.handleAgentEvent({
			type: "tool-start",
			id: "c1",
			name: "replace_active_file",
			args: { path: "src/a.js", content: "x" },
		});
		let view = reduceTrace(bus.events);
		expect(view.state).toBe(TaskState.WAITING_TOOL);
		expect(view.counts.running).toBe(1);

		tracer.handleAgentEvent({
			type: "tool",
			id: "c1",
			name: "replace_active_file",
			args: { path: "src/a.js" },
			ms: 87,
			result: { ok: true },
		});
		view = reduceTrace(bus.events);
		expect(view.state).toBe(TaskState.RUNNING);
		expect(view.steps[0]).toMatchObject({
			status: StepStatus.DONE,
			duration_ms: 87,
			tool_name: "replace_active_file",
			file_path: "src/a.js",
		});
		expect(view.files).toEqual([
			expect.objectContaining({ path: "src/a.js", action: "modified" }),
		]);
	});

	it("ferramenta que só lê não gera file_change", () => {
		const { bus, tracer } = setup();
		tracer.start("ler");
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
			ms: 1,
			result: { content: "x" },
		});
		expect(reduceTrace(bus.events).files).toHaveLength(0);
	});

	it("duas ferramentas em paralelo não se misturam", () => {
		const { bus, tracer } = setup();
		tracer.start("t");
		for (const id of ["a", "b"]) {
			tracer.handleAgentEvent({
				type: "tool-start",
				id,
				name: "get_active_file",
				args: {},
			});
		}
		tracer.handleAgentEvent({
			type: "tool",
			id: "b",
			name: "get_active_file",
			args: {},
			ms: 2,
			result: {},
		});
		const view = reduceTrace(bus.events);
		expect(view.counts).toMatchObject({ done: 1, running: 1 });
	});
});

describe("erros", () => {
	it("resultado com error marca a etapa como falha e guarda o erro", () => {
		const { bus, tracer } = setup();
		tracer.start("t");
		tracer.handleAgentEvent({
			type: "tool-start",
			id: "c1",
			name: "replace_active_file",
			args: {},
		});
		tracer.handleAgentEvent({
			type: "tool",
			id: "c1",
			name: "replace_active_file",
			args: {},
			ms: 4,
			result: { error: "arquivo somente leitura" },
		});
		const view = reduceTrace(bus.events);
		expect(view.steps[0].status).toBe(StepStatus.FAILED);
		expect(view.steps[0].error).toBe("arquivo somente leitura");
		expect(view.counts.failed).toBe(1);
		expect(view.files).toHaveLength(0); // falhou, não alterou arquivo
	});

	it("falha de rede encerra a tarefa como falha com o motivo", () => {
		const { bus, tracer } = setup();
		tracer.start("t");
		tracer.beginModel();
		tracer.end("failed", "HTTP 429: limite atingido");
		const view = reduceTrace(bus.events);
		expect(view.state).toBe(TaskState.FAILED);
		expect(view.errors[0].message).toContain("429");
		expect(view.steps[0].status).toBe(StepStatus.FAILED);
	});

	it("falha de ferramenta NÃO marca a tarefa como concluída sozinha", () => {
		const { bus, tracer } = setup();
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
			ms: 1,
			result: { error: "x" },
		});
		expect(reduceTrace(bus.events).state).not.toBe(TaskState.DONE);
	});
});

describe("cancelamento", () => {
	it("cancelar fecha etapas abertas como canceladas, não concluídas", () => {
		const { bus, tracer } = setup();
		tracer.start("t");
		tracer.handleAgentEvent({
			type: "tool-start",
			id: "c1",
			name: "replace_active_file",
			args: {},
		});
		tracer.end("cancelled");
		const view = reduceTrace(bus.events);
		expect(view.state).toBe(TaskState.CANCELLED);
		expect(view.steps[0].status).toBe(StepStatus.CANCELLED);
		expect(view.counts.running).toBe(0);
		expect(view.counts.done).toBe(0);
	});

	it("depois de encerrada, a tarefa ignora novos eventos", () => {
		const { bus, tracer } = setup();
		tracer.start("t");
		tracer.end("cancelled");
		const before = bus.events.length;
		expect(
			tracer.handleAgentEvent({
				type: "tool-start",
				id: "late",
				name: "get_active_file",
				args: {},
			}),
		).toBeUndefined();
		expect(bus.events.length).toBe(before);
		expect(bus.closed).toBe(true);
	});

	it("end() duas vezes só publica um task_end", () => {
		const { bus, tracer } = setup();
		tracer.start("t");
		tracer.end("done");
		tracer.end("failed", "tarde demais");
		const ends = bus.events.filter((e) => e.type === TraceType.TASK_END);
		expect(ends).toHaveLength(1);
		expect(reduceTrace(bus.events).state).toBe(TaskState.DONE);
	});
});

describe("conclusão", () => {
	it("só vira concluída com task_end real", () => {
		const { bus, tracer } = setup();
		tracer.start("t");
		tracer.beginModel();
		tracer.handleAgentEvent({ type: "assistant-delta", text: "oi" });
		expect(reduceTrace(bus.events).state).not.toBe(TaskState.DONE);
		tracer.handleAgentEvent({ type: "assistant", content: "oi" });
		expect(reduceTrace(bus.events).state).not.toBe(TaskState.DONE);
		tracer.end("done");
		const view = reduceTrace(bus.events);
		expect(view.state).toBe(TaskState.DONE);
		expect(view.end.status).toBe(TaskState.DONE);
	});

	it("tarefa sem nenhum evento fica em planejamento, nunca concluída", () => {
		expect(reduceTrace([]).state).toBe(TaskState.PLANNING);
	});

	it("etapa do modelo passa de running para done com duração", () => {
		const { bus, tracer } = setup();
		tracer.start("t");
		tracer.beginModel();
		expect(reduceTrace(bus.events).counts.running).toBe(1);
		tracer.handleAgentEvent({ type: "assistant", content: "ok" });
		const view = reduceTrace(bus.events);
		expect(view.counts.running).toBe(0);
		expect(view.counts.done).toBe(1);
		expect(typeof view.steps[0].duration_ms).toBe("number");
	});
});

describe("limite de memória", () => {
	it("descarta os eventos mais antigos mas preserva o task_start", () => {
		const bus = createTraceBus({ maxEvents: 5 });
		bus.emit({ type: TraceType.TASK_START, message: "inicio" });
		for (let i = 0; i < 20; i++) {
			bus.emit({ type: TraceType.PROGRESS, message: `p${i}` });
		}
		expect(bus.events.length).toBeLessThanOrEqual(5);
		expect(bus.events[0].type).toBe(TraceType.TASK_START);
		expect(bus.dropped).toBeGreaterThan(0);
	});
});

describe("pickPath", () => {
	it("acha caminho em vários formatos e ignora lixo", () => {
		expect(pickPath({ path: "a.js" })).toBe("a.js");
		expect(pickPath({ filename: "b.js" })).toBe("b.js");
		expect(pickPath(null)).toBeUndefined();
		expect(pickPath({ path: 5 })).toBeUndefined();
	});
});
