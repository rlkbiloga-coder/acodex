/**
 * AcodeX IA — Copyright (c) 2026 mlk010173.
 * Licensed under the AcodeX IA License — see LICENSE-ACODEX-IA.
 *
 * Arte cósmica do AcodeX IA:
 *  - banner no topo da tela inicial (titã das galáxias)
 *  - tela de descanso (busto de mármore + buraco negro) que aparece
 *    quando o chat fica ocioso e some ao primeiro toque
 * Módulo sem dependências do app, fácil de testar.
 */

import bannerSrc from "../../../res/acodex-ia/banner.jpg?inline";
import restSrc from "../../../res/acodex-ia/descanso.jpg";

/** Tempo ocioso padrão até a tela de descanso aparecer (ms). */
export const REST_IDLE_MS = 90 * 1000;

/** Tempo mínimo permitido, para não ficar irritante. */
export const REST_MIN_MS = 15 * 1000;

/**
 * Banner panorâmico (3:1) para o topo da tela inicial.
 * @returns {HTMLElement}
 */
export function createCosmosBanner() {
	const $banner = document.createElement("div");
	$banner.className = "ai-cosmos-banner";
	$banner.setAttribute("role", "img");
	$banner.setAttribute("aria-label", "AcodeX IA");
	$banner.style.backgroundImage = `url("${bannerSrc}")`;
	const $label = document.createElement("span");
	$label.className = "ai-cosmos-banner-label";
	$label.textContent = "AcodeX IA";
	$banner.append($label);
	return $banner;
}

/**
 * Tela de descanso: cobre o chat após ociosidade e some ao toque.
 * Não consome bateria enquanto oculta (sem animação ativa).
 * @param {HTMLElement} host Elemento raiz do chat (position: relative)
 * @param {object} [options]
 * @param {number} [options.idleMs] Ociosidade até aparecer (ms)
 * @param {() => boolean} [options.isBusy] Se true, nunca aparece (ex.: IA respondendo)
 * @returns {{ show: () => void, hide: () => void, reset: () => void, destroy: () => void, isVisible: () => boolean }}
 */
export function createRestScreen(host, options = {}) {
	const idleMs = Math.max(REST_MIN_MS, options.idleMs ?? REST_IDLE_MS);
	const isBusy = options.isBusy || (() => false);

	const $overlay = document.createElement("div");
	$overlay.className = "ai-rest";
	$overlay.setAttribute("aria-hidden", "true");
	$overlay.style.backgroundImage = `url("${restSrc}")`;
	const $hint = document.createElement("div");
	$hint.className = "ai-rest-hint";
	const $title = document.createElement("strong");
	$title.textContent = "AcodeX IA";
	const $sub = document.createElement("span");
	$sub.textContent = "toque para voltar";
	$hint.append($title, $sub);
	$overlay.append($hint);
	host.append($overlay);

	let timer = null;
	let visible = false;

	function clear() {
		if (timer) clearTimeout(timer);
		timer = null;
	}

	function arm() {
		clear();
		timer = setTimeout(() => {
			// IA ocupada: adia em vez de cobrir uma resposta em andamento.
			if (isBusy()) return arm();
			show();
		}, idleMs);
	}

	function show() {
		if (visible) return;
		visible = true;
		$overlay.classList.add("visible");
		$overlay.setAttribute("aria-hidden", "false");
		clear();
	}

	function hide() {
		if (!visible) return arm();
		visible = false;
		$overlay.classList.remove("visible");
		$overlay.setAttribute("aria-hidden", "true");
		arm();
	}

	/** Qualquer interação reinicia a contagem. */
	function reset() {
		if (visible) return;
		arm();
	}

	const activity = () => reset();
	for (const type of ["pointerdown", "keydown", "touchstart", "input"]) {
		host.addEventListener(type, activity, { passive: true, capture: true });
	}
	$overlay.addEventListener("pointerdown", (e) => {
		e.stopPropagation();
		hide();
	});

	arm();

	return {
		show,
		hide,
		reset,
		isVisible: () => visible,
		destroy() {
			clear();
			for (const type of ["pointerdown", "keydown", "touchstart", "input"]) {
				host.removeEventListener(type, activity, { capture: true });
			}
			$overlay.remove();
		},
	};
}
