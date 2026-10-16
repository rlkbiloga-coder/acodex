import "./style.scss";
import "./modelSwitcher.scss";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import multiPrompt from "dialogs/multiPrompt";
import { runAgent } from "lib/acodexAi/agent";
import { BUILTIN_SKILLS } from "lib/acodexAi/builtinSkills";
import {
	createChatCompletion,
	validateAiConfig,
	withBuiltinKey,
} from "lib/acodexAi/client";
import { registerDataTools } from "lib/acodexAi/dataTools";
import { createMcpClient } from "lib/acodexAi/mcp";
import { getProviderForBaseUrl } from "lib/acodexAi/models";
import { createSkillRegistry } from "lib/acodexAi/skills";
import { createToolRegistry } from "lib/acodexAi/tools";
import commands from "lib/commands";
import { ensureDevicePermission } from "lib/devicePermissions";
import EditorFile from "lib/editorFile";
import openFile from "lib/openFile";
import appSettings from "lib/settings";
import { upgradeAssistantMessage } from "./advancedRender";
import { createAgentActivity } from "./agentActivity";
import { renderAssistantMessage } from "./format";
import { createAiHome, createIcon } from "./homeScreen";
import {
	buildVisionContent,
	createImageInput,
	DEFAULT_IMAGE_PROMPT,
} from "./imageInput";
import { createModelSwitcher } from "./modelSwitcher";
import { describePowerModeChange, getPowerMode } from "./powerMode";
import { createTokenMeter, createTokenMeterView } from "./tokenMeter";
import { createAgentTracer, createTraceBus } from "./traceEvents";
import { createVoiceInput, isVoiceSupported } from "./voiceInput";

const TOOL_LABELS = {
	get_active_file: "Lendo arquivo ativo",
	get_selection: "Lendo seleção",
	list_open_files: "Listando abas",
	switch_to_file: "Trocando de aba",
	replace_active_file: "Editando arquivo",
	insert_text: "Inserindo texto",
	create_file: "Criando arquivo",
	open_file: "Abrindo arquivo",
	list_commands: "Listando comandos",
	search_open_files: "Buscando nos arquivos",
	run_command: "Executando comando",
	list_skills: "Listando skills",
	load_skill: "Carregando skill",
};

const FENCE = "```";

/** Limite de caracteres da mensagem (mostrado no contador do composer). */
const MAX_INPUT = 2000;

/** @type {HTMLElement|undefined} */
let $counter;
/** @type {HTMLElement|undefined} */
let $composerProvider;
/** @type {HTMLElement|undefined} */
let $composerProviderName;
let tokenMeter = null;
let tokenMeterView = null;

function updateCounter() {
	if (!$counter) return;
	const length = $input?.value?.length ?? 0;
	$counter.textContent = `${length}/${MAX_INPUT}`;
	$counter.classList.toggle("near-limit", length > MAX_INPUT * 0.9);
}

/** Nome curto do provedor ativo (ex.: "Vercel AI"). */
function getProviderLabel() {
	const provider = getProviderForBaseUrl(getConfig().baseUrl);
	return provider?.label || "IA";
}

function updateComposerProvider() {
	if ($composerProviderName) {
		$composerProviderName.textContent = getProviderLabel();
	}
}

const SLASH_COMMANDS = [
	{ cmd: "/arquivo", desc: "Envia o arquivo atual como contexto" },
	{ cmd: "/selecao", desc: "Envia a seleção atual como contexto" },
	{ cmd: "/busca", desc: "Busca texto nos arquivos abertos" },
	{ cmd: "/modelo", desc: "Troca o modelo de IA" },
	{ cmd: "/limpar", desc: "Apaga a conversa" },
	{ cmd: "/ajuda", desc: "Mostra os comandos" },
	{ cmd: "/explicar", desc: "Explica o código com terminologia técnica" },
	{ cmd: "/bugs", desc: "Análise estática: bugs, edge cases e code smells" },
	{ cmd: "/refatorar", desc: "Refatora o arquivo/seleção com boas práticas" },
	{ cmd: "/testes", desc: "Gera casos de teste para o código" },
	{ cmd: "/doc", desc: "Gera documentação (JSDoc/docstring)" },
	{ cmd: "/commit", desc: "Gera mensagem de commit convencional" },
	{ cmd: "/otimizar", desc: "Sugere otimizações de performance" },
	{ cmd: "/seguranca", desc: "Audita vulnerabilidades do código" },
];

