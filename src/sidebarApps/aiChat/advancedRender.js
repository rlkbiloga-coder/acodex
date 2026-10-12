/**
 * Renderizador avançado das mensagens do Acodex AI.
 *
 * Reaproveita o pipeline open source do app (markdown-it, KaTeX, mermaid,
 * DOMPurify) para oferecer suporte completo nas respostas da IA: tabelas,
 * listas de tarefas, emojis, fórmulas matemáticas, diagramas mermaid e
 * links externos seguros.
 *
 * O render simples (format.js) segue como base: ele é instantâneo e usado
 * durante o streaming. Este módulo substitui o corpo da mensagem quando a
 * resposta termina, elevando o Markdown ao nível do preview.
 */
import DOMPurify from "dompurify";
import { renderMarkdown } from "pages/markdownPreview/renderer";
import { copyText } from "./format";
import { canRun, detectCodeLanguage, runCode } from "./sandboxRunner";

const EXTERNAL_LINK_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

let mermaidPromise = null;

/**
 * @returns {Promise<import("mermaid").default>}
 */
function getMermaid() {
	if (!mermaidPromise) {
		mermaidPromise = import("mermaid")
			.then(({ default: mermaid }) => {
				mermaid.initialize({
					startOnLoad: false,
					securityLevel: "strict",
				});
				return mermaid;
			})
			.catch((error) => {
				mermaidPromise = null;
				throw error;
			});
	}
	return mermaidPromise;
}

/**
 * @param {string} href
 */
function isExternalLink(href) {
	return EXTERNAL_LINK_PATTERN.test(String(href || "").trim());
}

/**
 * Abre links externos no navegador do sistema; links internos viram texto
 * simples para não navegarem dentro do WebView do app.
 * @param {HTMLElement} $root
 */
function decorateLinks($root) {
	for (const $a of Array.from($root.querySelectorAll("a[href]"))) {
		const href = $a.getAttribute("href") || "";
		if (!isExternalLink(href)) {
			$a.removeAttribute("href");
			continue;
		}
		$a.target = "_blank";
		$a.rel = "noopener noreferrer";
		$a.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			const inAppBrowser =
				window.cordova?.InAppBrowser ?? cordova?.InAppBrowser;
			if (inAppBrowser) {
				inAppBrowser.open(href, "_system");
				return;
			}
			window.open(href, "_blank");
		});
	}
}

/**
 * Adiciona botão de copiar em cada bloco de código do Markdown rico.
 * @param {HTMLElement} $root
 */
function decorateCodeBlocks($root) {
	for (const $pre of Array.from($root.querySelectorAll("pre"))) {
		if ($pre.closest(".mermaid") || $pre.querySelector(".ai-copy")) continue;

		const $copy = document.createElement("button");
		$copy.type = "button";
		$copy.className = "ai-copy";
		$copy.textContent = "Copiar";
		$copy.onclick = async () => {
			const code = $pre.querySelector("code")?.textContent || "";
			$copy.textContent = (await copyText(code)) ? "Copiado ✓" : "Falhou";
			setTimeout(() => {
				if ($copy.isConnected) $copy.textContent = "Copiar";
			}, 1600);
		};
		decorateRunButton($pre);
		$pre.style.position = "relative";
		$pre.append($copy);
	}
}

/**
 * Adiciona o botão Executar em blocos de código executáveis (js/python/bash).
 * JS roda em Worker local; python/bash rodam no sandbox do device.
 * @param {HTMLPreElement} $pre
 */
function decorateRunButton($pre) {
	if ($pre.closest(".mermaid") || $pre.querySelector(".ai-run")) return;

	const $code = $pre.querySelector("code");
	const lang = detectCodeLanguage($code);
	if (!lang || !canRun(lang)) return;

	const $run = document.createElement("button");
	$run.type = "button";
	$run.className = "ai-run";
	$run.textContent = "▶ Executar";
	$run.onclick = async () => {
		if ($run.disabled) return;
		$run.disabled = true;
		$run.textContent = "Executando…";

		let result;
		try {
			result = await runCode(lang, $code.textContent || "");
		} catch (error) {
			result = { ok: false, output: String(error) };
		}

		let $out = $pre.nextElementSibling;
		if (!$out?.classList?.contains("ai-run-output")) {
			$out = document.createElement("pre");
			$out.className = "ai-run-output";
			$pre.after($out);
		}
		$out.textContent = result.output || "(sem saída)";
		$out.classList.toggle("ai-run-error", !result.ok);

		$run.textContent = result.ok ? "▶ Executar" : "✕ Falhou";
		setTimeout(() => {
			if ($run.isConnected) {
				$run.textContent = "▶ Executar";
				$run.disabled = false;
			}
		}, 1600);
		$run.disabled = false;
	};
	$pre.append($run);
}

/**
 * Renderiza blocos ```mermaid em diagramas SVG sanitizados.
 * Em falha, exibe o código-fonte do diagrama como bloco simples.
 * @param {HTMLElement} $root
 */
async function renderMermaidBlocks($root) {
	const blocks = Array.from($root.querySelectorAll(".mermaid"));
	if (!blocks.length) return;

	const mermaid = await getMermaid();
	let index = 0;
	await Promise.all(
		blocks.map(async (block) => {
			const source = block.textContent || "";
			const id = `ai-mermaid-${Date.now()}-${index++}`;
			try {
				const { svg, bindFunctions } = await mermaid.render(id, source);
				if (!block.isConnected) return;
				block.innerHTML = DOMPurify.sanitize(svg, {
					USE_PROFILES: { svg: true, svgFilters: true },
					ADD_TAGS: ["style"],
					ADD_ATTR: ["data-et", "data-id", "data-node", "data-zoom", "class"],
				});
				bindFunctions?.(block);
			} catch {
				if (!block.isConnected) return;
				block.classList.add("mermaid-error");
				const $pre = document.createElement("pre");
				$pre.className = "ai-code";
				const $code = document.createElement("code");
				$code.textContent = source;
				$pre.append($code);
				block.replaceChildren($pre);
			}
		}),
	);
}

/**
 * Substitui o corpo simples de uma mensagem da IA pelo render completo:
 * tabelas, listas, fórmulas (KaTeX), diagramas (mermaid) e links seguros.
 * Se qualquer etapa falhar, o render simples permanece no lugar.
 * @param {HTMLElement} $msg Elemento da mensagem (.ai-msg.assistant)
 * @param {string} markdown Texto original da resposta
 */
export async function upgradeAssistantMessage($msg, markdown) {
	const $body = $msg.querySelector(".ai-msg-body");
	if (!$body || !markdown) return;

	let html = "";
	try {
		const result = await renderMarkdown(markdown);
		html = result.html;
	} catch {
		return; // mantém o render simples já visível
	}

	const $rich = document.createElement("div");
	$rich.className = "ai-msg-body ai-rich";
	$rich.innerHTML = DOMPurify.sanitize(html, {
		ADD_ATTR: [
			"target",
			"rel",
			"class",
			"data-language",
			"loading",
			"decoding",
		],
	});

	decorateLinks($rich);
	decorateCodeBlocks($rich);
	$body.replaceWith($rich);

	try {
		await renderMermaidBlocks($rich);
	} catch {
		// blocos de diagrama individuais já tratam o próprio erro
	}
}
