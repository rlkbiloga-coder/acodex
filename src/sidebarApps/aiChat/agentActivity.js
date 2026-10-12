/**
 * Painel "Atividade do agente".
 *
 * Renderiza, a partir de eventos reais do bus (`traceEvents.js`):
 * estado geral, contadores, timeline cronológica, detalhes técnicos
 * expansíveis, arquivos alterados e saída de terminal. Tudo é derivado de
 * `reduceTrace`, então a UI nunca mostra algo como concluído sem evento real.
 */

import { formatPayload } from "./activityLog";
import {
	isTerminalState,
	reduceTrace,
	StepStatus,
	TaskState,
} from "./traceEvents";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Caminhos SVG (viewBox 24, traço). Sem emoji. */
const ICONS = {
	check: "M5 12.5l4.5 4.5L19 7.5",
	fail: "M6 6l12 12M18 6L6 18",
	stop: "M7 7h10v10H7z",
	gear: "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM19 12l2-1-2-3.5-2.2.6a7 7 0 00-1.6-.9L14.7 5h-4l-.5 2.2a7 7 0 00-1.6.9L6.4 7.5 4.4 11l2 1a7 7 0 000 1.8l-2 1 2 3.5 2.2-.6a7 7 0 001.6.9l.5 2.2h4l.5-2.2a7 7 0 001.6-.9l2.2.6 2-3.5-2-1c.1-.6.1-1.2 0-1.8z",
	tool: "M8 6l-6 6 6 6M16 6l6 6-6 6",
	file: "M6 3h8l4 4v14H6zM14 3v4h4",
	term: "M4 5h16v14H4zM7.5 9.5l3 2.5-3 2.5M12.5 15h4",
	chev: "M9 6l6 6-6 6",
	copy: "M9 9h10v12H9zM5 15V3h10",
	retry: "M20 12a8 8 0 11-2.6-5.9M20 4v4h-4",
	think:
		"M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5L6.8 15M17.2 9l2.6-1.5M12 8a4 4 0 100 8 4 4 0 000-8z",
};

/** @param {keyof typeof ICONS} name @param {number} [size] */
function icon(name, size = 14) {
	const svg = document.createElementNS(SVG_NS, "svg");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("width", String(size));
	svg.setAttribute("height", String(size));
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("stroke-width", "2");
	svg.setAttribute("stroke-linecap", "round");
	svg.setAttribute("stroke-linejoin", "round");
	svg.setAttribute("aria-hidden", "true");
	const path = document.createElementNS(SVG_NS, "path");
	path.setAttribute("d", ICONS[name] || ICONS.tool);
	svg.append(path);
	return svg;
}

const STATE_LABEL = {
	[TaskState.PLANNING]: "Planejando",
	[TaskState.RUNNING]: "Executando",
	[TaskState.WAITING_TOOL]: "Aguardando ferramenta",
	[TaskState.DONE]: "Concluído",
	[TaskState.FAILED]: "Falhou",
	[TaskState.CANCELLED]: "Cancelado",
};