/**
 * Prompts de tarefa com terminologia avançada. A chave é o nome do comando
 * sem a barra.
 */
const TASK_PROMPTS = {
	explicar:
		"Explique este código de forma estruturada, com terminologia técnica precisa (complexidade assintótica, padrões de projeto, estruturas de dados, fluxo de controle). Aponte o papel de cada bloco e o porquê das decisões.",
	bugs: "Faça uma análise estática completa: aponte bugs, casos-limite (edge cases), condições de corrida, vazamentos de recurso e code smells. Para cada achado, informe: severidade (crítico/alto/médio/baixo), localização (linha/função) e correção sugerida com código.",
	refatorar:
		"Refatore este código aplicando boas práticas de engenharia: nomes descritivos, funções pequenas e coesas, responsabilidade única, princípio aberto/fechado, tratamento de erros explícito e imutabilidade onde fizer sentido. Entregue o código final completo e um changelog do que mudou.",
	testes:
		"Gere uma suíte de casos de teste abrangente para este código: caminho feliz, casos-limite, entradas inválidas, mocks/stubs necessários e cobertura de erros. Use o framework adequado à linguagem e explique a cobertura pretendida.",
	doc: "Gere a documentação deste código no padrão da linguagem (JSDoc, docstring ou comentário de API). Inclua descrição, parâmetros com tipos, retorno, exceções lançadas e um exemplo de uso.",
	otimizar:
		"Analise a complexidade de tempo e espaço deste código e proponha otimizações concretas: algoritmos melhores, memoização, processamento preguiçoso (lazy), redução de alocações e de I/O. Justifique cada ganho esperado com notação Big-O.",
	seguranca:
		"Faça uma auditoria de segurança neste código: injeção (SQL/command), XSS, path traversal, exposição de dados sensíveis e chaves, validação de entrada ausente e dependências inseguras. Relate cada item com severidade, vetor de ataque e mitigação com código.",
};

/** Ferramentas que alteram arquivos de verdade (geram evento file_change). */
const FILE_CHANGE_TOOLS = {
	replace_active_file: "modified",
	insert_text: "modified",
	create_file: "created",
};

/** Último texto enviado, para "Tentar novamente" depois de uma falha. */
let lastSentText = "";

const CONFIG_ERRORS = {
	"missing-api-key": "Configure sua chave de API para usar o Acodex AI.",
	"missing-model": "Informe um modelo nas configurações.",
	"invalid-base-url": "URL base inválida.",
	"insecure-base-url": "A URL base precisa usar HTTPS.",
};

export default ["brain", "acodex-ai", "Acodex AI", initApp, false, () => {}];

/** @type {import("lib/acodexAi/client").ChatMessage[]} */
let history = [];
/** @type {AbortController|null} */
let controller = null;
/** @type {HTMLElement|null} */
let $liveMsg = null;
/** @type {string} */
let liveBuffer = "";
/** @type {HTMLElement|null} */
let $hints;
/** @type {{ $toggle: HTMLElement, open: () => void }|null} */
let switcherApi = null;

/** @type {ReturnType<typeof createMcpClient>|null} */
let mcpClient = null;
/** @type {string[]} tools MCP registradas no momento */
let mcpToolNames = [];
/** @type {HTMLElement} */
let $messages;
/** @type {HTMLTextAreaElement} */
let $input;
/** @type {HTMLButtonElement} */
let $sendBtn;
/** @type {HTMLButtonElement} */
let $micBtn;
/** @type {HTMLElement} */
let $voiceHint;
/** @type {HTMLButtonElement} */
let $attachBtn;
/** Instância da entrada de imagem (anexo). */
let imageInput;
/** @type {ReturnType<typeof createVoiceInput> | null} */
let voiceInput = null;
/** @type {string} */
let voiceInterim = "";
/**
 * Registro de skills preenchido de forma assíncrona no init; o registry de
 * tools lê este objeto em tempo de execução, então o preenchimento tardio
 * é transparente.
 */
const skillHolder = {
	skills: [],
	has: () => false,
	get: () => null,
};
/** @type {string} */
let skillCatalog = "";

async function initSkills() {
	const registrySkills = await createSkillRegistry({ builtin: BUILTIN_SKILLS });
	skillHolder.skills = registrySkills.skills;
	skillHolder.has = registrySkills.has;
	skillHolder.get = registrySkills.get;
	skillCatalog = registrySkills.catalogPrompt;
}

