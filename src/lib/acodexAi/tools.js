export const MAX_FILE_CHARS = 30000;

/** Commands the assistant must never run on its own. */
export const BLOCKED_COMMANDS = new Set([
	"exit",
	"close-all-tabs",
	"close-other-tabs",
	"close-tabs-to-left",
	"close-tabs-to-right",
	"close-tabs-in-group",
	"open-log-file",
	"copy-device-info",
]);

/**
 * @typedef {object} ToolDeps
 * @property {() => any} getActiveFile Returns the active EditorFile or null
 * @property {() => any[]} getOpenFiles Returns all open EditorFiles
 * @property {() => any} getEditor Returns the active CodeMirror EditorView
 * @property {(name: string, text: string) => void} createFile
 * @property {(uri: string) => Promise<void>} openFile
 * @property {(file: any) => void} switchFile
 * @property {(command: string, arg?: any) => any} execCommand
 * @property {() => string[]} listCommands
 * @property {(title: string, message: string) => Promise<boolean>} confirm
 * @property {{ has: (name: string) => boolean, get: (name: string) => any|null, skills: any[] }} [skills]
 *        Optional skill registry (see lib/acodexAi/skills.js). When present, adds the list_skills and load_skill tools.
 */

/**
 * @param {string} text
 */
export function truncate(text, max = MAX_FILE_CHARS) {
	if (text.length <= max) return { text, truncated: false };
	return { text: text.slice(0, max), truncated: true };
}

/**
 * @param {any} file
 */
function describeFile(file) {
	return {
		id: file.id,
		name: file.filename ?? file.name,
		uri: file.uri ?? null,
		unsaved: Boolean(file.isUnsaved),
	};
}

/**
 * @param {ToolDeps} deps
 */
