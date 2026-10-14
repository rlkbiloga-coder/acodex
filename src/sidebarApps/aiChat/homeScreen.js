/**
 * Tela inicial do Acodex AI: abas Chat / Contexto / Ações.
 * Pure builder (no app dependencies) for easy testing;
 * o chat integra via callbacks.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Ícones de traço (24x24, stroke currentColor). Inline para não depender
 * da fonte de ícones do app, que não tem bug/escudo/frasco etc.
 */
export const ICON_PATHS = {
	brain:
		"M9.5 3A3.5 3.5 0 0 0 6 6.5c0 .3 0 .6.1.9A3.5 3.5 0 0 0 4 11c0 1 .4 1.9 1.1 2.5A3.5 3.5 0 0 0 6 17.4 3.5 3.5 0 0 0 9.5 21c1 0 1.9-.5 2.5-1.2V4.2A3.5 3.5 0 0 0 9.5 3Zm5 0A3.5 3.5 0 0 1 18 6.5c0 .3 0 .6-.1.9A3.5 3.5 0 0 1 20 11c0 1-.4 1.9-1.1 2.5a3.5 3.5 0 0 1-.9 3.9A3.5 3.5 0 0 1 14.5 21c-1 0-1.9-.5-2.5-1.2M9 9h1.5M13.5 9H15M9 14h1.5M13.5 14H15",
	chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12ZM8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01",
	file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M9 13h6M9 17h6M9 9h2",
	bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
	sparkle:
		"M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 11 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14ZM5 15l.7 1.6L7.3 17.3 5.7 18 5 19.6 4.3 18 2.7 17.3l1.6-.7L5 15Z",
	bug: "M9 8V6a3 3 0 0 1 6 0v2M7 10h10v5a5 5 0 0 1-10 0v-5Zm-3 1 3 1M20 11l-3 1M4 17l3-1.5M20 17l-3-1.5M12 10v10",
	refresh:
		"M20 11a8 8 0 0 0-14.3-4.5L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.5l1.7-2M20 20v-4.5h-4.5",
	flask:
		"M9 3h6M10 3v6.2L4.6 18.4A2 2 0 0 0 6.3 21.5h11.4a2 2 0 0 0 1.7-3.1L14 9.2V3M7.5 15h9",
	gauge:
		"M12 4a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm0 9 4.5-4.5M7 13h.01M8.5 9h.01M12 7.5h.01M17 13h.01",
	shield:
		"M12 3 5 6v5c0 4.5 3 8.4 7 10 4-1.6 7-5.5 7-10V6l-7-3Zm-3.2 9 2.4 2.4 4.2-4.6",
	robot:
		"M12 3v3M7 8h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3Zm-3 5H2m20 0h-2M9 13h.01M15 13h.01M9.5 17h5",
	cube: "M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Zm0 9 8-4.5M12 12 4 7.5M12 12v9",
	plug: "M9 3v5M15 3v5M6 8h12v4a6 6 0 0 1-12 0V8Zm6 10v3",
	folder:
		"M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z",
	chevron: "m9 6 6 6-6 6",
	arrow: "M5 12h14m-5-5 5 5-5 5",
	gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-2.5.1-1 1.7-1.3-1.7-3-2 .6a7 7 0 0 0-1.7-1l-.4-2.1h-3.4l-.4 2.1a7 7 0 0 0-1.7 1l-2-.6-1.7 3L7 11.5l.1 1-.1 1-1.7 1.3 1.7 3 2-.6a7 7 0 0 0 1.7 1l.4 2.1h3.4l.4-2.1a7 7 0 0 0 1.7-1l2 .6 1.7-3-1.7-1.3Z",
	send: "M21 3 3 10.5l6.5 2.5L12 20l9-17ZM9.5 13 21 3",
	clip: "m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7L9.2 17.2a1.7 1.7 0 0 1-2.4-2.4L14.5 7",
	sliders: "M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6",
	user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0",
};

/**
 * Cria um <svg> de traço com o ícone pedido.
 * @param {keyof typeof ICON_PATHS} name
 * @param {number} [size]
 */
