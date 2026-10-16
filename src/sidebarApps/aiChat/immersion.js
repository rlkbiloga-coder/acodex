/**
 * Micro-detalhes de imersão do Acodex AI (frontend puro).
 * Háptica leve, saudação por horário e lógica do botão de scroll.
 */

/**
 * Saudação por período do dia (horário local, sem acento no id).
 * @param {Date} [date]
 * @returns {"bom dia" | "boa tarde" | "boa noite"}
 */
export function timeGreeting(date = new Date()) {
	const hour = date.getHours();
	if (hour < 5) return "boa noite"; // madrugada
	if (hour < 12) return "bom dia";
	if (hour < 18) return "boa tarde";
	return "boa noite";
}

/**
 * Se o botão "ir para o fim" deve aparecer (usuário rolou para cima).
 * @param {{scrollTop: number, scrollHeight: number, clientHeight: number}} el
 * @returns {boolean}
 */
export function shouldShowScrollButton(el) {
	if (!el) return false;
	const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
	return distance > 120;
}

/**
 * Se o dispositivo pediu menos animação (acessibilidade/bateria).
 * @returns {boolean}
 */
export function prefersReducedMotion() {
	return Boolean(
		globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
	);
}

/**
 * Vibração háptica leve; no-op quando não suportada ou desativada.
 * @param {number} [ms] duração
 */
export function haptic(ms = 8) {
	try {
		if (prefersReducedMotion()) return;
		globalThis.navigator?.vibrate?.(ms);
	} catch {
		// no-op
	}
}
