/**
 * Execution trace do Acodex AI.
 *
 * Formato padronizado de eventos + um barramento (bus) in-process que
 * garante ordenação (`seq`), replay para reconexão do painel, cancelamento
 * e sanitização de segredos. O app roda 100% no WebView (sem servidor
 * próprio), então o "stream" entre agente e painel é este bus; o SSE do
 * modelo continua em `lib/acodexAi/client.js`.
 */

/** Tipos de evento. */
export const TraceType = Object.freeze({
	TASK_START: "task_start",
	PROGRESS: "progress",
	TOOL_CALL: "tool_call",
	TOOL_RESULT: "tool_result",
	ERROR: "error",
	FILE_CHANGE: "file_change",
	TASK_END: "task_end",
});

/** Estados possíveis de uma etapa. */
export const StepStatus = Object.freeze({
	RUNNING: "running",
	DONE: "done",
	FAILED: "failed",
	CANCELLED: "cancelled",
});

/** Estado geral da tarefa. */
export const TaskState = Object.freeze({
	PLANNING: "planning",
	RUNNING: "running",
	WAITING_TOOL: "waiting_tool",
	DONE: "done",
	FAILED: "failed",
	CANCELLED: "cancelled",
});

const TERMINAL_STATES = new Set([
	TaskState.DONE,
	TaskState.FAILED,
	TaskState.CANCELLED,
]);

/** @param {string} state */
export function isTerminalState(state) {
	return TERMINAL_STATES.has(state);
}

const REDACTED = "[REDACTED]";

/** Nomes de chave que nunca devem aparecer no painel. */
const SECRET_KEY_RE =
	/(api[-_]?key|apikey|token|secret|password|passwd|senha|authorization|bearer|cookie|private[-_]?key)/i;

/** Padrões de segredo em texto livre. */
const SECRET_TEXT_PATTERNS = [
	/\bnvapi-[A-Za-z0-9_-]{8,}/g,
	/\bsk-[A-Za-z0-9_-]{16,}/g,
	/\bgh[pousr]_[A-Za-z0-9]{20,}/g,
	/\bgithub_pat_[A-Za-z0-9_]{20,}/g,
	/\bAIza[0-9A-Za-z_-]{20,}/g,
	/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi,
	/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/g,
];

/**
 * Remove segredos de texto livre.
 * @param {string} text
 * @returns {string}
 */
export function redactText(text) {
	let out = String(text);
	for (const re of SECRET_TEXT_PATTERNS) out = out.replace(re, REDACTED);
	return out;
}

/**
 * Cópia profunda com segredos mascarados (por chave e por padrão de texto).
 * Nunca lança: valores circulares/profundos demais viram texto curto.
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {unknown}
 */
export function sanitize(value, depth = 0) {
	if (value === null || value === undefined) return value;
	if (typeof value === "string") return redactText(value);
	if (typeof value !== "object") return value;
	if (depth > 6) return "[…]";
	if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
	const out = {};
	for (const [key, val] of Object.entries(value)) {
		out[key] = SECRET_KEY_RE.test(key) ? REDACTED : sanitize(val, depth + 1);
	}
	return out;
}

