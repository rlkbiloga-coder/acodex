/**
 * Tela inicial do Acodex AI: abas Chat / Contexto / Ações.
 * Pure builder (no app dependencies) for easy testing;
 * o chat integra via callbacks.
 */

/**
 * @typedef {Object} ActionCard
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} icon identificador CSS do icone
 * @property {string} prompt enviado ao clicar
 */

/** @type {ActionCard[]} */
export const ACTION_CARDS = [
	{
		id: "explain",
		title: "Explicar código",
		description: "Entender o arquivo aberto linha a linha",
		icon: "code",
		prompt: "Explique o arquivo aberto em detalhes.",
	},
	{
		id: "find-bugs",
		title: "Encontrar bugs",
		description: "Análise de erros e riscos",
		icon: "error",
		prompt: "Encontre bugs neste código.",
	},
	{
		id: "refactor",
		title: "Refatorar",
		description: "Melhorar a estrutura do código",
		icon: "edit",
		prompt: "Refatore o código aberto mantendo o comportamento.",
	},
	{
		id: "tests",
		title: "Gerar testes",
		description: "Casos de teste para o arquivo",
		icon: "check_circle",
		prompt: "Gere casos de teste para o arquivo aberto.",
	},
	{
		id: "optimize",
		title: "Otimizar",
		description: "Performance e legibilidade",
		icon: "lightbulb",
		prompt: "Otimize a performance deste código.",
	},
	{
		id: "security",
		title: "Auditar segurança",
		description: "Vulnerabilidades e práticas",
		icon: "terminal",
		prompt: "Audite a segurança deste código.",
	},
];

/** Rótulos das abas, na ordem exibida. */
export const TABS = [
	{ id: "chat", label: "Chat" },
	{ id: "context", label: "Contexto" },
	{ id: "actions", label: "Ações" },
];

/**
 * Resumo de contexto do editor para a aba Contexto.
 * @param {{activeFile?: {filename?: string}|null, openFilesCount?: number, selectionLength?: number, model?: string}} context
 */
export function buildContextRows(context = {}) {
	const rows = [
		{
			label: "Arquivo aberto",
			value: context.activeFile?.filename || "Nenhum",
		},
		{ label: "Arquivos abertos", value: String(context.openFilesCount ?? 0) },
		{
			label: "Seleção",
			value: context.selectionLength
				? `${context.selectionLength} caracteres`
				: "Nada selecionado",
		},
		{ label: "Modelo", value: context.model || "Padrão" },
	];
	return rows;
}

/**
 * Cria a tela inicial com abas.
 * @param {{getContext: () => object, onAction: (prompt: string) => void, onSuggestion: (text: string) => void, suggestions?: string[]}} options
 * @returns {{el: HTMLElement, showTab: (id: string) => void, getContextRows: () => Array<{label: string, value: string}>}}
 */
export function createAiHome(options) {
	const {
		getContext,
		onAction,
		onSuggestion,
		suggestions = [
			"Explique o arquivo aberto",
			"Encontre bugs neste código",
			"Refatore a seleção atual",
			"Gere casos de teste para o arquivo",
			"Otimize a performance do código",
			"Audite a segurança deste código",
		],
	} = options;

	/** Cria um elemento com props simples e filhos. */
	function h(tag, props = {}, children = []) {
		const el = document.createElement(tag);
		for (const [key, value] of Object.entries(props)) {
			if (key === "onclick") el.addEventListener("click", value);
			else if (key === "className") el.className = value;
			else if (key === "text") el.textContent = value;
			else el.setAttribute(key, String(value));
		}
		for (const child of [].concat(children)) {
			el.append(child);
		}
		return el;
	}

	const $el = h("div", { className: "ai-home" });

	const $tabs = h("div", { className: "ai-home-tabs", role: "tablist" });
	const tabButtons = {};
	for (const { id, label } of TABS) {
		const $tab = h(
			"button",
			{
				type: "button",
				role: "tab",
				className: "ai-home-tab",
				"data-tab": id,
				onclick: () => showTab(id),
			},
			[label],
		);
		tabButtons[id] = $tab;
		$tabs.append($tab);
	}

	const $chat = h("div", { className: "ai-home-pane", "data-pane": "chat" });
	const $context = h("div", {
		className: "ai-home-pane",
		"data-pane": "context",
	});
	const $actions = h("div", {
		className: "ai-home-pane",
		"data-pane": "actions",
	});

	function renderChatPane() {
		$chat.replaceChildren(
			h("div", { className: "ai-home-hero" }, [
				h("span", { className: "icon brain" }),
				h("strong", { text: "Acodex AI" }),
				h("p", { text: "Escolha uma ação ou escreva sua mensagem abaixo." }),
			]),
		);
		for (const text of suggestions) {
			$chat.append(
				h(
					"button",
					{
						type: "button",
						className: "ai-suggestion",
						onclick: () => onSuggestion(text),
					},
					[text],
				),
			);
		}
	}

	function renderContextPane() {
		const $pane = h("div", { className: "ai-home-context" });
		for (const { label, value } of buildContextRows(getContext())) {
			$pane.append(
				h("div", { className: "ai-context-row" }, [
					h("span", { text: label }),
					h("strong", { text: value }),
				]),
			);
		}
		$context.replaceChildren($pane);
	}

	function renderActionsPane() {
		const $grid = h("div", { className: "ai-actions-grid" });
		for (const card of ACTION_CARDS) {
			$grid.append(
				h(
					"button",
					{
						type: "button",
						className: "ai-action-card",
						"data-action": card.id,
						onclick: () => onAction(card.prompt),
					},
					[
						h("span", { className: `icon ${card.icon}` }),
						h("strong", { text: card.title }),
						h("span", { className: "ai-action-desc", text: card.description }),
					],
				),
			);
		}
		$actions.replaceChildren($grid);
	}

	function showTab(id) {
		for (const { id: tabId } of TABS) {
			tabButtons[tabId].classList.toggle("active", tabId === id);
		}
		const panes = { chat: $chat, context: $context, actions: $actions };
		for (const [paneId, $pane] of Object.entries(panes)) {
			$pane.classList.toggle("visible", paneId === id);
		}
		if (id === "context") renderContextPane();
	}

	renderChatPane();
	renderActionsPane();
	$el.append($tabs, $chat, $context, $actions);
	showTab("chat");

	return {
		el: $el,
		showTab,
		getContextRows: () => buildContextRows(getContext()),
	};
}