const registryDeps = {
	getActiveFile: () => editorManager.activeFile,
	getOpenFiles: () => editorManager.files,
	getEditor: () =>
		editorManager.activeFile?.type === "editor" ? editorManager.editor : null,
	createFile: (name, text) => new EditorFile(name, { text, isUnsaved: true }),
	openFile: (uri) => openFile(uri),
	switchFile: (file) => editorManager.switchFile(file.id),
	execCommand: (command, arg) => commands[command](arg),
	listCommands: () => Object.keys(commands),
	confirm: (title, message) => confirm(title, message),
	skills: skillHolder,
};
const registry = createToolRegistry(registryDeps);
// ferramentas opensource de dados: Papa Parse, JSONata, sql.js, Fuse.js, js-yaml
registerDataTools(registry, registryDeps);

function getConfig() {
	const { aiBaseUrl, aiApiKey, aiModel } = appSettings.value;
	return withBuiltinKey({
		baseUrl: aiBaseUrl,
		apiKey: aiApiKey,
		model: aiModel,
	});
}

/**
 * @param {HTMLElement} el
 */
function initApp(el) {
	el.classList.add("acodex-ai");

	$messages = <div className="ai-messages scroll" aria-live="polite"></div>;
	$input = (
		<textarea
			className="ai-input"
			rows="2"
			placeholder="Digite sua mensagem..."
			maxlength={MAX_INPUT}
			aria-label="Mensagem para o Acodex AI"
			onkeydown={onKeyDown}
			oninput={() => {
				autoResize();
				updateHints();
				updateCounter();
			}}
		/>
	);
	$sendBtn = (
		<button
			type="button"
			className="ai-send"
			aria-label="Enviar"
			onclick={onSendClick}
		>
			{createIcon("send", 20)}
		</button>
	);
	if (isVoiceSupported()) {
		$voiceHint = <div className="ai-voice-hint" aria-hidden="true"></div>;
		voiceInput = createVoiceInput({
			onText: onVoiceText,
			onStateChange: onVoiceStateChange,
		});
		$micBtn = (
			<button
				type="button"
				className="ai-send ai-mic"
				aria-label="Ditar mensagem"
				title="Ditar mensagem"
				onclick={onMicClick}
			>
				<span className="icon mic" />
			</button>
		);
	}

	const previousMode = () => appSettings.value.aiPowerMode;
	const switcher = createModelSwitcher({
		getConfig,
		onSelect: async (modelId, baseUrl) => {
			const patch = { aiModel: modelId };
			if (baseUrl && baseUrl !== appSettings.value.aiBaseUrl) {
				patch.aiBaseUrl = baseUrl;
			}
			await appSettings.update(patch, false);
		},
		getActiveMode: () => getPowerMode(appSettings.value.aiPowerMode).id,
		onSelectMode: async (modeId) => {
			const from = appSettings.value.aiPowerMode;
			await appSettings.update({ aiPowerMode: modeId }, false);
			toast(describePowerModeChange(from, modeId));
		},
	});
	switcherApi = switcher;

	const $brand = <span className="ai-brand-logo" aria-hidden="true"></span>;
	$brand.append(createIcon("brain", 26));
	const $gear = <span className="ai-gear-slot"></span>;
	$gear.append(createIcon("gear", 18));
	el.content = (
		<div className="header">
			<div className="title">
				{$brand}
				<span className="ai-brand-text">
					<span className="ai-brand-name">Acodex AI</span>
					<span className="ai-brand-status">
						<i className="ai-home-dot" />
						Online
					</span>
				</span>
				{switcher.$toggle}
				<span className="actions">
					<button
						type="button"
						className="icon-button ai-fullscreen-toggle"
						title="Tela cheia"
						aria-label="Abrir em tela cheia"
						onclick={toggleFullscreen}
					>
						<span className="icon fullscreen" />
					</button>
					<button
						type="button"
						className="icon-button"
						title="Nova conversa"
						aria-label="Nova conversa"
						onclick={clearChat}
					>
						<span className="icon delete_outline" />
					</button>
					<button
						type="button"
						className="icon-button"
						title="Configurações"
						aria-label="Configurações do Acodex AI"
						onclick={openSettings}
					>
						{$gear}
					</button>
				</span>
			</div>
		</div>
	);
	$hints = <div className="ai-hints"></div>;

	imageInput = createImageInput({
		onChange: updateSendState,
		beforePick: async () => {
			await ensureDevicePermission("media", globalThis.system);
			await ensureDevicePermission("camera", globalThis.system);
		},
	});
	$attachBtn = imageInput.$btn;

	$counter = <span className="ai-counter">0/{MAX_INPUT}</span>;
	$composerProvider = <span className="ai-composer-provider"></span>;
	$composerProvider.append(createIcon("sparkle", 14));
	$composerProviderName = <span></span>;
	$composerProvider.append($composerProviderName);
	updateComposerProvider();

	const isNimEndpoint = () => {
		try {
			return (
				new URL(getConfig().baseUrl).hostname === "integrate.api.nvidia.com"
			);
		} catch {
			return false;
		}
	};
	tokenMeter = createTokenMeter({
		rpmLimit: isNimEndpoint() ? 40 : null,
	});
	const meterView = createTokenMeterView(tokenMeter);
	meterView.$el.addEventListener("click", () => meterView.update());
	tokenMeterView = meterView;
	el.querySelector(".ai-composer-bottom")?.append(meterView.$el);

	function toggleFullscreen() {
		const active = el.classList.toggle("ai-fullscreen");
		document.documentElement.classList.toggle("ai-chat-fullscreen", active);
		const $btn = el.querySelector(".ai-fullscreen-toggle .icon");
		if ($btn)
			$btn.className = `icon ${active ? "fullscreen_exit" : "fullscreen"}`;
		$input.focus();
	}
	const $tools = <span className="ai-composer-tools"></span>;
	$tools.append(imageInput.$btn);
	const $adjust = (
		<button
			type="button"
			className="ai-send ai-attach ai-adjust"
			aria-label="Trocar modelo"
			title="Trocar modelo"
			onclick={() => switcher.open()}
		></button>
	);
	$adjust.append(createIcon("sliders", 16));
	$tools.append($adjust);
	if ($micBtn) $tools.append($micBtn);
	el.append(
		$messages,
		<div className="ai-composer">
			{imageInput.$chip}
			{$hints}
			<div className="ai-composer-top">{$tools}</div>
			{$input}
			<div className="ai-composer-bottom">
				{$counter}
				{$composerProvider}
			</div>
			{$sendBtn}
		</div>,
	);
	if ($voiceHint) el.append($voiceHint);
	el.append(imageInput.$fileInput);
	void initSkills();
	void syncMcpTools();
	renderEmptyState();
}

