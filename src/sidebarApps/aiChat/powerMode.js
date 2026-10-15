/**
 * Modo de consumo do Acodex AI (frontend puro, sem JSX).
 *
 * Controla o quanto de token/energia cada resposta pode gastar. O padrão é
 * "low" (econômico). Ao trocar de modo o seletor mostra o que mudou.
 */

/** @typedef {"low" | "padrao" | "maximo"} PowerModeId */

/**
 * @type {Record<PowerModeId, {label: string, maxTokens: number | null, nudge: string | null, hint: string}>}
 */
export const POWER_MODES = {
	low: {
		label: "Econômico",
		maxTokens: 600,
		nudge:
			"Modo econômico ATIVO: seja muito conciso, resposta curta e direta, código mínimo e sem explicações longas.",
		hint: "Respostas curtas, limite de ~600 tokens",
	},
	padrao: {
		label: "Padrão",
		maxTokens: null,
		nudge: null,
		hint: "Respostas normais, sem limite extra",
	},
	maximo: {
		label: "Máximo",
		maxTokens: 2400,
		nudge:
			"Modo máximo ATIVO: resposta completa e detalhada, com contexto e exemplos quando ajudar.",
		hint: "Respostas completas, limite alto",
	},
};

export const DEFAULT_POWER_MODE = "low";

/**
 * Resolve o modo vigente a partir do valor salvo (aceita aliases em
 * português/inglês e devolve o padrão para valores desconhecidos).
 * @param {string | undefined} value
 * @returns {PowerModeId}
 */
export function normalizePowerMode(value) {
	if (value === "low" || value === "economia" || value === "eco") return "low";
	if (value === "padrao" || value === "medium" || value === "default")
		return "padrao";
	if (value === "maximo" || value === "max" || value === "high")
		return "maximo";
	return DEFAULT_POWER_MODE;
}

/**
 * Modo vigente com dados prontos para uso.
 * @param {string | undefined} value
 */
export function getPowerMode(value) {
	const id = normalizePowerMode(value);
	return { id, ...POWER_MODES[id] };
}

/**
 * Descrição amigável do que muda entre dois modos (usada no toast).
 * @param {string | undefined} from
 * @param {string} to
 * @returns {string}
 */
export function describePowerModeChange(from, to) {
	const prev = getPowerMode(from);
	const next = getPowerMode(to);
	const parts = [`Modo: ${prev.label} → ${next.label}`, next.hint];
	if (prev.maxTokens !== next.maxTokens) {
		parts.push(
			next.maxTokens
				? `Limite de resposta: ${next.maxTokens} tokens`
				: "Limite de resposta: removido",
		);
	}
	if (prev.nudge !== next.nudge) {
		parts.push(
			next.nudge
				? "Instrução de concisão: ativa"
				: "Instrução de concisão: desativada",
		);
	}
	return parts.join("\n");
}
