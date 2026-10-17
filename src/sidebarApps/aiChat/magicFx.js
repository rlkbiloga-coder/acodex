/**
 * Magic UI FX — helpers vanilla para os efeitos portados de magicui.scss.
 * Sem dependências externas; pensado para Android WebView.
 */

/**
 * Onda no toque (Magic UI "Ripple Button").
 * @param {HTMLElement} el
 */
export function attachRipple(el) {
	el.classList.add("mu-ripple");
	el.addEventListener("pointerdown", (e) => {
		const $wave = document.createElement("span");
		placeRipple($wave, el, e);
	});
}

/**
 * Cria e posiciona a onda do ripple.
 * @param {HTMLElement} wave
 * @param {HTMLElement} el
 * @param {PointerEvent} e
 */
function placeRipple(wave, el, e) {
	const rect = el.getBoundingClientRect();
	wave.className = "mu-ripple-wave";
	wave.style.left = `${e.clientX - rect.left}px`;
	wave.style.top = `${e.clientY - rect.top}px`;
	el.append(wave);
	wave.addEventListener("animationend", () => wave.remove(), { once: true });
}

/**
 * Aplica ripple a todos os botões dentro de um container.
 * @param {HTMLElement} container
 */
export function attachRipples(container) {
	const buttons = container.querySelectorAll(
		"button.ai-send, button.icon-button, button.ai-home-tab, button.ai-scroll-btn",
	);
	for (const $btn of buttons) {
		attachRipple($btn);
	}
}

/**
 * Magic Card: halo seguindo o dedo (spotlight).
 * @param {HTMLElement} el
 */
export function attachSpotlight(el) {
	el.classList.add("mu-magic-card");
	const move = (e) => {
		const rect = el.getBoundingClientRect();
		el.style.setProperty(
			"--mu-spot-x",
			`${((e.clientX - rect.left) / rect.width) * 100}%`,
		);
		el.style.setProperty(
			"--mu-spot-y",
			`${((e.clientY - rect.top) / rect.height) * 100}%`,
		);
	};
	el.addEventListener("pointermove", move, { passive: true });
}

/**
 * Meteors — meteoros caindo (Magic UI "Meteors").
 * @param {HTMLElement} el container (ganha .mu-meteors)
 * @param {number} count
 */
export function spawnMeteors(el, count = 6) {
	if (el.querySelector(".mu-meteors")) return;
	const $wrap = document.createElement("div");
	$wrap.className = "mu-meteors";
	for (let i = 0; i < count; i += 1) {
		const $m = document.createElement("i");
		$m.style.setProperty("--mu-x", `${20 + Math.random() * 80}%`);
		$m.style.setProperty("--mu-angle", `${200 + Math.random() * 30}deg`);
		$m.style.setProperty("--mu-dur", `${3 + Math.random() * 4}s`);
		$m.style.setProperty("--mu-delay", `${Math.random() * 4}s`);
		$wrap.append($m);
	}
	el.append($wrap);
}

/**
 * Particles — pontos flutuantes cintilando (Magic UI "Particles").
 * @param {HTMLElement} el container (ganha .mu-particles)
 * @param {number} count
 */
export function spawnParticles(el, count = 14) {
	if (el.querySelector(".mu-particles")) return;
	const $wrap = document.createElement("div");
	$wrap.className = "mu-particles";
	const colors = ["#8b5cf6", "#22d3ee", "#a78bfa", "#67e8f9"];
	for (let i = 0; i < count; i += 1) {
		const $p = document.createElement("i");
		$p.style.setProperty("--mu-x", `${Math.random() * 100}%`);
		$p.style.setProperty("--mu-y", `${10 + Math.random() * 80}%`);
		$p.style.setProperty("--mu-size", `${2 + Math.random() * 2.5}px`);
		$p.style.setProperty("--mu-scale", `${0.8 + Math.random() * 0.6}`);
		$p.style.setProperty("--mu-drift", `${(Math.random() - 0.5) * 20}px`);
		$p.style.setProperty("--mu-twinkle", `${0.3 + Math.random() * 0.5}`);
		$p.style.setProperty("--mu-dur", `${4 + Math.random() * 5}s`);
		$p.style.setProperty("--mu-delay", `${Math.random() * 5}s`);
		$p.style.setProperty("--mu-color", colors[i % colors.length]);
		$wrap.append($p);
	}
	el.append($wrap);
}

/**
 * Number Ticker — conta de um valor até outro com easing.
 * @param {HTMLElement} el elemento de texto
 * @param {number} to valor final
 * @param {number} [duration]
 */
export function animateNumber(el, to, duration = 500) {
	const from = Number.parseInt(el.textContent, 10);
	if (!Number.isFinite(from) || from === to) {
		el.textContent = String(to);
		return;
	}
	const start = Date.now();
	const step = () => {
		const t = Math.min(1, (Date.now() - start) / duration);
		const eased = 1 - (1 - t) ** 3;
		el.textContent = String(Math.round(from + (to - from) * eased));
		if (t < 1) requestAnimationFrame(step);
	};
	requestAnimationFrame(step);
}
