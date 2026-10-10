// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { createChatCompletion } from "lib/acodexAi/client";
import { getProviderForBaseUrl } from "lib/acodexAi/models";

/** Cria um endpoint OpenAI-compatible falso que responde em SSE. */
function fakeSseEndpoint(captured) {
	const sse = (obj) => `data: ${JSON.stringify(obj)}\n\n`;
	const chunks = [
		sse({ choices: [{ delta: { role: "assistant" } }] }),
		sse({ choices: [{ delta: { content: "Análise concluída. " } }] }),
		sse({ choices: [{ delta: { content: "O bug está na linha 4." } }] }),
		sse({
			choices: [
				{
					delta: {
						tool_calls: [
							{
								index: 0,
								id: "call_1",
								function: { name: "read_file", arguments: '{"path":"src' },
							},
						],
					},
				},
			],
		}),
		sse({
			choices: [
				{
					delta: {
						tool_calls: [
							{
								index: 0,
								function: { arguments: '/app.js"}' },
							},
						],
					},
				},
			],
		}),
		"data: [DONE]\n\n",
	];
	return vi.fn(async (url, init) => {
		captured.url = url;
		captured.init = init;
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				for (const c of chunks) controller.enqueue(encoder.encode(c));
				controller.close();
			},
		});
		return {
			ok: true,
			status: 200,
			body: { getReader: () => stream.getReader() },
		};
	});
}

describe("integração provedores free/open-source (prompt complexo)", () => {
	it("Groq: payload multimodal (texto+imagem) e streaming com tool call", async () => {
		const captured = {};
		const fetchImpl = fakeSseEndpoint(captured);

		const messages = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Analise o código da imagem e refatore usando tools." },
					{
						type: "image_url",
						image_url: { url: "data:image/jpeg;base64,aGVsbG8=" },
					},
				],
			},
		];

		const deltas = [];
		const result = await createChatCompletion({
			config: {
				baseUrl: "https://api.groq.com/openai/v1",
				apiKey: "gsk_test",
				model: "qwen/qwen3-32b",
			},
			messages,
			tools: [{ type: "function", function: { name: "read_file" } }],
			fetchImpl,
			onDelta: (d) => deltas.push(d),
		});

		// provedor detectado no catálogo
		expect(getProviderForBaseUrl(captured.url.replace("/chat/completions", ""))?.id).toBe("groq");
		// requisição correta
		expect(captured.url).toBe("https://api.groq.com/openai/v1/chat/completions");
		expect(captured.init.headers.Authorization).toBe("Bearer gsk_test");
		expect(captured.init.headers.Accept).toBe("text/event-stream");
		const body = JSON.parse(captured.init.body);
		expect(body.model).toBe("qwen/qwen3-32b");
		expect(body.stream).toBe(true);
		expect(body.tools).toHaveLength(1);
		expect(body.messages[0].content[1].type).toBe("image_url");
		// streaming montado
		expect(deltas).toEqual(["Análise concluída. ", "O bug está na linha 4."]);
		expect(result.content).toBe("Análise concluída. O bug está na linha 4.");
		expect(result.tool_calls[0].function.name).toBe("read_file");
		expect(JSON.parse(result.tool_calls[0].function.arguments)).toEqual({
			path: "src/app.js",
		});
	});

	it("Ollama local: http aceito e URL montada", async () => {
		const captured = {};
		const fetchImpl = fakeSseEndpoint(captured);
		await createChatCompletion({
			config: {
				baseUrl: "http://localhost:11434/v1",
				apiKey: "ollama",
				model: "qwen2.5-coder:7b",
			},
			messages: [{ role: "user", content: "Explique este traceback" }],
			fetchImpl,
			onDelta: () => {},
		});
		expect(captured.url).toBe("http://localhost:11434/v1/chat/completions");
		expect(getProviderForBaseUrl("http://localhost:11434/v1")?.id).toBe("ollama");
	});
});
