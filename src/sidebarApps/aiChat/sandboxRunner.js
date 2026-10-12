/**
 * Execução de código dos blocos do chat Acodex AI.
 *
 * Adaptador fino sobre o Sandbox do app (lib/sandbox): JavaScript roda em
 * Web Worker, Python via Pyodide e shell no emulador. Assim o botão
 * "Executar" usa exatamente o mesmo motor do terminal Sandbox.
 */
import { runJavaScript, runPython, runShellCommand } from "lib/sandbox";

/** Tamanho máximo de saída exibida. */
export const MAX_OUTPUT_CHARS = 20000;

const LANGUAGE_ALIASES = {
	js: "js",
	javascript: "js",
	mjs: "js",
	node: "js",
	python: "py",
	py: "py",
	python3: "py",
	bash: "sh",
	sh: "sh",
	shell: "sh",
	zsh: "sh",
};

/**
 * Normaliza o token de linguagem de um bloco para js, py ou sh.
 * @param {string} token
 * @returns {"js" | "py" | "sh" | null}
 */
export function resolveLanguage(token) {
	const normalized = String(token || "")
		.trim()
		.toLowerCase()
		.replace(/^`+/, "")
		.split(/[\s:{]/)[0];
	return LANGUAGE_ALIASES[normalized] ?? null;
}

/** Detecta a linguagem executável do elemento <code> de um bloco. */
export function detectCodeLanguage($code) {
	const className = $code?.getAttribute?.("class") || "";
	const match = /language-([^\s]+)/.exec(className);
	return match ? resolveLanguage(match[1]) : null;
}

/** Se a linguagem pode rodar neste ambiente. */
export function canRun(lang) {
	if (lang === "js") return typeof Worker !== "undefined";
	return lang === "py" || lang === "sh";
}

/**
 * Converte linhas do sandbox em texto e flag de erro.
 * @param {Array<{type: string, text: string}>} lines
 */
export function formatLines(lines) {
	const list = Array.isArray(lines) ? lines : [];
	const text = list
		.map((line) => (line.type === "result" ? `=> ${line.text}` : line.text))
		.join("\n");
	const clipped =
		text.length > MAX_OUTPUT_CHARS
			? `${text.slice(0, MAX_OUTPUT_CHARS)}\n[saída truncada]`
			: text;
	return { ok: !list.some((line) => line.type === "error"), output: clipped };
}

/**
 * Executa código na linguagem dada usando o Sandbox do app.
 * @param {"js" | "py" | "sh"} lang
 * @param {string} code
 * @returns {Promise<{ok: boolean, output: string}>}
 */
export async function runCode(lang, code) {
	const source = String(code ?? "");
	if (lang === "js") return formatLines(await runJavaScript(source));
	if (lang === "py") return formatLines(await runPython(source));
	if (lang === "sh") {
		const lines = source
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)
			.flatMap((line) => runShellCommand(line).lines);
		return formatLines(lines);
	}
	return { ok: false, output: "Linguagem não suportada" };
}
