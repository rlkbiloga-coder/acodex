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