function renderEmptyState() {
	const $home = createAiHome({
		getContext: () => ({
			activeFile: editorManager.activeFile,
			openFilesCount: editorManager.files?.length ?? 0,
			selectionLength: getSelectionLength(),
			model: appSettings.value.aiModel,
		}),
		onAction: (prompt) => send(prompt),
		onSuggestion: (text) => send(text),
		getProvider: () => ({
			label: getProviderLabel(),
			model: getConfig().model,
			mcpCount: mcpToolNames.length,
		}),
		onProviderClick: () => switcherApi?.open(),
		onShortcut: (id) => onShortcut(id),
		onSettings: openSettings,
	}).el;
	$messages.replaceChildren($home);
}

/**
 * Atalhos da faixa inferior da tela inicial.
 * @param {string} id
 */
function onShortcut(id) {
	if (id === "models") {
		switcherApi?.open();
	} else if (id === "plugins") {
		void commands.open("plugins");
	} else if (id === "projects") {
		void commands["open-folder"]();
	} else if (id === "agents") {
		send("/ajuda");
	}
}

/**
 * Sincroniza as tools MCP configuradas com o registry.
 * Reconecta quando a URL muda e remove tools de sessões anteriores.
 */
async function syncMcpTools() {
	for (const name of mcpToolNames) registry.removeTool(name);
	mcpToolNames = [];
	mcpClient = null;
	const url = appSettings.value.aiMcpUrl?.trim();
	if (!url) return;
	try {
		mcpClient = createMcpClient({ url, name: "acodex" });
		await mcpClient.initialize();
		const tools = await mcpClient.listTools();
		for (const tool of tools) {
			const safe = tool.name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
			const local = `mcp__${safe}`;
			if (registry.definitions.some((d) => d.function.name === local)) {
				continue;
			}
			registry.registerTool(local, {
				description: `[MCP] ${tool.description}`.slice(0, 1024),
				parameters: tool.parameters,
				run: (args) => mcpClient.callTool(tool.name, args),
			});
			mcpToolNames.push(local);
		}
		if (mcpToolNames.length) {
			toast(`${mcpToolNames.length} ferramentas MCP conectadas`);
		} else {
			toast("Servidor MCP conectado, nenhuma tool publicada");
		}
	} catch (error) {
		mcpClient = null;
		toast(`MCP: ${error?.message || error}`);
	}
}

