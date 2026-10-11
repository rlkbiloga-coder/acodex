/**
 * Log de atividade do Acodex AI.
 *
 * Lista de etapas no estilo "timeline" do Base44: cada ação do agente é
 * uma linha colapsável (ícone + título + chevron). Ao expandir mostra o
 * comando real (parâmetros) e a saída real da ferramenta, com copiar.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** Caminhos SVG (viewBox 24, traço) dos ícones do log. Sem emoji. */
const ICON_PATHS = {
	tool: "M8 6l-6 6 6 6M16 6l6 6-6 6",
	skill: "M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z",
	think:
		"M12 3v3M12 18v3M4.2 7.5l2.6 1.5M17.2 15l2.6 1.5M4.2 16.5L6.8 15M17.2 9l2.6-1.5M12 8a4 4 0 100 8 4 4 0 000-8z",
	error:
		"M12 8v5M12 16.5v.5M10.3 4l-8 14a2 2 0 001.7 3h16a2 2 0 001.7-3l-8-14a2 2 0 00-3.4 0z",
	copy: "M9 9h10v12H9zM5 15V3h10",
};

/**
 * Cria um ícone SVG inline.
 * @param {keyof typeof ICON_PATHS} name
 * @returns {SVGElement}
 */
function icon(name) {
	const svg = document.createElementNS(SVG_NS, "svg");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("width", "14");
	svg.setAttribute("height", "14");
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("stroke-width", "1.8");
	svg.setAttribute("stroke-linecap", "round");
	svg.setAttribute("stroke-linejoin", "round");
	svg.setAttribute("aria-hidden", "true");
	svg.classList.add("ai-log-svg");
	const path = document.createElementNS(SVG_NS, "path");
	path.setAttribute("d", ICON_PATHS[name] || ICON_PATHS.tool);
	svg.append(path);
	return svg;
}

const MAX_BLOCK_CHARS = 4000;

/**
 * Transforma um valor em texto para exibição (JSON legível), limitado.
 * @param {unknown} value
 * @returns {string}
 */
export function formatPayload(value) {
	if (value === undefined || value === null || value === "") return "";
	let text;
	if (typeof value === "string") {
		text = value;
	} else {
		try {
			text = JSON.stringify(value, null, 2);
		} catch {
			text = String(value);
		}
	}
	if (text.length > MAX_BLOCK_CHARS) {
		return `${text.slice(0, MAX_BLOCK_CHARS)}\n… (${text.length - MAX_BLOCK_CHARS} caracteres omitidos)`;
	}
	return text;
}

/**
 * Bloco rotulado (Comando / Saída) com botão de copiar.
 * @param {string} title
 * @param {string} text
 */
function createBlock(title, text) {
	const $copy = (
		<button
			type="button"
			className="ai-log-copy"
			aria-label={`Copiar ${title.toLowerCase()}`}
			onclick={async () => {
				try {
					await navigator.clipboard?.writeText(text);
				} catch {
					// Clipboard indisponível: ignorar.
				}
			}}
		/>
	);
	$copy.append(icon("copy"));
	return (
		<div className="ai-log-block">
			<div className="ai-log-block-title">{title}</div>
			<div className="ai-log-code-wrap">
				<pre className="ai-log-code">{text}</pre>
				{$copy}
			</div>
		</div>
	);
}

/**
 * Cria o log de atividade de um turno do agente.
 * @param {{ open?: boolean }} [options] estado padrão do grupo
 */
export function createActivityLog({ open = true } = {}) {
	const startedAt = Date.now();
	let userToggled = false;
	let count = 0;

	const $steps = <ol className="ai-log-steps" aria-live="polite"></ol>;
	const $status = <span className="ai-log-status">Iniciando</span>;
	const $chevron = <span className="icon expand_more ai-log-chev" />;

	const $header = (
		<button
			type="button"
			className="ai-log-header"
			aria-expanded={String(open)}
			onclick={() => {
				userToggled = true;
				toggle();
			}}
		>
			<span className="ai-log-spinner" aria-hidden="true" />
			{$status}
			{$chevron}
		</button>
	);

	const $el = (
		<div className={`ai-log${open ? " open" : ""}`}>
			{$header}
			{$steps}
		</div>
	);

	function toggle() {
		$el.classList.toggle("open");
		$header.setAttribute(
			"aria-expanded",
			String($el.classList.contains("open")),
		);
	}

	function elapsed() {
		return `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
	}

	function scrollIntoView() {
		if (typeof $el.scrollIntoView === "function") {
			$el.scrollIntoView({ block: "nearest" });
		}
	}

	/**
	 * Adiciona uma etapa. Etapas com `command` ou saída são expansíveis.
	 * @param {string} label título da linha
	 * @param {{ kind?: "tool"|"skill"|"think"|"error", command?: unknown, running?: boolean, detail?: string }} [options]
	 * @returns {{ done: (result?: unknown, ms?: number) => void, fail: (message: string, ms?: number) => void }}
	 */
	function addStep(
		label,
		{ kind = "tool", command, running = true, detail = "" } = {},
	) {
		count += 1;
		const commandText = formatPayload(command);
		const $meta = <span className="ai-log-meta">{detail}</span>;
		const $body = <div className="ai-log-body"></div>;
		if (commandText) $body.append(createBlock("Comando", commandText));

		const $row = (
			<button type="button" className="ai-log-row" aria-expanded="false">
				<span className="ai-log-kind">{icon(kind)}</span>
				<span className="ai-log-label">{label}</span>
				{$meta}
				<span className="icon expand_more ai-log-row-chev" />
			</button>
		);
		const $li = (
			<li className={`ai-log-step${running ? " running" : ""}`}>
				{$row}
				{$body}
			</li>
		);
		$row.onclick = () => {
			const expanded = $li.classList.toggle("expanded");
			$row.setAttribute("aria-expanded", String(expanded));
		};
		if (!commandText) $li.classList.add("plain");

		$steps.append($li);
		$el.classList.add("open");
		$header.setAttribute("aria-expanded", "true");
		scrollIntoView();

		function finish(state, ms) {
			$li.classList.remove("running");
			$li.classList.add(state);
			if (typeof ms === "number") {
				$meta.textContent =
					ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
			}
		}

		return {
			done(result, ms) {
				const out = formatPayload(result);
				if (out) {
					$body.append(createBlock("Saída", out));
					$li.classList.remove("plain");
				}
				finish("done", ms);
			},
			fail(message, ms) {
				$body.append(createBlock("Erro", formatPayload(message)));
				$li.classList.remove("plain");
				finish("fail", ms);
			},
		};
	}

	/** @param {string} text */
	function setStatus(text) {
		$status.textContent = text;
		scrollIntoView();
	}

	/**
	 * Encerra o turno: status final, colapsa se ninguém mexeu.
	 * @param {{ error?: boolean }} [options]
	 */
	function finish({ error = false } = {}) {
		const steps = count === 1 ? "1 etapa" : `${count} etapas`;
		setStatus(`${error ? "Falhou" : "Concluído"} · ${steps} · ${elapsed()}`);
		$el.classList.add("finished", error ? "failed" : "ok");
		if (!userToggled && $steps.childElementCount > 2) {
			$el.classList.remove("open");
			$header.setAttribute("aria-expanded", "false");
		}
	}

	return { $el, addStep, setStatus, finish };
}
