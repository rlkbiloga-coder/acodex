/**
 * Medidor de consumo de tokens do Acodex AI (frontend puro, sem JSX).
 *
 * Estima tokens (aprox. 4 caracteres por token) e acompanha a taxa de
 * requisições por minuto, exibindo: nível (leve/pesado/esgotado),
 * porcentagem do orçamento da sessão e requisições/minuto.
 */

const CHARS_PER_TOKEN = 4;
const RPM_WINDOW_MS = 60_000;

/**
 * @param {object} [options]
 * @param {number} [options.sessionBudgetTokens] Orçamento estimado da sessão.
 * @param {number | null} [options.rpmLimit] Limite de requisições por minuto (NIM: 40).
 * @param {() => number} [options.now] Injetável para testes.
 */
export function createTokenMeter(options = {}) {
	const sessionBudgetTokens = options.sessionBudgetTokens ?? 250_000;
	const rpmLimit = options.rpmLimit ?? null;
	const now = options.now ?? Date.now;

	let tokensUsed = 0;
	let requests = [];
	let lastOutputChars = 0;

	/**
	 * Registra o início de uma requisição (para o RPM).
	 * @param {number} [inputChars] Tamanho da entrada enviada.
	 */
	function begin(inputChars = 0) {
		const t = now();
		requests.push(t);
		requests = requests.filter((ts) => t - ts < RPM_WINDOW_MS);
		tokensUsed += Math.ceil(inputChars / CHARS_PER_TOKEN);
	}

	/**
	 * Registra a saída recebida da resposta.
	 * @param {string | number} output
	 */
	function trackOutput(output) {
		const chars = typeof output === "number" ? output : String(output).length;
		lastOutputChars = chars;
		tokensUsed += Math.ceil(chars / CHARS_PER_TOKEN);
	}

	/** @returns {number} requisições na última janela de 1 minuto */
	function rpm() {
		const t = now();
		requests = requests.filter((ts) => t - ts < RPM_WINDOW_MS);
		return requests.length;
	}

	/**
	 * Estado consolidado do medidor.
	 * @returns {{tokens: number, percent: number, level: "leve" | "pesado" | "acabou", rpm: number, rpmBlocked: boolean, waitSeconds: number, label: string}}
	 */
	function state() {
		const percent = Math.min(
			100,
			Math.round((tokensUsed / sessionBudgetTokens) * 100),
		);
		const currentRpm = rpm();
		const oldest = currentRpm > 0 ? requests[0] : now();
		const waitSeconds = Math.max(
			0,
			Math.ceil((oldest + RPM_WINDOW_MS - now()) / 1000),
		);
		const rpmBlocked = rpmLimit !== null && currentRpm >= rpmLimit;
		let level = "leve";
		if (percent >= 95) level = "acabou";
		else if (percent >= 70) level = "pesado";
		if (rpmBlocked) level = "acabou";
		const label =
			level === "acabou"
				? rpmBlocked
					? `Limite de requisições (${rpmLimit}/min). Aguarde ~${waitSeconds}s`
					: `Orçamento de tokens esgotado (${percent}%)`
				: level === "pesado"
					? `Consumo pesado (${percent}% dos tokens da sessão)`
					: `Consumo leve (${percent}% dos tokens da sessão)`;
		return {
			tokens: tokensUsed,
			percent,
			level,
			rpm: currentRpm,
			rpmBlocked,
			waitSeconds,
			label,
		};
	}

	/** Reinicia a sessão (nova conversa). */
	function reset() {
		tokensUsed = 0;
		requests = [];
		lastOutputChars = 0;
	}

	return { begin, trackOutput, state, reset, rpm };
}

/**
 * Cria o elemento visual do medidor (DOM puro).
 * @param {ReturnType<typeof createTokenMeter>} meter
 * @returns {{ $el: HTMLElement, update: () => void }}
 */
export function createTokenMeterView(meter) {
	const $el = document.createElement("div");
	$el.className = "ai-token-meter";
	$el.title = "Consumo de tokens da sessão";

	const $dot = document.createElement("span");
	$dot.className = "ai-token-meter-dot";
	const $text = document.createElement("span");
	$text.className = "ai-token-meter-text";
	$el.append($dot, $text);

	function update() {
		const s = meter.state();
		$el.dataset.level = s.level;
		$text.textContent = s.rpmBlocked
			? `${s.rpm} req/min · aguarde ${s.waitSeconds}s`
			: `${s.percent}% · ${s.level}`;
		$el.title = s.label;
	}

	$el.addEventListener("click", () => {
		const s = meter.state();
		toastMeter(s);
	});
	update();

	return { $el, update };
}

/** @param {ReturnType<typeof createTokenMeter>["state"] extends () => infer S ? S : never} s */
function toastMeter(s) {
	// Toast é injetado pelo hospedeiro via dataset? Mantido simples: dispara evento.
	$dispatchDetail(s);
}

function $dispatchDetail(detail) {
	document.dispatchEvent(new CustomEvent("ai-token-meter-click", { detail }));
}
