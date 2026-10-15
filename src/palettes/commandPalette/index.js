import { executeCommand, getRegisteredCommands } from "cm/commandRegistry";
import { focusEditorIfEditable } from "cm/editorReadOnly";
import palette from "components/palette";
import Fuse from "fuse.js";
import helpers from "utils/helpers";

/**
 * Paleta de comandos do Acodex.
 *
 * Busca fuzzy via Fuse.js (open source) sobre nome + descrição de todos
 * os comandos registrados, com os recentes primeiro quando a caixa está
 * vazia. Aberta com Ctrl-K.
 */
export default async function commandPalette() {
	const recentCommands = RecentlyUsedCommands();
	const { editor } = editorManager;
	const wasFocused = editor?.hasFocus ?? false;

	palette(
		generateHints,
		onselect,
		strings["type command"],
		() => {
			if (wasFocused && editor) focusEditorIfEditable(editor);
		},
		{ dynamic: true },
	);

	function hintItem({ name, description, key, recentlyUsed }) {
		const keyLabel = key ? key.split("|")[0] : "";
		return {
			value: name,
			text: `<span ${
				recentlyUsed ? `data-str='${strings["recently used"]}'` : ""
			}>${description ?? name}</span><small>${keyLabel}</small>`,
		};
	}

	function generateHints(hintModification, query) {
		const registeredCommands = getRegisteredCommands();

		// caixa vazia: recentes primeiro, depois o resto na ordem de registro
		if (!query) {
			const recent = recentCommands.commands
				.map((name) => registeredCommands.find((c) => c.name === name))
				.filter(Boolean)
				.map((c) => ({ ...c, recentlyUsed: true }));
			const rest = registeredCommands
				.filter((c) => !recentCommands.commands.includes(c.name))
				.map((c) => ({ ...c, recentlyUsed: false }));
			return [...recent, ...rest].map(hintItem);
		}

		// com texto: pontuação fuzzy do Fuse.js em nome + descrição
		const fuse = new Fuse(registeredCommands, {
			keys: ["name", "description"],
			threshold: 0.4,
			ignoreLocation: true,
		});
		return fuse.search(query).map(({ item }) =>
			hintItem({
				...item,
				recentlyUsed: recentCommands.commands.includes(item.name),
			}),
		);
	}

	function onselect(value) {
		const executed = executeCommand(value, editorManager.editor);
		if (executed) recentCommands.push(value);
	}
}

function RecentlyUsedCommands() {
	return {
		/**
		 * @returns {string[]}
		 */
		get commands() {
			return (
				helpers.parseJSON(localStorage.getItem("recentlyUsedCommands")) || []
			);
		},
		/**
		 * Saves command to recently used commands
		 * @param {string} command Command name
		 * @returns {void}
		 */
		push(command) {
			const { commands } = this;
			const index = commands.indexOf(command);
			if (index === -1) {
				commands.unshift(command);
			} else {
				commands.unshift(...commands.splice(index, 1));
			}
			if (commands.length > 10) {
				commands.pop();
			}
			localStorage.setItem("recentlyUsedCommands", JSON.stringify(commands));
		},
	};
}
