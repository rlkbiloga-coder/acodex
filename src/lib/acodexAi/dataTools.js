/**
 * Ferramentas opensource de dados do Acodex AI.
 *
 * Cinco tecnologias consolidadas (todas open source) expostas ao agente:
 * - Papa Parse (MIT): parsing/geração de CSV e TSV.
 * - JSONata (MIT): linguagem de consulta e transformação de JSON (o "T" do ETL).
 * - sql.js (MIT): SQLite real compilado em JavaScript, roda no aparelho.
 * - Fuse.js (Apache-2.0): busca fuzzy nos comandos do app.
 * - js-yaml (MIT): leitura e validação de YAML com linha do erro.
 *
 * O conjunto forma o pipeline de ETL do Acodex: extrair (CSV/TSV/JSON),
 * transformar (JSONata) e carregar (SQLite, arquivos do projeto).
 */

import Fuse from "fuse.js";
import * as yaml from "js-yaml";
import jsonata from "jsonata";
import papaparse from "papaparse";

/** Limite de tamanho do resultado devolvido ao modelo. */
const MAX_RESULT_CHARS = 30000;

/** Limite de linhas devolvidas pelo SQLite. */
const MAX_SQL_ROWS = 500;

/** Motor SQLite carregado uma única vez, sob demanda (bundle grande). */
let sqlEnginePromise = null;
async function getSqlEngine() {
	if (!sqlEnginePromise) {
		sqlEnginePromise = import("sql.js/dist/sql-asm.js").then((m) => m.default);
	}
	return sqlEnginePromise;
}

/**
 * Detecta o formato a partir do conteúdo quando "auto".
 * @param {string} data
 * @returns {"json"|"csv"|"tsv"}
 */
export function detectFormat(data) {
	const trimmed = String(data ?? "").trimStart();
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
	if (trimmed.includes("\t")) return "tsv";
	return "csv";
}

/** Converte valores de célula que parecem números (soma/filtro do JSONata). */
function coerceRow(row) {
	if (!row || typeof row !== "object") return row;
	const out = {};
	for (const [key, value] of Object.entries(row)) {
		if (
			typeof value === "string" &&
			value !== "" &&
			!Number.isNaN(Number(value))
		) {
			out[key] = Number(value);
		} else {
			out[key] = value;
		}
	}
	return out;
}

/**
 * Extrai dados de texto para linhas de objetos.
 * @param {string} data texto (CSV, TSV ou JSON)
 * @param {"auto"|"csv"|"tsv"|"json"} format
 * @returns {object[]} linhas
 */
export function extractRows(data, format = "auto") {
	const kind = format === "auto" ? detectFormat(data) : format;
	if (kind === "json") {
		const parsed = JSON.parse(data);
		const rows = Array.isArray(parsed) ? parsed : [parsed];
		return rows.map((row) => (row && typeof row === "object" ? row : row));
	}
	const parsed = papaparse.parse(data, {
		delimiter: kind === "tsv" ? "\t" : undefined,
		header: true,
		skipEmptyLines: true,
		dynamicTyping: false,
	});
	if (parsed.errors.length && !parsed.data.length) {
		throw new Error(
			`Falha ao extrair: ${parsed.errors[0].message} (linha ${parsed.errors[0].row}).`,
		);
	}
	return parsed.data
		.filter((row) => row && typeof row === "object" && Object.keys(row).length)
		.map(coerceRow);
}

/**
 * Aplica uma expressão JSONata às linhas (transformação do ETL).
 * @param {object[]|object} input
 * @param {string} expression
 */
export async function transform(input, expression) {
	const expr = jsonata(expression);
	return expr.evaluate(input);
}

/**
 * Serializa linhas para o formato pedido.
 * @param {any} rows
 * @param {"json"|"csv"} to
 */
export function serialize(rows, to = "json") {
	if (to === "csv") {
		const list = Array.isArray(rows) ? rows : [rows ?? {}];
		return papaparse.unparse(list);
	}
	return JSON.stringify(rows ?? null, null, 2);
}

/** Abrevia resultado para caber no contexto do modelo. */
function limit(text) {
	const str = String(text ?? "");
	return str.length > MAX_RESULT_CHARS
		? `${str.slice(0, MAX_RESULT_CHARS)}\n…(truncado)`
		: str;
}