/** @param {number|undefined} ms */
export function formatDuration(ms) {
	if (typeof ms !== "number" || Number.isNaN(ms)) return "";
	if (ms < 1000) return `${Math.round(ms)} ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
	const m = Math.floor(ms / 60000);
	const s = Math.round((ms % 60000) / 1000);
	return `${m}m ${s}s`;
}

/** @param {number|null|undefined} ts */
export function formatClock(ts) {
	if (!ts) return "";
	const d = new Date(ts);
	const p = (n) => String(n).padStart(2, "0");
	return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Ferramentas cujo comando deve aparecer num bloco de terminal. */
const TERMINAL_TOOLS = new Set(["run_command"]);

/**
 * Cria o painel de um turno do agente.
 *
 * @param {ReturnType<typeof import("./traceEvents").createTraceBus>} bus
 * @param {{ open?: boolean, onRetry?: () => void, onCancel?: () => void }} [options]
 */
export function createAgentActivity(
	bus,
	{ open = true, onRetry, onCancel } = {},
) {
	let userToggled = false;
	/** @type {Set<string>} ids de etapas expandidas pelo usuário (sobrevive a re-render) */
	const expanded = new Set();
	let detailsOpen = false;
	let rafId = 0;
	let tick = 0;

	const $title = <div className="aa-title">Atividade do agente</div>;
	const $state = <span className="aa-state" />;
	const $counts = <div className="aa-counts" aria-hidden="true" />;
	const $now = <div className="aa-now" aria-live="polite" />;
	const $steps = <ol className="aa-steps" />;
	const $files = <div className="aa-files" hidden />;
	const $term = <div className="aa-term" hidden />;
	const $actions = <div className="aa-actions" hidden />;
	const $spinner = <span className="aa-spinner" aria-hidden="true" />;
	const $chev = <span className="aa-chev">{icon("chev", 16)}</span>;

	const $header = (
		<button
			type="button"
			className="aa-header"
			aria-expanded={String(open)}
			onclick={() => {
				userToggled = true;
				toggle();
			}}
		>
			<span className="aa-badge">{icon("gear", 18)}</span>
			<span className="aa-head-text">
				{$title}
				{$now}
			</span>
			{$counts}
			{$spinner}
			{$chev}
		</button>
	);

	const $el = (
		<section
			className={`aa${open ? " open" : ""}`}
			role="region"
			aria-label="Atividade do agente"
			data-state={TaskState.PLANNING}
		>
			{$header}
			<div className="aa-body">
				{$steps}
				{$files}
				{$term}
				{$actions}
			</div>
		</section>
	);

	function toggle() {
		$el.classList.toggle("open");
		$header.setAttribute(
			"aria-expanded",
			String($el.classList.contains("open")),
		);
	}

	function chip(kind, text) {
		return <span className={`aa-chip ${kind}`}>{text}</span>;
	}

	/** Bloco de código/terminal com botão de copiar. */
	function codeBlock(title, text, kind = "code") {
		const $copy = (
			<button
				type="button"
				className="aa-copy"
				aria-label={`Copiar ${title.toLowerCase()}`}
				onclick={async (e) => {
					e.stopPropagation();
					try {
						await navigator.clipboard?.writeText(text);
					} catch {
						// clipboard indisponível
					}
				}}
			>
				{icon("copy", 13)}
			</button>
		);
		return (
			<div className={`aa-block ${kind}`}>
				<div className="aa-block-title">{title}</div>
				<div className="aa-code-wrap">
					<pre className="aa-code">{text}</pre>
					{$copy}
				</div>
			</div>
		);
	}

	/** Detalhes técnicos de uma etapa (só o que realmente existe). */
	function stepDetails(step) {
		const $d = <div className="aa-details" />;
		const rows = [];
		if (step.tool_name) rows.push(["Ferramenta", step.tool_name]);
		if (step.file_path) rows.push(["Arquivo", step.file_path]);
		if (step.startedAt) rows.push(["Início", formatClock(step.startedAt)]);
		if (step.duration_ms !== undefined)
			rows.push(["Duração", formatDuration(step.duration_ms)]);
		for (const [k, v] of rows) {
			$d.append(
				<div className="aa-kv">
					<span className="aa-k">{k}</span>
					<span className="aa-v">{v}</span>
				</div>,
			);
		}
		const command = step.metadata?.command;
		if (command) {
			const text = formatPayload(command);
			const isTerm = TERMINAL_TOOLS.has(step.tool_name);
			$d.append(
				codeBlock(
					isTerm ? "Terminal" : "Comando",
					text,
					isTerm ? "term" : "code",
				),
			);
		}
		if (step.result !== undefined && !step.error) {
			const out = formatPayload(step.result);
			if (out) $d.append(codeBlock("Resultado", out));
		}
		if (step.error) {
			$d.append(codeBlock("Erro", formatPayload(step.error), "error"));
		}
		return $d;
	}

	function statusIcon(status) {
		if (status === StepStatus.DONE) return icon("check", 13);
		if (status === StepStatus.FAILED) return icon("fail", 13);
		if (status === StepStatus.CANCELLED) return icon("stop", 11);
		return <span className="aa-dot" />;
	}

	function renderStep(step) {
		const isOpen = expanded.has(step.id);
		const hasDetails = Boolean(
			step.tool_name ||
				step.file_path ||
				step.error ||
				step.result !== undefined ||
				step.metadata?.command,
		);
		const meta = [];
		if (step.status === StepStatus.RUNNING) {
			meta.push(formatDuration(Date.now() - step.startedAt));
		} else if (step.duration_ms !== undefined) {
			meta.push(formatDuration(step.duration_ms));
		}
		const $row = (
			<button
				type="button"
				className="aa-row"
				aria-expanded={String(isOpen)}
				disabled={!hasDetails}
				onclick={() => {
					if (expanded.has(step.id)) expanded.delete(step.id);
					else expanded.add(step.id);
					render();
				}}
			>
				<span className={`aa-status ${step.status}`}>
					{statusIcon(step.status)}
				</span>
				<span className="aa-label">
					<span className="aa-label-main">{step.label}</span>
					{step.file_path ? (
						<span className="aa-label-sub">{step.file_path}</span>
					) : null}
				</span>
				<span className="aa-time">{formatClock(step.startedAt)}</span>
				<span className="aa-dur">{meta.join(" ")}</span>
				{hasDetails ? (
					<span className="aa-row-chev">{icon("chev", 14)}</span>
				) : null}
			</button>
		);
		const $li = (
			<li
				className={`aa-step ${step.status}${isOpen ? " expanded" : ""}`}
				data-step={step.id}
			>
				{$row}
			</li>
		);
		if (isOpen && hasDetails) $li.append(stepDetails(step));
		return $li;
	}

	function render() {
		const view = reduceTrace(bus.events);
		const terminal = isTerminalState(view.state);
		$el.dataset.state = view.state;
		$el.classList.toggle("finished", terminal);
		$el.classList.toggle("failed", view.state === TaskState.FAILED);
		$el.classList.toggle("cancelled", view.state === TaskState.CANCELLED);

		$state.textContent = STATE_LABEL[view.state] || view.state;
		$spinner.hidden = terminal;

		// contadores
		$counts.replaceChildren(
			chip("ok", `${view.counts.done} concluídas`),
			...(view.counts.running
				? [chip("run", `${view.counts.running} em andamento`)]
				: []),
			...(view.counts.failed
				? [chip("bad", `${view.counts.failed} com falha`)]
				: []),
		);

		// resumo curto
		const total =
			view.endedAt && view.startedAt
				? formatDuration(view.endedAt - view.startedAt)
				: "";
		$now.textContent = terminal
			? `${STATE_LABEL[view.state]}${total ? ` · ${total}` : ""}`
			: view.currentMessage || "Analisando solicitação…";

		// timeline cronológica (ordem de início)
		const ordered = view.steps
			.slice()
			.sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
		$steps.replaceChildren(...ordered.map(renderStep));

		// arquivos alterados (só os que realmente tiveram file_change)
		if (view.files.length) {
			$files.hidden = false;
			const uniq = new Map();
			for (const f of view.files) uniq.set(f.path, f);
			$files.replaceChildren(
				<div className="aa-section-title">
					{icon("file", 13)} Arquivos alterados
				</div>,
				...[...uniq.values()].map((f) => (
					<div className="aa-file">
						<span className="aa-file-path">{f.path}</span>
						<span className={`aa-tag ${f.action}`}>
							{f.action === "created" ? "criado" : "modificado"}
						</span>
					</div>
				)),
			);
		} else {
			$files.hidden = true;
		}

		// terminal ao vivo: último run_command real
		const lastTerm = [...view.steps]
			.reverse()
			.find((s) => TERMINAL_TOOLS.has(s.tool_name));
		if (lastTerm) {
			$term.hidden = false;
			const cmd = lastTerm.metadata?.command?.args?.command;
			const out = lastTerm.error
				? lastTerm.error
				: lastTerm.result !== undefined
					? formatPayload(lastTerm.result)
					: "executando…";
			$term.replaceChildren(
				<div className="aa-section-title">
					{icon("term", 13)} Terminal
					<span
						className={`aa-live${lastTerm.status === StepStatus.RUNNING ? " on" : ""}`}
					>
						{lastTerm.status === StepStatus.RUNNING ? "Live" : "fim"}
					</span>
				</div>,
				codeBlock("saída", `${cmd ? `> ${cmd}\n` : ""}${out}`, "term"),
			);
		} else {
			$term.hidden = true;
		}

		// ações: nova tentativa em falha, cancelar durante a execução
		$actions.replaceChildren();
		if (!terminal && onCancel) {
			$actions.hidden = false;
			$actions.append(
				<button type="button" className="aa-btn" onclick={() => onCancel()}>
					{icon("stop", 12)} Cancelar
				</button>,
			);
		} else if (view.state === TaskState.FAILED && onRetry) {
			$actions.hidden = false;
			$actions.append(
				<button
					type="button"
					className="aa-btn primary"
					onclick={() => onRetry()}
				>
					{icon("retry", 13)} Tentar novamente
				</button>,
			);
		} else {
			$actions.hidden = true;
		}

		// auto-abre enquanto roda; ao terminar com sucesso colapsa se o usuário não mexeu
		if (!terminal) {
			if (!userToggled) {
				$el.classList.add("open");
				$header.setAttribute("aria-expanded", "true");
			}
		} else if (!userToggled && view.state === TaskState.DONE) {
			$el.classList.remove("open");
			$header.setAttribute("aria-expanded", "false");
		}
		if (!terminal && typeof $el.scrollIntoView === "function") {
			$el.scrollIntoView({ block: "nearest" });
		}
		return view;
	}

	// duração de etapas em andamento atualiza sem pesar (1x por segundo)
	function startTicker() {
		if (typeof setInterval !== "function") return;
		rafId = setInterval(() => {
			tick += 1;
			if (isTerminalState(reduceTrace(bus.events).state)) {
				stopTicker();
				return;
			}
			render();
		}, 1000);
	}
	function stopTicker() {
		if (rafId) clearInterval(rafId);
		rafId = 0;
	}

	// reconexão: assina com replay completo; se o painel for recriado, repinta tudo
	const unsubscribe = bus.subscribe(() => {
		render();
		if (bus.closed) stopTicker();
	});
	if (!bus.closed) startTicker();
	render();

	return {
		$el,
		render,
		get detailsOpen() {
			return detailsOpen;
		},
		destroy() {
			stopTicker();
			unsubscribe();
		},
	};
}