export function createIcon(name, size = 20) {
	const svg = document.createElementNS(SVG_NS, "svg");
	svg.setAttribute("viewBox", "0 0 24 24");
	svg.setAttribute("width", String(size));
	svg.setAttribute("height", String(size));
	svg.setAttribute("fill", "none");
	svg.setAttribute("stroke", "currentColor");
	svg.setAttribute("stroke-width", "1.7");
	svg.setAttribute("stroke-linecap", "round");
	svg.setAttribute("stroke-linejoin", "round");
	svg.setAttribute("aria-hidden", "true");
	svg.classList.add("ai-svg", `ai-svg-${name}`);
	const path = document.createElementNS(SVG_NS, "path");
	path.setAttribute("d", ICON_PATHS[name] || ICON_PATHS.sparkle);
	svg.append(path);
	return svg;
}

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
		icon: "file",
		prompt: "Explique o arquivo aberto em detalhes.",
	},
	{
		id: "find-bugs",
		title: "Encontrar bugs",
		description: "Análise de erros e riscos",
		icon: "bug",
		prompt: "Encontre bugs neste código.",
	},
	{
		id: "refactor",
		title: "Refatorar",
		description: "Melhorar a estrutura do código",
		icon: "refresh",
		prompt: "Refatore o código aberto mantendo o comportamento.",
	},
	{
		id: "tests",
		title: "Gerar testes",
		description: "Casos de teste para o arquivo",
		icon: "flask",
		prompt: "Gere casos de teste para o arquivo aberto.",
	},
	{
		id: "optimize",
		title: "Otimizar",
		description: "Performance e legibilidade",
		icon: "gauge",
		prompt: "Otimize a performance deste código.",
	},
	{
		id: "security",
		title: "Auditar segurança",
		description: "Vulnerabilidades e práticas",
		icon: "shield",
		prompt: "Audite a segurança deste código.",
	},
];

/** Rótulos das abas, na ordem exibida. */
export const TABS = [
	{ id: "chat", label: "Chat", sub: "Converse com IA", icon: "chat" },
	{ id: "context", label: "Contexto", sub: "Seu projeto", icon: "file" },
	{ id: "actions", label: "Ações", sub: "Automatize", icon: "bolt" },
];

/**
 * Sugestões rápidas: título que é enviado ao chat + subtítulo + ícone.
 * @type {{title: string, sub: string, icon: keyof typeof ICON_PATHS}[]}
 */
export const QUICK_SUGGESTIONS = [
	{
		title: "Explique o arquivo aberto",
		sub: "Entenda o código atual",
		icon: "file",
	},
	{
		title: "Encontre bugs neste código",
		sub: "Analise e corrija problemas",
		icon: "bug",
	},
	{
		title: "Refatore a seleção atual",
		sub: "Melhore o código",
		icon: "refresh",
	},
	{
		title: "Gere casos de teste para o arquivo",
		sub: "Mais qualidade e segurança",
		icon: "flask",
	},
	{
		title: "Otimize a performance do código",
		sub: "Deixe mais rápido e eficiente",
		icon: "gauge",
	},
	{
		title: "Audite a segurança deste código",
		sub: "Encontre vulnerabilidades",
		icon: "shield",
	},
];