/** Executa SQL sobre dados carregados em memória com SQLite real. */
export async function runSql({ sql, data, format }) {
	const initSqlJs = await getSqlEngine();
	const SQL = await initSqlJs();
	const db = new SQL.Database();
	try {
		if (data && String(data).trim()) {
			const rows = extractRows(data, format);
			if (rows.length) {
				const columns = [
					...new Set(
						rows.flatMap((r) =>
							r && typeof r === "object" ? Object.keys(r) : [],
						),
					),
				];
				if (columns.length) {
					db.run(
						`CREATE TABLE input (${columns
							.map((c) => `"${c.replace(/"/g, '""')}"`)
							.join(", ")});`,
					);
					for (const row of rows) {
						if (row && typeof row === "object") {
							db.run(
								`INSERT INTO input VALUES (${columns.map(() => "?").join(", ")});`,
								columns.map((c) => row[c] ?? null),
							);
						}
					}
				}
			}
		}
		const results = db.exec(sql);
		const out = results.map((result) => {
			const records = (result.values ?? [])
				.slice(0, MAX_SQL_ROWS)
				.map((values) =>
					Object.fromEntries(result.columns.map((c, i) => [c, values[i]])),
				);
			return { columns: result.columns, rows: records, count: records.length };
		});
		return out;
	} finally {
		db.close();
	}
}

/** Valida YAML e devolve detalhe com linha do problema. */
export function lintYaml(content) {
	try {
		const parsed = yaml.load(content);
		return {
			ok: true,
			topKeys:
				parsed && typeof parsed === "object" && !Array.isArray(parsed)
					? Object.keys(parsed)
					: [],
		};
	} catch (error) {
		return {
			ok: false,
			message: error.reason ?? String(error.message ?? error),
			line: error.mark?.line != null ? error.mark.line + 1 : undefined,
		};
	}
}

/**
 * Registra as ferramentas de dados no registry do agente.
 * @param {ReturnType<typeof import("./tools").createToolRegistry>} registry
 * @param {import("./tools").ToolDeps} deps
 */
export function registerDataTools(registry, deps) {
	registry.registerTool("etl_pipeline", {
		description:
			"Run an ETL pipeline: extract CSV/TSV/JSON data, transform it with a JSONata expression, and return JSON or CSV (optionally saving to a project file, with user approval).",
		parameters: {
			type: "object",
			properties: {
				data: { type: "string", description: "Raw CSV, TSV or JSON content." },
				format: {
					type: "string",
					enum: ["auto", "csv", "tsv", "json"],
					description: "Input format. Use auto to detect.",
				},
				transform: {
					type: "string",
					description:
						"JSONata expression applied to the extracted rows, e.g. `$[idade > 18].{nome, idade}`.",
				},
				to: {
					type: "string",
					enum: ["json", "csv"],
					description: "Output format.",
				},
				saveAs: {
					type: "string",
					description:
						"Optional file name to save the result, e.g. result.csv. Requires user approval.",
				},
			},
			required: ["data"],
		},
		async run(args) {
			if (!String(args.data ?? "").trim())
				return { error: "data é obrigatório." };
			let rows;
			try {
				rows = extractRows(args.data, args.format ?? "auto");
			} catch (error) {
				return { error: `Extração falhou: ${error.message}` };
			}
			if (args.transform) {
				try {
					rows = await transform(rows, args.transform);
				} catch (error) {
					return { error: `JSONata falhou: ${error.message}` };
				}
			}
			const text = serialize(rows, args.to ?? "json");
			if (args.saveAs) {
				const approved = await deps.confirm(
					"Acodex AI",
					`Salvar resultado ETL em "${args.saveAs}"?`,
				);
				if (!approved) return { error: "Usuário não aprovou o salvamento." };
				const file = deps.createFile(args.saveAs, text);
				return {
					ok: true,
					savedAs: file?.filename ?? args.saveAs,
					rows: Array.isArray(rows) ? rows.length : 1,
				};
			}
			return {
				format: args.to ?? "json",
				rows: Array.isArray(rows) ? rows.length : 1,
				content: limit(text),
			};
		},
	});

	registry.registerTool("sqlite_query", {
		description:
			"Run real SQL (SELECT, JOIN, GROUP BY…) on an in-memory SQLite database on the device. Optionally seed a table named `input` from CSV/TSV/JSON data.",
		parameters: {
			type: "object",
			properties: {
				sql: {
					type: "string",
					description:
						"SQL statement(s). Seeded rows live in table `input` with typed columns.",
				},
				data: {
					type: "string",
					description:
						"Optional CSV/TSV/JSON content loaded into table `input` before running sql.",
				},
				format: { type: "string", enum: ["auto", "csv", "tsv", "json"] },
			},
			required: ["sql"],
		},
		async run(args) {
			if (!String(args.sql ?? "").trim())
				return { error: "sql é obrigatório." };
			try {
				const results = await runSql({
					sql: args.sql,
					data: args.data,
					format: args.format ?? "auto",
				});
				return { results, content: limit(JSON.stringify(results, null, 1)) };
			} catch (error) {
				return { error: `SQLite falhou: ${error.message}` };
			}
		},
	});

	registry.registerTool("fuzzy_search_commands", {
		description:
			"Fuzzy search (Fuse.js) across every command available in the app. Returns the best matching command names.",
		parameters: {
			type: "object",
			properties: {
				query: { type: "string" },
				limit: { type: "number", description: "Max results, default 10." },
			},
			required: ["query"],
		},
		run(args) {
			const commands = deps.listCommands() ?? [];
			const fuse = new Fuse(
				commands.map((name) => ({ name })),
				{
					keys: ["name"],
					threshold: 0.4,
				},
			);
			const max = args.limit != null ? Math.max(0, Number(args.limit)) : 10;
			const hits = fuse
				.search(String(args.query ?? ""))
				.slice(0, max)
				.map((hit) => hit.item.name);
			return { matches: hits };
		},
	});

	registry.registerTool("yaml_lint", {
		description:
			"Validate YAML (config files, CI pipelines, k8s manifests) with js-yaml. Use the active file content or a provided string. Returns the offending line on failure.",
		parameters: {
			type: "object",
			properties: {
				content: {
					type: "string",
					description: "YAML text. Defaults to the active file content.",
				},
			},
		},
		run(args) {
			let content = args.content;
			if (content == null) {
				const file = deps.getActiveFile();
				const editor = deps.getEditor();
				if (!file || !editor) return { error: "No file is open." };
				content = editor.state.doc.toString();
			}
			const result = lintYaml(content);
			return result.ok
				? { ok: true, topKeys: result.topKeys }
				: { ok: false, line: result.line, message: result.message };
		},
	});
}
