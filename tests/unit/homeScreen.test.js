import { describe, expect, it } from "vitest";
// @vitest-environment happy-dom
import {
	ACTION_CARDS,
	buildContextRows,
	createAiHome,
	TABS,
} from "../../src/sidebarApps/aiChat/homeScreen";

const baseCtx = {
	activeFile: { filename: "main.js" },
	openFilesCount: 3,
	selectionLength: 42,
	model: "gpt",
};

describe("homeScreen", () => {
	it("abas na ordem chat/contexto/acoes", () => {
		expect(TABS.map((t) => t.id)).toEqual(["chat", "context", "actions"]);
	});

	it("cards de acao tem prompt e icone", () => {
		expect(ACTION_CARDS).toHaveLength(6);
		for (const card of ACTION_CARDS) {
			expect(card.id).toBeTruthy();
			expect(card.prompt).toBeTruthy();
			expect(card.icon).toBeTruthy();
		}
	});

	it("linhas de contexto refletem o editor", () => {
		expect(buildContextRows(baseCtx)).toEqual([
			{ label: "Arquivo aberto", value: "main.js" },
			{ label: "Arquivos abertos", value: "3" },
			{ label: "Seleção", value: "42 caracteres" },
			{ label: "Modelo", value: "gpt" },
		]);
		expect(buildContextRows({})[0].value).toBe("Nenhum");
		expect(buildContextRows({})[2].value).toBe("Nada selecionado");
	});

	it("home monta abas e alterna visibilidade", () => {
		const home = createAiHome({
			getContext: () => baseCtx,
			onAction: () => {},
			onSuggestion: () => {},
		});
		expect(home.el.querySelector('[data-tab="chat"]').classList).toContain(
			"active",
		);
		home.showTab("context");
		expect(home.el.querySelector('[data-tab="context"]').classList).toContain(
			"active",
		);
		expect(home.el.querySelector('[data-pane="context"]').classList).toContain(
			"visible",
		);
		expect(home.getContextRows()[0].value).toBe("main.js");
	});

	it("acao e sugestao disparam callbacks", () => {
		const actions = [];
		const suggestions = [];
		const home = createAiHome({
			getContext: () => baseCtx,
			onAction: (p) => actions.push(p),
			onSuggestion: (t) => suggestions.push(t),
			suggestions: ["Explique o arquivo"],
		});
		home.el
			.querySelector('[data-action="explain"]')
			.dispatchEvent(new MouseEvent("click"));
		home.el
			.querySelector(".ai-suggestion")
			.dispatchEvent(new MouseEvent("click"));
		expect(actions).toHaveLength(1);
		expect(suggestions).toEqual(["Explique o arquivo"]);
	});
});

describe("homeScreen redesenhada", () => {
	const make = (extra = {}) =>
		createAiHome({
			getContext: () => baseCtx,
			onAction: () => {},
			onSuggestion: () => {},
			getProvider: () => ({ label: "Vercel AI Gateway" }),
			...extra,
		});

	it("abas-cartão têm título e subtítulo", () => {
		const home = make();
		const texts = [...home.el.querySelectorAll(".ai-home-tab")].map((t) =>
			t.textContent.trim(),
		);
		expect(texts).toEqual([
			"ChatConverse com IA",
			"ContextoSeu projeto",
			"AçõesAutomatize",
		]);
	});

	it("banner mostra o provedor ativo e abre o seletor", () => {
		let opened = 0;
		const home = make({ onProviderClick: () => opened++ });
		const card = home.el.querySelector(".ai-provider-card");
		expect(card.textContent).toContain("Vercel AI Gateway");
		expect(card.querySelector(".ai-badge-active").textContent).toBe("Ativo");
		card.dispatchEvent(new MouseEvent("click"));
		expect(opened).toBe(1);
	});

	it("seis sugestões com subtítulo e ícone svg", () => {
		const home = make();
		const items = home.el.querySelectorAll(".ai-suggestion");
		expect(items).toHaveLength(6);
		for (const item of items) {
			expect(item.querySelector("svg")).toBeTruthy();
			expect(item.querySelector(".ai-suggestion-text span").textContent).not.toBe("");
		}
	});

	it("faixa de atalhos dispara onShortcut com o id", () => {
		const ids = [];
		const home = make({ onShortcut: (id) => ids.push(id) });
		for (const btn of home.el.querySelectorAll(".ai-shortcut")) {
			btn.dispatchEvent(new MouseEvent("click"));
		}
		expect(ids).toEqual(["agents", "models", "plugins", "projects"]);
	});

	it("'Ver todos' leva para a aba Ações", () => {
		const home = make();
		home.el.querySelector(".ai-see-all").dispatchEvent(new MouseEvent("click"));
		expect(home.el.querySelector('[data-tab="actions"]').classList).toContain(
			"active",
		);
	});

	it("sugestões customizadas continuam funcionando", () => {
		const got = [];
		const home = make({
			suggestions: ["Algo novo"],
			onSuggestion: (t) => got.push(t),
		});
		const items = home.el.querySelectorAll(".ai-suggestion");
		expect(items).toHaveLength(1);
		items[0].dispatchEvent(new MouseEvent("click"));
		expect(got).toEqual(["Algo novo"]);
	});
});
