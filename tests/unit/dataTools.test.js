import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	detectFormat,
	extractRows,
	lintYaml,
	registerDataTools,
	runSql,
	serialize,
	transform,
} from "../../src/lib/acodexAi/dataTools";
import { createToolRegistry } from "../../src/lib/acodexAi/tools";

/** Registry falso que só expõe registerTool/definitions/execute. */
function fakeRegistry() {
	const tools = {};
	return {
		registerTool: (name, tool) => (tools[name] = tool),
		removeTool: (name) => delete tools[name],
		get definitions() {
			return Object.keys(tools);
		},
		execute: async (name, rawArgs) => {
			const tool = tools[name];
			if (!tool) return { error: "unknown" };
			return tool.run(JSON.parse(rawArgs || "{}"));
		},
	};
}

function deps(over = {}) {
	return {
		getActiveFile: () => ({ filename: "a.yaml", uri: "a.yaml" }),
		getEditor: () => ({ state: { doc: { toString: () => "nome: acodex\nversao: 1\n" } } }),
		listCommands: () => ["salvar-arquivo", "abrir-terminal", "formatar"],
		confirm: vi.fn(async () => true),
		createFile: vi.fn((name) => ({ filename: name })),
		...over,
	};
}

let registry;
beforeEach(() => {
	registry = fakeRegistry();
	registerDataTools(registry, deps());
});

describe("extractRows / detectFormat", () => {
	it("detecta json, csv e tsv", () => {
		expect(detectFormat('[{"a":1}]')).toBe("json");
		expect(detectFormat("a;b\n1;2")).toBe("csv");
		expect(detectFormat("a\tb\n1\t2")).toBe("tsv");
	});

	it("extrai CSV com header e converte numeros", () => {
		const rows = extractRows("nome;idade\nGeiza;41\nPedro;13\n", "auto");
		expect(rows).toEqual([
			{ nome: "Geiza", idade: 41 },
			{ nome: "Pedro", idade: 13 },
		]);
	});

	it("extrai TSV e JSON", () => {
		expect(extractRows("a\tb\n1\t2\n")).toEqual([{ a: 1, b: 2 }]);
		expect(extractRows('{"x": 5}')).toEqual([{ x: 5 }]);
	});
});

describe("transform (JSONata)", () => {
	it("filtra e soma com expressao JSONata", async () => {
		const rows = extractRows("nome;idade\nA;30\nB;12\n");
		const adultos = await transform(rows, "$[idade > 18].nome");
		expect(adultos).toBe("A");
		const soma = await transform(rows, "*.idade ~> $sum");
		expect(soma).toBe(42);
	});
});

describe("runSql (sql.js)", () => {
	it("semeia tabela input e roda GROUP BY", async () => {
		const out = await runSql({
			sql: "SELECT nome, SUM(idade) AS total FROM input GROUP BY nome ORDER BY nome",
			data: "nome;idade\nGeiza;41\nPedro;13\n",
		});
		expect(out[0].rows).toEqual([
			{ nome: "Geiza", total: 41 },
			{ nome: "Pedro", total: 13 },
		]);
	});

	it("manipula dados sem colunas sem lançar erro de sintaxe SQL", async () => {
		const out = await runSql({
			sql: "SELECT 123 AS v",
			data: "[{}, {}]",
			format: "json",
		});
		expect(out[0].rows).toEqual([{ v: 123 }]);
	});
});

describe("lintYaml", () => {
	it("valida e devolve chaves", () => {
		expect(lintYaml("a: 1\nb: 2\n")).toEqual({ ok: true, topKeys: ["a", "b"] });
	});

	it("aponta a linha do erro", () => {
		const r = lintYaml("a: 1\nb: [1, 2\n");
		expect(r.ok).toBe(false);
		expect(r.line).toBe(3);
	});
});

describe("registry", () => {
	it("registra as 4 ferramentas de dados", () => {
		expect(registry.definitions).toEqual([
			"etl_pipeline",
			"sqlite_query",
			"fuzzy_search_commands",
			"yaml_lint",
		]);
	});

	it("etl_pipeline roda extracao + transformacao + saida csv", async () => {
		const out = await registry.execute(
			"etl_pipeline",
			'{"data":"nome;idade\\nA;30\\nB;12\\n","transform":"$[idade > 18]","to":"csv"}',
		);
		expect(out.format).toBe("csv");
		expect(out.rows).toBe(1);
		expect(out.content).toContain("A");
	});

	it("etl_pipeline lida com resultado de transformação undefined sem quebrar", async () => {
		const out = await registry.execute(
			"etl_pipeline",
			'{"data":"[1, 2, 3]","transform":"$[idade > 99]"}',
		);
		expect(out.content).toBe("null");
	});

	it("etl_pipeline salva com aprovacao do usuario", async () => {
		const d = deps();
		const reg = fakeRegistry();
		registerDataTools(reg, d);
		const out = await reg.execute(
			"etl_pipeline",
			'{"data":"a;b\\n1;2\\n","to":"json","saveAs":"saida.json"}',
		);
		expect(out.savedAs).toBe("saida.json");
		expect(d.confirm).toHaveBeenCalled();
		expect(d.createFile).toHaveBeenCalledWith("saida.json", out ? expect.any(String) : undefined);
	});

	it("etl_pipeline rejeita jsonata invalido sem quebrar", async () => {
		const out = await registry.execute(
			"etl_pipeline",
			'{"data":"a;b\\n1;2\\n","transform":"???&&&"}',
		);
		expect(out.error).toContain("JSONata");
	});

	it("sqlite_query executa via registry", async () => {
		const out = await registry.execute(
			"sqlite_query",
			'{"sql":"SELECT COUNT(*) AS n FROM input","data":"x\\n1\\n2\\n3\\n"}',
		);
		expect(out.results[0].rows).toEqual([{ n: 3 }]);
	});

	it("fuzzy_search_commands acha comando parecido", async () => {
		const out = await registry.execute(
			"fuzzy_search_commands",
			'{"query":"termnal"}',
		);
		expect(out.matches[0]).toBe("abrir-terminal");
	});

	it("fuzzy_search_commands respeita limite 0 sem padronizar para 10", async () => {
		const out = await registry.execute(
			"fuzzy_search_commands",
			'{"query":"termnal","limit":0}',
		);
		expect(out.matches).toEqual([]);
	});

	it("yaml_lint usa o arquivo ativo", async () => {
		const out = await registry.execute("yaml_lint", "{}");
		expect(out).toEqual({ ok: true, topKeys: ["nome", "versao"] });
	});
});