function getSelectionLength() {
	const editor =
		editorManager.activeFile?.type === "editor" ? editorManager.editor : null;
	const { from, to } = editor?.state?.selection?.main ?? {};
	if (from === undefined) return 0;
	return to - from;
}

/**
 * @param {KeyboardEvent} e
 */
function onKeyDown(e) {
	if (e.key === "Escape" && controller) {
		e.preventDefault();
		controller.abort();
		return;
	}
	if (e.key !== "Enter" || e.shiftKey) return;
	if (e.isComposing || e.keyCode === 229) return;
	e.preventDefault();
	onSendClick();
}

/**
 * Reage a mudanças no anexo pendente (chip visível etc.).
 */
function updateSendState() {
	if (!$attachBtn) return;
	$attachBtn.classList.toggle("attached", Boolean(imageInput?.pending));
}

function autoResize() {
	$input.style.height = "auto";
	$input.style.height = `${Math.min($input.scrollHeight, 140)}px`;
}

/**
 * Mostra/oculta a barra de comandos slash conforme o texto digitado.
 */
function updateHints() {
	if (!$hints) return;
	const text = $input.value;
	if (!text.startsWith("/")) {
		$hints.style.display = "none";
		$hints.replaceChildren();
		return;
	}
	const matches = SLASH_COMMANDS.filter((item) =>
		item.cmd.startsWith(text.split(" ")[0]),
	);
	if (!matches.length) {
		$hints.style.display = "none";
		$hints.replaceChildren();
		return;
	}
	$hints.replaceChildren();
	for (const item of matches) {
		$hints.append(
			<button
				type="button"
				className="ai-hint"
				onclick={() => {
					$input.value = `${item.cmd} `;
					$input.focus();
					updateHints();
				}}
			>
				<code>{item.cmd}</code>
				<span>{item.desc}</span>
			</button>,
		);
	}
	$hints.style.display = "block";
}

/**
 * Processa comandos slash. Retorna true quando a mensagem foi tratada.
 * @param {string} text
 */
function handleSlashCommand(text) {
	if (!text.startsWith("/")) return false;
	const [cmd, ...rest] = text.split(/\s+/);
	const arg = rest.join(" ");

	if (cmd === "/limpar") {
		clearChat();
		return true;
	}
	if (cmd === "/modelo") {
		switcherApi?.open();
		return true;
	}
	if (cmd === "/ajuda") {
		const $help = appendMessage(
			"assistant",
			SLASH_COMMANDS.map((item) => `${item.cmd} — ${item.desc}`).join("\n"),
			true,
		);
		$help.querySelector("p").style.whiteSpace = "pre-line";
		return true;
	}
	if (cmd === "/arquivo") {
		const editor =
			editorManager.activeFile?.type === "editor" ? editorManager.editor : null;
		if (!editor) {
			appendMessage("error", "Nenhum arquivo aberto.");
			return true;
		}
		const name = editorManager.activeFile.filename ?? "arquivo";
		const content = editor.state.doc.toString();
		send(
			`[${name}]\n\`${"`"}\`${"`"}\`${"`"}\n${content}\n\`${"`"}\`${"`"}\`${"`"}\n\n${arg || "Analise este arquivo e dê um resumo técnico com sugestões de melhoria."}`,
		);
		return true;
	}
	if (cmd === "/selecao") {
		const editor =
			editorManager.activeFile?.type === "editor" ? editorManager.editor : null;
		if (!editor) {
			appendMessage("error", "Nenhum arquivo aberto.");
			return true;
		}
		const { from, to } = editor.state.selection.main;
		const selection = editor.state.doc.sliceString(from, to);
		if (!selection) {
			appendMessage("error", "Nada selecionado no editor.");
			return true;
		}
		const name = editorManager.activeFile.filename ?? "arquivo";
		send(
			`[seleção em ${name}]\n\`${"`"}\`${"`"}\`${"`"}\n${selection}\n\`${"`"}\`${"`"}\`${"`"}\n\n${arg || "Revise esta seleção e sugira melhorias."}`,
		);
		return true;
	}
	if (cmd === "/busca") {
		send(
			arg
				? `Busque "${arg}" nos arquivos abertos usando a ferramenta de busca.`
				: "Liste TODOs nos arquivos abertos usando a ferramenta de busca.",
		);
		return true;
	}
	if (cmd === "/commit") {
		const name = editorManager.activeFile?.filename ?? "projeto";
		send(
			arg ||
				`Gere uma mensagem de commit no padrão Conventional Commits (tipo(escopo): descrição no imperativo) para as mudanças atuais de ${name}. Inclua body curto se necessário e sugira emojis de gitmoji opcionais.`,
		);
		return true;
	}
	if (TASK_PROMPTS[cmd.slice(1)]) {
		const editor =
			editorManager.activeFile?.type === "editor" ? editorManager.editor : null;
		if (!editor) {
			appendMessage("error", "Nenhum arquivo aberto.");
			return true;
		}
		const name = editorManager.activeFile.filename ?? "arquivo";
		const { from, to } = editor.state.selection.main;
		const selection = editor.state.doc.sliceString(from, to);
		const context = selection || editor.state.doc.toString();
		const scopeLabel = selection ? `seleção em ${name}` : name;
		send(
			`[${scopeLabel}]\n${FENCE}\n${context}\n${FENCE}\n\n${TASK_PROMPTS[cmd.slice(1)]}`,
		);
		return true;
	}
	return false;
}