/** Atalhos da faixa inferior. */
export const SHORTCUTS = [
	{ id: "agents", label: "Agentes", icon: "robot" },
	{ id: "models", label: "Modelos", icon: "cube" },
	{ id: "plugins", label: "Plugins", icon: "plug" },
	{ id: "projects", label: "Projetos", icon: "folder" },
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
 * @param {{getContext: () => object, onAction: (prompt: string) => void, onSuggestion: (text: string) => void, suggestions?: string[], getProvider?: () => {label?: string, model?: string}|null, onProviderClick?: () => void, onShortcut?: (id: string) => void, onSettings?: () => void}} options
 * @returns {{el: HTMLElement, showTab: (id: string) => void, getContextRows: () => Array<{label: string, value: string}>}}
 */
export function createAiHome(options) {
	const {
		getContext,
		onAction,
		onSuggestion,
		suggestions,
		getProvider = () => null,
		onProviderClick = () => {},
		onShortcut = () => {},
		onSettings,
	} = options;

	/** Sugestões: lista customizada (só títulos) ou o conjunto rico padrão. */
	const quick = suggestions
		? suggestions.map((title) => {
				const known = QUICK_SUGGESTIONS.find((q) => q.title === title);
				return known || { title, sub: "", icon: "sparkle" };
			})
		: QUICK_SUGGESTIONS;

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

	// ---------- Hero: logo, nome, status ----------
	const $logo = h("span", { className: "ai-home-logo" }, [
		createIcon("brain", 34),
	]);
	const $hero = h("div", { className: "ai-home-hero" }, [
		$logo,
		h("div", { className: "ai-home-hero-text" }, [
			h("strong", { className: "ai-home-name", text: "Acodex AI" }),
			h("span", { className: "ai-home-status" }, [
				h("i", { className: "ai-home-dot" }),
				"Online",
			]),
		]),
	]);
	if (onSettings) {
		$hero.append(
			h(
				"button",
				{
					type: "button",
					className: "ai-home-gear",
					"aria-label": "Configurações do Acodex AI",
					onclick: onSettings,
				},
				[createIcon("gear", 18)],
			),
		);
	}
	const $lead = h("p", {
		className: "ai-home-lead",
		text: "Seu assistente de IA integrado ao editor. Mais produtividade, menos esforço.",
	});

	// ---------- Abas-cartão ----------
	const $tabs = h("div", { className: "ai-home-tabs", role: "tablist" });
	const tabButtons = {};
	for (const { id, label, sub, icon } of TABS) {
		const $tab = h(
			"button",
			{
				type: "button",
				role: "tab",
				className: "ai-home-tab",
				"data-tab": id,
				onclick: () => showTab(id),
			},
			[
				createIcon(icon, 22),
				h("strong", { text: label }),
				h("span", { className: "ai-home-tab-sub", text: sub }),
			],
		);
		tabButtons[id] = $tab;
		$tabs.append($tab);
	}

	// ---------- Banner do provedor ----------
	const $provName = h("strong", { className: "ai-provider-name" });
	const $provSub = h("span", { className: "ai-provider-sub" });
	const $provider = h(
		"button",
		{
			type: "button",
			className: "ai-provider-card",
			"aria-label": "Trocar provedor e modelo",
			onclick: onProviderClick,
		},
		[
			h("span", { className: "ai-provider-icon" }, [createIcon("sparkle", 22)]),
			h("span", { className: "ai-provider-text" }, [
				h("span", { className: "ai-provider-row" }, [
					$provName,
					h("em", { className: "ai-badge-active", text: "Ativo" }),
				]),
				$provSub,
			]),
			h("span", { className: "ai-chev" }, [createIcon("chevron", 18)]),
		],
	);

	function renderProvider() {
		const provider = getProvider();
		$provName.textContent = provider?.label || "Provedor de IA";
		let sub = provider?.model
			? `${provider.model} \u2022 Rápido e seguro`
			: "Modelos disponíveis \u2022 Rápido e seguro";
		if (provider?.mcpCount) sub += ` \u2022 ${provider.mcpCount} MCP`;
		$provSub.textContent = sub;
	}

	// ---------- Painéis ----------
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
			h("div", { className: "ai-section-head" }, [
				h("span", { className: "ai-section-title" }, [
					createIcon("sparkle", 18),
					h("strong", { text: "Sugestões rápidas" }),
				]),
				h(
					"button",
					{
						type: "button",
						className: "ai-see-all",
						onclick: () => showTab("actions"),
					},
					["Ver todos ", createIcon("arrow", 14)],
				),
			]),
		);
		for (const item of quick) {
			$chat.append(
				h(
					"button",
					{
						type: "button",
						className: "ai-suggestion",
						onclick: () => onSuggestion(item.title),
					},
					[
						h("span", { className: "ai-suggestion-icon" }, [
							createIcon(item.icon, 22),
						]),
						h("span", { className: "ai-suggestion-text" }, [
							h("strong", { text: item.title }),
							item.sub ? h("span", { text: item.sub }) : "",
						]),
						h("span", { className: "ai-chev" }, [createIcon("chevron", 18)]),
					],
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
						h("span", { className: "ai-suggestion-icon" }, [
							createIcon(card.icon, 20),
						]),
						h("strong", { text: card.title }),
						h("span", { className: "ai-action-desc", text: card.description }),
					],
				),
			);
		}
		$actions.replaceChildren($grid);
	}

	// ---------- Atalhos ----------
	const $shortcuts = h("div", { className: "ai-shortcuts" });
	for (const { id, label, icon } of SHORTCUTS) {
		$shortcuts.append(
			h(
				"button",
				{
					type: "button",
					className: "ai-shortcut",
					"data-shortcut": id,
					onclick: () => onShortcut(id),
				},
				[createIcon(icon, 22), h("span", { text: label })],
			),
		);
	}

	function showTab(id) {
		for (const { id: tabId } of TABS) {
			const active = tabId === id;
			tabButtons[tabId].classList.toggle("active", active);
			tabButtons[tabId].setAttribute("aria-selected", String(active));
		}
		const panes = { chat: $chat, context: $context, actions: $actions };
		for (const [paneId, $pane] of Object.entries(panes)) {
			$pane.classList.toggle("visible", paneId === id);
		}
		if (id === "context") renderContextPane();
	}

	renderProvider();
	renderChatPane();
	renderActionsPane();
	$el.append(
		$hero,
		$lead,
		$tabs,
		$provider,
		$chat,
		$context,
		$actions,
		$shortcuts,
	);
	showTab("chat");

	return {
		el: $el,
		showTab,
		refresh: renderProvider,
		getContextRows: () => buildContextRows(getContext()),
	};
}