let idCounter = 0;
/** @param {string} prefix */
function uid(prefix) {
	idCounter += 1;
	return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

/**
 * @typedef {object} TraceEvent
 * @property {string} task_id
 * @property {string} event_id
 * @property {number} seq Ordem estrita dentro da tarefa (começa em 1)
 * @property {string} type Um de TraceType
 * @property {string} [stage] Id lógico da etapa (liga tool_call ao tool_result)
 * @property {string} [status] Um de StepStatus
 * @property {string} message
 * @property {number} timestamp epoch ms
 * @property {number} [duration_ms]
 * @property {string} [tool_name]
 * @property {string} [file_path]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * Cria o bus de uma tarefa. Os eventos são sanitizados na entrada, recebem
 * `seq` monotônico e ficam guardados (histórico da sessão) para replay.
 * Depois de um evento terminal (task_end) novos eventos são descartados,
 * assim a tarefa nunca "reabre" nem é marcada como concluída duas vezes.
 *
 * @param {{ taskId?: string, now?: () => number, maxEvents?: number }} [options]
 */
export function createTraceBus({
	taskId = uid("task"),
	now = Date.now,
	maxEvents = 500,
} = {}) {
	/** @type {TraceEvent[]} */
	const events = [];
	/** @type {Set<(e: TraceEvent) => void>} */
	const listeners = new Set();
	let seq = 0;
	let closed = false;
	let dropped = 0;

	/**
	 * @param {Omit<TraceEvent, "task_id"|"event_id"|"seq"|"timestamp"> & { timestamp?: number }} partial
	 * @returns {TraceEvent|null} evento publicado ou null se o bus já fechou
	 */
	function emit(partial) {
		if (closed) return null;
		seq += 1;
		/** @type {TraceEvent} */
		const event = {
			task_id: taskId,
			event_id: uid("evt"),
			seq,
			timestamp: now(),
			...partial,
			message: redactText(partial.message ?? ""),
		};
		if (partial.metadata) {
			event.metadata = /** @type {Record<string, unknown>} */ (
				sanitize(partial.metadata)
			);
		}
		if (event.type === TraceType.TASK_END) closed = true;

		events.push(event);
		if (events.length > maxEvents) {
			// mantém sempre o primeiro (task_start) e descarta o mais antigo depois dele
			events.splice(1, 1);
			dropped += 1;
		}
		for (const fn of [...listeners]) {
			try {
				fn(event);
			} catch {
				// um listener quebrado não pode derrubar o agente
			}
		}
		return event;
	}

	/**
	 * Inscreve um listener. Com `fromSeq` reenvia o que ele perdeu (reconexão):
	 * só eventos com seq > fromSeq, em ordem.
	 * @param {(e: TraceEvent) => void} fn
	 * @param {{ fromSeq?: number }} [options]
	 * @returns {() => void} cancela a inscrição
	 */
	function subscribe(fn, { fromSeq = 0 } = {}) {
		for (const event of events) {
			if (event.seq > fromSeq) fn(event);
		}
		listeners.add(fn);
		return () => listeners.delete(fn);
	}

	return {
		taskId,
		emit,
		subscribe,
		get events() {
			return events.slice();
		},
		get lastSeq() {
			return seq;
		},
		get closed() {
			return closed;
		},
		get dropped() {
			return dropped;
		},
	};
}

/**
 * Reduz uma sequência de eventos ao estado atual da tarefa. Função pura:
 * o painel e os testes usam o mesmo cálculo, então a UI nunca mostra
 * "concluído" sem um task_end real.
 *
 * @param {TraceEvent[]} events
 */
export function reduceTrace(events) {
	/** @type {Map<string, any>} */
	const steps = new Map();
	/** @type {{ path: string, action: string, seq: number }[]} */
	const files = [];
	const errors = [];
	let state = TaskState.PLANNING;
	let title = "";
	let startedAt = null;
	let endedAt = null;
	let currentMessage = "";
	let lastSeq = 0;
	/** @type {null|{ status: string, reason?: string }} */
	let end = null;

	const sorted = events.slice().sort((a, b) => a.seq - b.seq);
	for (const e of sorted) {
		if (e.seq === lastSeq) continue; // duplicata (replay)
		lastSeq = e.seq;
		switch (e.type) {
			case TraceType.TASK_START:
				startedAt = e.timestamp;
				title = e.message;
				state = TaskState.PLANNING;
				currentMessage = e.message;
				break;
			case TraceType.PROGRESS: {
				if (isTerminalState(state)) break;
				if (state === TaskState.PLANNING) state = TaskState.RUNNING;
				currentMessage = e.message;
				if (e.stage) {
					const prev = steps.get(e.stage);
					if (prev && prev.status !== StepStatus.RUNNING && !e.status) break;
					steps.set(e.stage, {
						...prev,
						id: e.stage,
						label: e.message,
						status: e.status || prev?.status || StepStatus.RUNNING,
						startedAt: prev?.startedAt ?? e.timestamp,
						endedAt:
							e.status && e.status !== StepStatus.RUNNING
								? e.timestamp
								: prev?.endedAt,
						duration_ms: e.duration_ms ?? prev?.duration_ms,
						kind: prev?.kind || "think",
						metadata: { ...prev?.metadata, ...e.metadata },
					});
				}
				break;
			}
			case TraceType.TOOL_CALL:
				if (isTerminalState(state)) break;
				state = TaskState.WAITING_TOOL;
				currentMessage = e.message;
				steps.set(e.stage || e.event_id, {
					id: e.stage || e.event_id,
					label: e.message,
					status: StepStatus.RUNNING,
					startedAt: e.timestamp,
					tool_name: e.tool_name,
					file_path: e.file_path,
					kind: "tool",
					metadata: e.metadata,
				});
				break;
			case TraceType.TOOL_RESULT: {
				if (isTerminalState(state)) break;
				const prev = steps.get(e.stage || "") || {
					id: e.stage || e.event_id,
					label: e.message,
					startedAt: e.timestamp,
					tool_name: e.tool_name,
					kind: "tool",
				};
				const failed = e.status === StepStatus.FAILED;
				steps.set(prev.id, {
					...prev,
					status: failed ? StepStatus.FAILED : StepStatus.DONE,
					endedAt: e.timestamp,
					duration_ms: e.duration_ms,
					file_path: e.file_path ?? prev.file_path,
					result: e.metadata?.result,
					error: failed ? e.message : undefined,
					metadata: { ...prev.metadata, ...e.metadata },
				});
				if (state === TaskState.WAITING_TOOL) state = TaskState.RUNNING;
				currentMessage = failed ? e.message : currentMessage;
				break;
			}
			case TraceType.FILE_CHANGE:
				files.push({
					path: e.file_path || "(sem nome)",
					action: String(e.metadata?.action || "modified"),
					seq: e.seq,
				});
				break;
			case TraceType.ERROR: {
				errors.push({ seq: e.seq, message: e.message, stage: e.stage });
				if (e.stage && steps.has(e.stage)) {
					const prev = steps.get(e.stage);
					steps.set(e.stage, {
						...prev,
						status: StepStatus.FAILED,
						error: e.message,
						endedAt: e.timestamp,
					});
				}
				break;
			}
			case TraceType.TASK_END: {
				const status = e.status || StepStatus.DONE;
				state =
					status === StepStatus.CANCELLED
						? TaskState.CANCELLED
						: status === StepStatus.FAILED
							? TaskState.FAILED
							: TaskState.DONE;
				endedAt = e.timestamp;
				end = { status: state, reason: e.message };
				currentMessage = e.message || currentMessage;
				// etapa ainda "rodando" quando a tarefa acaba não pode ficar rodando
				for (const [id, step] of steps) {
					if (step.status === StepStatus.RUNNING) {
						steps.set(id, {
							...step,
							status:
								state === TaskState.CANCELLED
									? StepStatus.CANCELLED
									: StepStatus.FAILED,
							endedAt: e.timestamp,
							error:
								state === TaskState.CANCELLED
									? undefined
									: "Interrompida antes de terminar",
						});
					}
				}
				break;
			}
			default:
				break;
		}
	}

	const list = [...steps.values()];
	return {
		state,
		title,
		currentMessage,
		startedAt,
		endedAt,
		lastSeq,
		end,
		steps: list,
		files,
		errors,
		counts: {
			done: list.filter((s) => s.status === StepStatus.DONE).length,
			running: list.filter((s) => s.status === StepStatus.RUNNING).length,
			failed: list.filter((s) => s.status === StepStatus.FAILED).length,
			cancelled: list.filter((s) => s.status === StepStatus.CANCELLED).length,
		},
	};
}

/**
 * Conecta os eventos reais de `runAgent` ao bus. Cada evento do agente vira
 * um evento tipado; nada é simulado. Devolve funções de ciclo de vida.
 *
 * @param {ReturnType<typeof createTraceBus>} bus
 * @param {{ labels?: Record<string, string>, fileTools?: Record<string,string> }} [options]
 */
export function createAgentTracer(bus, { labels = {}, fileTools = {} } = {}) {
	/** @type {Map<string, { startedAt: number, stage: string, name: string, args: any }>} */
	const open = new Map();
	let modelStep = 0;
	let currentModelStage = null;
	let modelStartedAt = 0;

	function label(name) {
		return labels[name] || name;
	}

	function start(message) {
		return bus.emit({ type: TraceType.TASK_START, message });
	}

	function progress(stage, message, status, extra = {}) {
		return bus.emit({
			type: TraceType.PROGRESS,
			stage,
			message,
			status,
			...extra,
		});
	}

	/** Abre a etapa "consultando o modelo" (uma por rodada do agente). */
	function beginModel(message = "Consultando o modelo") {
		endModel();
		modelStep += 1;
		currentModelStage = `model-${modelStep}`;
		modelStartedAt = Date.now();
		progress(currentModelStage, message, StepStatus.RUNNING, {
			metadata: { kind: "model" },
		});
	}

	function endModel(status = StepStatus.DONE) {
		if (!currentModelStage) return;
		const text =
			status === StepStatus.DONE
				? "Resposta do modelo recebida"
				: status === StepStatus.CANCELLED
					? "Consulta ao modelo cancelada"
					: "Consulta ao modelo falhou";
		progress(currentModelStage, text, status, {
			duration_ms: Date.now() - modelStartedAt,
		});
		currentModelStage = null;
	}

	/** @param {any} event evento de `runAgent` */
	function handleAgentEvent(event) {
		if (event.type === "assistant-delta") {
			if (currentModelStage) {
				// primeira palavra chegou: o modelo está respondendo
				progress(currentModelStage, "Escrevendo resposta", StepStatus.RUNNING);
			}
		} else if (event.type === "tool-start") {
			endModel();
			const stage = `tool-${event.id}`;
			open.set(event.id, {
				startedAt: Date.now(),
				stage,
				name: event.name,
				args: event.args,
			});
			bus.emit({
				type: TraceType.TOOL_CALL,
				stage,
				status: StepStatus.RUNNING,
				message: label(event.name),
				tool_name: event.name,
				file_path: pickPath(event.args),
				metadata: { command: { tool: event.name, args: event.args } },
			});
		} else if (event.type === "tool") {
			const call = open.get(event.id);
			open.delete(event.id);
			const failed = Boolean(event.result?.error);
			const stage = call?.stage || `tool-${event.id}`;
			const path = pickPath(event.args) || pickPath(event.result);
			bus.emit({
				type: TraceType.TOOL_RESULT,
				stage,
				status: failed ? StepStatus.FAILED : StepStatus.DONE,
				message: failed
					? String(event.result.error)
					: `${label(event.name)} concluído`,
				tool_name: event.name,
				file_path: path,
				duration_ms: event.ms,
				metadata: { result: event.result },
			});
			if (!failed && fileTools[event.name]) {
				bus.emit({
					type: TraceType.FILE_CHANGE,
					message: `${label(event.name)}`,
					file_path: path,
					tool_name: event.name,
					metadata: { action: fileTools[event.name] },
				});
			}
		} else if (event.type === "assistant") {
			endModel();
		}
	}

	/**
	 * Encerra a tarefa. `reason` explica falhas/cancelamentos. Etapas ainda
	 * abertas são fechadas pelo reducer, nunca ficam como "concluídas".
	 * @param {"done"|"failed"|"cancelled"} status
	 * @param {string} [reason]
	 */
	function end(status, reason = "") {
		if (bus.closed) return null;
		if (status === "cancelled") endModel(StepStatus.CANCELLED);
		else if (status === "failed") endModel(StepStatus.FAILED);
		else endModel();
		if (status === "failed" && reason) {
			bus.emit({
				type: TraceType.ERROR,
				stage: currentModelStage || undefined,
				status: StepStatus.FAILED,
				message: reason,
			});
		}
		const text =
			status === "done"
				? "Tarefa concluída"
				: status === "cancelled"
					? "Tarefa cancelada pelo usuário"
					: reason || "Tarefa falhou";
		return bus.emit({ type: TraceType.TASK_END, status, message: text });
	}

	return { start, beginModel, endModel, handleAgentEvent, end, progress };
}

/**
 * Extrai um caminho de arquivo de args/resultado de uma ferramenta.
 * @param {any} obj
 * @returns {string|undefined}
 */
export function pickPath(obj) {
	if (!obj || typeof obj !== "object") return undefined;
	for (const key of ["path", "file_path", "filename", "name", "uri"]) {
		if (typeof obj[key] === "string" && obj[key]) return obj[key];
	}
	return undefined;
}