/**
 * Contexto do arquivo ativo injetado no prompt do sistema.
 */
function buildSystemContext() {
	const file = editorManager.activeFile;
	if (!file) return "";
	const parts = [`Arquivo ativo: ${file.filename ?? file.name}`];
	if (file.uri) parts.push(`URI: ${file.uri}`);
	parts.push(`Não salvo: ${file.isUnsaved ? "sim" : "não"}`);
	return parts.join("\n");
}

/**
 * Insere texto no cursor do composer, mantendo o foco e o autocomplete.
 * @param {string} text
 */
function insertAtCursor(text) {
	const start = $input.selectionStart ?? $input.value.length;
	const end = $input.selectionEnd ?? start;
	const before = $input.value.slice(0, start);
	const after = $input.value.slice(end);
	const glue =
		before && !/\s$/.test(before) && !/^[\s.,;:!?]/.test(text) ? " " : "";
	$input.value = `${before}${glue}${text}${after}`;
	const pos = start + glue.length + text.length;
	$input.setSelectionRange(pos, pos);
	autoResize();
	updateHints();
}

/**
 * @param {string} text
 * @param {{ isFinal: boolean }} info
 */
function onVoiceText(text, info) {
	if (info.isFinal) {
		voiceInterim = "";
		$voiceHint.textContent = "";
		$voiceHint.classList.remove("visible");
		insertAtCursor(text.trim());
		return;
	}
	voiceInterim = text;
	$voiceHint.textContent = text;
	$voiceHint.classList.add("visible");
}

function onVoiceStateChange(state, message) {
	if (!$micBtn) return;
	$micBtn.classList.toggle("listening", state === "listening");
	if (state === "listening") {
		$micBtn.title = "Parar ditado";
		$micBtn.setAttribute("aria-label", "Parar ditado");
	} else {
		$micBtn.title = "Ditar mensagem";
		$micBtn.setAttribute("aria-label", "Ditar mensagem");
		if (state === "error" || state === "unsupported") {
			if (message) {
				$voiceHint.textContent = message;
				$voiceHint.classList.add("visible", "error");
				setTimeout(() => {
					$voiceHint.classList.remove("visible", "error");
				}, 4000);
			}
		} else if (state === "idle") {
			voiceInterim = "";
			$voiceHint.textContent = "";
			$voiceHint.classList.remove("visible");
		}
	}
}

async function onMicClick() {
	if (!voiceInput) return;
	if (voiceInput.isListening()) {
		voiceInput.stop();
		return;
	}
	const allowed = await ensureDevicePermission("microphone", globalThis.system);
	if (!allowed) {
		window.toast?.("Permita o microfone para usar o ditado", 3000);
		return;
	}
	$input.focus();
	voiceInput.start();
}