export function createToolRegistry(deps) {
	/** @type {Record<string, {description: string, parameters: object, run: (args: any) => Promise<any>|any}>} */
	const tools = {
		get_active_file: {
			description:
				"Get the name, uri and full text of the file currently open in the editor.",
			parameters: { type: "object", properties: {} },
			run() {
				const file = deps.getActiveFile();
				const editor = deps.getEditor();
				if (!file || !editor) return { error: "No file is open." };
				const { text, truncated } = truncate(editor.state.doc.toString());
				return { ...describeFile(file), content: text, truncated };
			},
		},
		get_selection: {
			description: "Get the text currently selected in the editor.",
			parameters: { type: "object", properties: {} },
			run() {
				const editor = deps.getEditor();
				if (!editor) return { error: "No editor available." };
				const { from, to } = editor.state.selection.main;
				return { from, to, text: editor.state.doc.sliceString(from, to) };
			},
		},
		list_open_files: {
			description: "List every file open in editor tabs.",
			parameters: { type: "object", properties: {} },
			run() {
				return { files: deps.getOpenFiles().map(describeFile) };
			},
		},
		switch_to_file: {
			description: "Make an already-open tab the active file, by its id.",
			parameters: {
				type: "object",
				properties: { id: { type: "string" } },
				required: ["id"],
			},
			run({ id }) {
				const file = deps.getOpenFiles().find((f) => f.id === id);
				if (!file) return { error: `No open file with id ${id}.` };
				deps.switchFile(file);
				return { ok: true, file: describeFile(file) };
			},
		},
		replace_active_file: {
			description:
				"Replace the entire content of the active file with new content. Use for refactors and multi-line edits. The user must approve.",
			parameters: {
				type: "object",
				properties: { content: { type: "string" } },
				required: ["content"],
			},
			async run({ content }) {
				const file = deps.getActiveFile();
				const editor = deps.getEditor();
				if (!file || !editor) return { error: "No file is open." };
				if (typeof content !== "string") return { error: "content required." };
				const approved = await deps.confirm(
					"Acodex AI",
					`Substituir o conteúdo de "${file.filename ?? file.name}"?`,
				);
				if (!approved) return { error: "User rejected the change." };
				editor.dispatch({
					changes: { from: 0, to: editor.state.doc.length, insert: content },
				});
				return { ok: true };
			},
		},
		insert_text: {
			description:
				"Insert text at the cursor, replacing the current selection if any.",
			parameters: {
				type: "object",
				properties: { text: { type: "string" } },
				required: ["text"],
			},
			run({ text }) {
				const editor = deps.getEditor();
				if (!editor) return { error: "No editor available." };
				if (typeof text !== "string") return { error: "text required." };
				const { from, to } = editor.state.selection.main;
				editor.dispatch({
					changes: { from, to, insert: text },
					selection: { anchor: from + text.length },
				});
				return { ok: true };
			},
		},
		create_file: {
			description: "Create a new unsaved editor tab with a name and content.",
			parameters: {
				type: "object",
				properties: {
					name: { type: "string" },
					content: { type: "string" },
				},
				required: ["name"],
			},
			run({ name, content = "" }) {
				if (!name || /[\\/:*?"<>|]/.test(name)) {
					return { error: "Invalid file name." };
				}
				deps.createFile(name, String(content));
				return { ok: true };
			},
		},
		open_file: {
			description: "Open a file from the device or project by its uri.",
			parameters: {
				type: "object",
				properties: { uri: { type: "string" } },
				required: ["uri"],
			},
			async run({ uri }) {
				if (!uri) return { error: "uri required." };
				await deps.openFile(uri);
				return { ok: true };
			},
		},
		search_open_files: {
			description:
				"Search for a text (or regular expression) across all open editor files. Returns the file, line number and matching line for each hit (max 40).",
			parameters: {
				type: "object",
				properties: {
					query: { type: "string", description: "Text or regex to find." },
					regex: {
						type: "boolean",
						description: "Treat the query as a regular expression.",
					},
				},
				required: ["query"],
			},
			run({ query, regex = false }) {
				if (!query) return { error: "query required." };
				let matcher = null;
				if (regex) {
					try {
						matcher = new RegExp(query, "gi");
					} catch {
						return { error: "Invalid regular expression." };
					}
				}
				const needle = query.toLowerCase();
				const results = [];
				for (const file of deps.getOpenFiles()) {
					if (file.type !== "editor") continue;
					let text = "";
					try {
						text = String(file.session?.doc ?? "");
					} catch {
						continue;
					}
					const lines = text.split("\n");
					for (let i = 0; i < lines.length; i++) {
						const hit = matcher
							? matcher.test(lines[i])
							: lines[i].toLowerCase().includes(needle);
						if (hit) {
							results.push({
								file: file.filename ?? file.name,
								line: i + 1,
								text: lines[i].slice(0, 200),
							});
							if (results.length >= 40) return { results, truncated: true };
						}
						if (matcher) matcher.lastIndex = 0;
					}
				}
				return { results, truncated: false };
			},
		},
		list_commands: {
			description:
				"List Acodex app commands that can be run with run_command (themes, panes, search, terminal, save, format, etc.).",
			parameters: { type: "object", properties: {} },
			run() {
				return {
					commands: deps.listCommands().filter((c) => !BLOCKED_COMMANDS.has(c)),
				};
			},
		},
		run_command: {
			description:
				"Run an Acodex app command by name. Call list_commands first if unsure.",
			parameters: {
				type: "object",
				properties: { command: { type: "string" } },
				required: ["command"],
			},
			async run({ command }) {
				if (BLOCKED_COMMANDS.has(command)) {
					return { error: `Command "${command}" is not allowed.` };
				}
				if (!deps.listCommands().includes(command)) {
					return { error: `Unknown command "${command}".` };
				}
				await deps.execCommand(command);
				return { ok: true };
			},
		},
		list_skills: {
			description:
				"List the available Acodex AI skills (reusable task playbooks) with their names and descriptions.",
			parameters: { type: "object", properties: {} },
			run() {
				if (!deps.skills) return { error: "Skills are not available." };
				return {
					skills: deps.skills.skills.map((skill) => ({
						name: skill.name,
						description: skill.description,
					})),
				};
			},
		},
		load_skill: {
			description:
				"Load the full instructions of a skill by name. Call this before applying a skill and follow its instructions exactly.",
			parameters: {
				type: "object",
				properties: {
					name: {
						type: "string",
						description: "Skill name, as returned by list_skills.",
					},
				},
				required: ["name"],
			},
			run({ name }) {
				if (!deps.skills) return { error: "Skills are not available." };
				if (!deps.skills.has(name)) {
					return {
						error: `Unknown skill "${name}". Call list_skills for the catalog.`,
					};
				}
				const skill = deps.skills.get(name);
				return {
					name: skill.name,
					description: skill.description,
					instructions: skill.instructions,
				};
			},
		},
	};

	return {
		/** OpenAI-compatible tool definitions (reflete o estado atual do registry). */
		get definitions() {
			return Object.entries(tools).map(([name, tool]) => ({
				type: "function",
				function: {
					name,
					description: tool.description,
					parameters: tool.parameters,
				},
			}));
		},
		/**
		 * Registra uma tool em tempo de execução (ex.: tools de um servidor MCP).
		 * @param {string} name
		 * @param {{description: string, parameters: object, run: (args: any) => any}} tool
		 */
		registerTool(name, tool) {
			tools[name] = tool;
		},

		/**
		 * Remove uma tool registrada dinamicamente.
		 * @param {string} name
		 */
		removeTool(name) {
			delete tools[name];
		},

		/**
		 * @param {string} name
		 * @param {string} rawArgs JSON string from the model
		 * @returns {Promise<object>}
		 */
		async execute(name, rawArgs) {
			const tool = tools[name];
			if (!tool) return { error: `Unknown tool "${name}".` };
			let args = {};
			try {
				args = rawArgs ? JSON.parse(rawArgs) : {};
			} catch {
				return { error: "Arguments were not valid JSON." };
			}
			try {
				return (await tool.run(args)) ?? { ok: true };
			} catch (error) {
				return { error: error?.message || String(error) };
			}
		},
	};
}
