import { describe, expect, it, vi } from "vitest";

vi.mock("lib/settings", () => ({ default: { value: { aiVesperApiKey: "" } } }));
vi.mock("lib/acodexAi/nativeFetch", () => ({ nativeFetch: globalThis.fetch }));

import {
	askVesper,
	extractAssistantText,
	extractConversationId,
	pickFrom,
} from "sidebarApps/aiChat/vesperTool";

describe("vesper tool helpers", () => {
	it("pickFrom acha a primeira chave presente", () => {
		expect(pickFrom({ b: 2, a: 1 }, ["a", "b"])).toBe(1);
		expect(pickFrom(null, ["a"])).toBeUndefined();
	});

	it("extrai id de conversa em varios formatos", () => {
		expect(extractConversationId({ id: "c1" })).toBe("c1");
		expect(extractConversationId({ conversation_id: "c2" })).toBe("c2");
		expect(extractConversationId([{ conversationId: "c3" }])).toBe("c3");
		expect(extractConversationId({ nada: true })).toBeNull();
	});

	it("extrai texto do assistente aninhado", () => {
		expect(extractAssistantText({ content: "oi" })).toBe("oi");
		expect(extractAssistantText({ message: { content: "resposta" } })).toBe("resposta");
		expect(extractAssistantText([{ role: "user", content: "?" }, { role: "assistant", content: "ok" }])).toBe("ok");
		expect(extractAssistantText({})).toBe("");
	});

	it("askVesper devolve erro amigavel sem key", async () => {
		const r = await askVesper("oi", { apiKey: "" });
		expect(r.ok).toBe(false);
		expect(r.error).toContain("API key");
	});

	it("askVesper percorre o fluxo conversa->mensagem", async () => {
		const calls = [];
		const fetchImpl = async (url, opts) => {
			calls.push([url, opts?.method || "GET"]);
			if (url.endsWith("/conversations")) {
				return { ok: true, json: async () => ({ id: "conv9" }) };
			}
			if (url.endsWith("/messages")) {
				return { ok: true, json: async () => ({ content: "tudo certo" }) };
			}
			return { ok: false, status: 404 };
		};
		const r = await askVesper("tudo bem?", { apiKey: "k", fetchImpl });
		expect(r.ok).toBe(true);
		expect(r.resposta).toBe("tudo certo");
		expect(calls[0][0]).toContain("/conversations");
		expect(calls[1][0]).toContain("/conversations/conv9/messages");
		expect(calls[1][1]).toBe("POST");
	});
});