function onSendClick() {
	if (controller) {
		controller.abort();
		return;
	}
	send($input.value);
}

/**
 * @param {"user"|"assistant"|"tool"|"error"} role
 * @param {string} text
 * @param {boolean} [advanced] renderização avançada (Markdown/KaTeX/Mermaid)
 * @param {string} [imageDataUrl] imagem anexada (mensagem do usuário)
 */
function appendMessage(role, text, advanced = false, imageDataUrl) {
	$messages.querySelector(".ai-empty")?.remove();
	const $msg = <div className={`ai-msg ${role}`}></div>;
	if (role === "user" && imageDataUrl) {
		$msg.append(
			<img className="ai-msg-image" src={imageDataUrl} alt="Imagem anexada" />,
		);
	}
	if (role === "assistant") {
		$msg.append(renderAssistantMessage(text));
		if (advanced) {
			void upgradeAssistantMessage($msg, text);
		}
		$msg.append(
			<button
				type="button"
				className="ai-msg-copy"
				title="Copiar mensagem"
				aria-label="Copiar mensagem"
				onclick={() => {
					const value = text;
					if (navigator.clipboard?.writeText) {
						navigator.clipboard.writeText(value);
					} else {
						const $ta = (
							<textarea
								className="ai-input"
								style="position:fixed;opacity:0"
							></textarea>
						);
						document.body.append($ta);
						$ta.value = value;
						$ta.select();
						document.execCommand("copy");
						$ta.remove();
					}
				}}
			>
				<span className="icon content_copy" />
			</button>,
		);
	} else if (role === "tool") {
		const $tag = <span className="ai-tool-tag" aria-hidden="true"></span>;
		$tag.textContent = "•";
		$msg.append($tag, text);
	} else {
		$msg.textContent = text;
	}
	if (role === "user" || role === "assistant") {
		const $time = (
			<span className="ai-msg-time">
				{new Date().toLocaleTimeString([], {
					hour: "2-digit",
					minute: "2-digit",
				})}
			</span>
		);
		$msg.append($time);
	}
	$messages.append($msg);
	$messages.scrollTop = $messages.scrollHeight;
	return $msg;
}

function setBusy(busy) {
	$sendBtn.classList.toggle("busy", busy);
	$sendBtn.setAttribute("aria-label", busy ? "Parar" : "Enviar");
	$sendBtn.firstChild.className = `icon ${busy ? "clearclose" : "arrow_upward"}`;
}

/**
 * @param {string} rawText
 */
async function send(rawText) {
	const attachment = imageInput?.pending;
	const image = attachment?.kind === "image" ? attachment : null;
	const textFile = attachment?.kind === "text" ? attachment : null;
	let text = rawText.trim();
	if (!text && image) text = DEFAULT_IMAGE_PROMPT;
	if (!text && textFile)
		text = "Analise o arquivo anexado: identifique a linguagem/estrutura, aponte erros e dê recomendações.";
	if ((!text && !attachment) || controller) return;
	if (textFile) {
		const fence = textFile.content.includes(FENCE) ? "````" : FENCE;
		text = `${text}\n\nArquivo anexado: ${textFile.name}\n${fence}\n${textFile.content}\n${fence}`;
	}
	if (text.startsWith("/")) {
		if (handleSlashCommand(text)) return;
	}

	const config = getConfig();
	const configError = validateAiConfig(config);
	if (configError) {
		appendMessage("error", CONFIG_ERRORS[configError] || configError);
		await openSettings();
		return;
	}

	$input.value = "";
	autoResize();
	appendMessage("user", text, false, image?.dataUrl);
	history.push({
		role: "user",
		content: image ? buildVisionContent(text, image.dataUrl) : text,
	});
	imageInput?.clear();
	updateSendState();

	lastSentText = text;
	const bus = createTraceBus();
	const tracer = createAgentTracer(bus, {
		labels: TOOL_LABELS,
		fileTools: FILE_CHANGE_TOOLS,
	});
	const panel = createAgentActivity(bus, {
		onCancel: () => controller?.abort(),
		onRetry: () => send(lastSentText),
	});
	$messages.append(panel.$el);
	tracer.start(text.length > 80 ? `${text.slice(0, 80)}…` : text);
	// etapa real: montar o contexto do editor enviado no prompt do sistema
	const contextStartedAt = Date.now();
	const powerMode = getPowerMode(appSettings.value.aiPowerMode);
	const systemContext = [buildSystemContext(), powerMode.nudge]
		.filter(Boolean)
		.join("\n\n");
	tracer.progress("context", "Preparando contexto do editor", "done", {
		duration_ms: Date.now() - contextStartedAt,
		metadata: { kind: "context", command: systemContext || undefined },
	});
	tracer.beginModel();

	controller = new AbortController();
	setBusy(true);
	const snapshot = history.length;
	liveBuffer = "";
	$liveMsg = null;
	let failed = false;

	/** Re-renderiza a mensagem em streaming com o texto acumulado. */
	function renderLive() {
		if (!$liveMsg) {
			$liveMsg = appendMessage("assistant", liveBuffer || "…");
			$liveMsg.classList.add("ai-live");
		} else {
			const $body = $liveMsg.querySelector(".ai-msg-body");
			$body?.replaceWith(renderAssistantMessage(liveBuffer || "…"));
			$messages.scrollTop = $messages.scrollHeight;
		}
	}

	tokenMeter?.begin(text.length);
	try {
		await runAgent({
			history,
			config,
			registry,
			signal: controller.signal,
			systemContext,
			skillCatalog,
			complete: powerMode.maxTokens
				? (params) =>
						createChatCompletion({
							...params,
							max_tokens: powerMode.maxTokens,
						})
				: undefined,
			onEvent(event) {
				// toda atividade do agente vira evento tipado no bus (nada simulado)
				tracer.handleAgentEvent(event);
				if (event.type === "tool") {
					// o agente volta a consultar o modelo depois de cada ferramenta
					tracer.beginModel("Analisando resultado da ferramenta");
				} else if (event.type === "assistant-delta") {
					liveBuffer += event.text;
					tokenMeter?.trackOutput(event.text.length);
					renderLive();
				} else if (event.content !== undefined) {
					$liveMsg?.remove();
					$liveMsg = null;
					if (event.content) appendMessage("assistant", event.content, true);
				}
			},
		});
	} catch (error) {
		history = history.slice(0, snapshot - 1);
		failed = error?.name !== "AbortError";
		if (failed) {
			tracer.end("failed", String(error?.message || error));
			appendMessage("error", `Erro: ${error?.message || error}`);
		} else {
			tracer.end("cancelled");
			if (liveBuffer) appendMessage("assistant", liveBuffer, true);
		}
	} finally {
		// só conclui se nenhum erro/cancelamento já encerrou a tarefa
		tracer.end("done");
		$liveMsg?.classList.remove("ai-live");
		$liveMsg = null;
		controller = null;
		setBusy(false);
		tokenMeterView?.update();
	}
}

function clearChat() {
	controller?.abort();
	history = [];
	renderEmptyState();
}

async function openSettings() {
	const current = getConfig();
	try {
		const result = await multiPrompt(
			"Acodex AI",
			[
				{
					id: "baseUrl",
					type: "url",
					placeholder: "URL base (OpenAI compatível)",
					value: current.baseUrl,
					required: true,
				},
				{
					id: "model",
					type: "text",
					placeholder: "Modelo (ex: openai/gpt-5-mini)",
					value: current.model,
					required: true,
				},
				{
					id: "apiKey",
					type: "password",
					placeholder: "Chave de API",
					value: current.apiKey,
					sensitive: true,
				},
				{
					id: "mcpUrl",
					type: "url",
					placeholder: "Servidor MCP (opcional, ex: https://host/mcp)",
					value: appSettings.value.aiMcpUrl,
					required: false,
				},
				{
					id: "vesperApiKey",
					type: "password",
					placeholder: "API key do agente Vesper (opcional)",
					value: appSettings.value.aiVesperApiKey,
					sensitive: true,
				},
			],
			"Funciona com Vercel AI Gateway, OpenAI, OpenRouter, Groq ou qualquer API compatível com OpenAI. A chave fica salva apenas neste dispositivo.",
		);
		await appSettings.update(
			{
				aiBaseUrl: result.baseUrl.trim(),
				aiModel: result.model.trim(),
				aiApiKey: result.apiKey.trim(),
				aiMcpUrl: (result.mcpUrl || "").trim(),
				aiVesperApiKey: (result.vesperApiKey || "").trim(),
			},
			false,
		);
		await syncMcpTools();
	} catch {
		// Dialog dismissed.
	}
}
