/**
 * AI inline completion (ghost text) for CodeMirror 6.
 * Shows gray completion suggestions after the cursor and accepts them with Tab.
 *
 * Pure helpers are exported for unit tests; the CM6 wiring is below.
 */
import { Prec, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, keymap, WidgetType } from "@codemirror/view";
import { createChatCompletion, withBuiltinKey } from "lib/acodexAi/client";
import appSettings from "lib/settings";
import { getFallbackModels } from "sidebarApps/aiChat/fallbackModels";

const TRIGGER_IDLE_MS = 900;
const MAX_CONTEXT_CHARS = 1500;
const MAX_GHOST_LINES = 6;

/** @typedef {{text: string, pos: number, timestamp: number}} GhostData */

export const setGhost = StateEffect.define();
export const clearGhost = StateEffect.define();

export const ghostField = StateField.define({
	create: () => null,
	update(ghost, transaction) {
		for (const effect of transaction.effects) {
			if (effect.is(setGhost)) return effect.value;
			if (effect.is(clearGhost)) return null;
		}
		if (transaction.docChanged || transaction.selection) return null;
		return ghost;
	},
});

class GhostWidget extends WidgetType {
	/** @param {string} text */
	constructor(text) {
		super();
		this.text = text;
	}

	eq(other) {
		return other instanceof GhostWidget && other.text === this.text;
	}

	toDOM() {
		const span = document.createElement("span");
		span.className = "cm-ai-ghost";
		span.textContent = this.text;
		span.setAttribute("aria-label", "AI suggestion");
		return span;
	}

	ignoreEvent() {
		return true;
	}
}

export const ghostDecorations = EditorView.decorations.compute(
	[ghostField],
	(state) => {
		const ghost = state.field(ghostField, false);
		if (!ghost || ghost.pos > state.doc.length) return Decoration.none;
		const widget = Decoration.widget({
			widget: new GhostWidget(ghost.text),
			side: 1,
		});
		return Decoration.set([widget.range(ghost.pos)]);
	},
);

/**
 * Builds the user prompt sent to the model.
 * @param {string} before Text before the cursor (context)
 * @param {string} filename Current file name
 * @returns {string}
 */
export function buildCompletionPrompt(before, filename) {
	return `You are an inline code completion engine for file "${filename}".
Continue the code at the cursor position marked by <|cursor|>.
Rules:
- Reply with ONLY the code that comes next, no explanations, no markdown fences.
- Keep it short: at most ${MAX_GHOST_LINES} lines.
- Match the existing style, indentation and language.
- If nothing clearly comes next, reply with an empty string.

Code before the cursor:
${before.slice(-MAX_CONTEXT_CHARS)}<|cursor|>`;
}

/**
 * Extracts the ghost text from a model response.
 * @param {string} content Model output
 * @returns {string} cleaned text, at most MAX_GHOST_LINES lines
 */
export function extractGhostText(content) {
	let text = String(content ?? "").trim();
	if (!text) return "";
	// strip markdown fences if the model added them anyway
	if (text.startsWith("```")) {
		text = text.replace(/^```[^\n]*\n?/, "").replace(/```\s*$/, "");
	}
	const lines = text.split("\n").slice(0, MAX_GHOST_LINES);
	return lines.join("\n").trimEnd();
}

/**
 * Whether a completion request should be triggered for the given editor state.
 * @param {{pos: number, lineText: string}} context
 * @returns {boolean}
 */
export function shouldTrigger({ pos, lineText }) {
	if (pos === 0 && !lineText) return false;
	// do not trigger in the middle of a word
	const charAfter = lineText.slice(pos);
	if (charAfter && /\w/.test(charAfter[0])) return false;
	return true;
}

/**
 * Requests a completion from the configured AI provider.
 * @param {string} before
 * @param {string} filename
 * @returns {Promise<string>} ghost text ("" when nothing useful)
 */
export async function requestCompletion(before, filename) {
	const { aiBaseUrl, aiApiKey, aiModel } = appSettings.value;
	const config = withBuiltinKey({
		baseUrl: aiBaseUrl,
		apiKey: aiApiKey,
		model: aiModel,
	});
	if (!config.apiKey?.trim()) return "";
	try {
		const message = await createChatCompletion({
			config,
			messages: [
				{ role: "user", content: buildCompletionPrompt(before, filename) },
			],
			max_tokens: 120,
			fallbackModels: getFallbackModels(config),
		});
		return extractGhostText(message.content || "");
	} catch (error) {
		console.warn("[aiGhost] request failed:", error?.message);
		return "";
	}
}

/** @type {EditorView|null} */
let currentView = null;
let triggerTimer = null;
let generation = 0;

function cancelPendingTrigger() {
	if (triggerTimer) {
		clearTimeout(triggerTimer);
		triggerTimer = null;
	}
	generation++;
}

function scheduleTrigger(view) {
	cancelPendingTrigger();
	const myGeneration = ++generation;
	triggerTimer = setTimeout(async () => {
		if (generation !== myGeneration) return;
		const state = view.state;
		if (!appSettings.value.aiGhostText) return;
		const pos = state.selection.main.head;
		const line = state.doc.lineAt(pos);
		const lineText = line.text;
		const cursorInLine = pos - line.from;
		if (!shouldTrigger({ pos: cursorInLine, lineText })) return;

		const before = state.sliceDoc(Math.max(0, pos - MAX_CONTEXT_CHARS), pos);
		const filename = window.editorManager?.activeFile?.filename || "untitled";
		const ghostText = await requestCompletion(before, filename);
		if (generation !== myGeneration) return; // stale
		if (!ghostText) return;
		const nowPos = view.state.selection.main.head;
		if (nowPos !== pos) return; // cursor moved
		view.dispatch({ effects: setGhost.of({ text: ghostText, pos }) });
	}, TRIGGER_IDLE_MS);
}

/**
 * Accepts the ghost suggestion, if any.
 * @param {EditorView} view
 * @returns {boolean} handled
 */
export function acceptGhost(view) {
	const ghost = view.state.field(ghostField, false);
	if (!ghost) return false;
	view.dispatch({
		changes: { from: ghost.pos, insert: ghost.text },
		selection: { anchor: ghost.pos + ghost.text.length },
		effects: clearGhost.of(null),
	});
	return true;
}

/**
 * Dismisses the ghost suggestion.
 * @param {EditorView} view
 * @returns {boolean} handled
 */
export function dismissGhost(view) {
	if (!view.state.field(ghostField, false)) return false;
	view.dispatch({ effects: clearGhost.of(null) });
	return true;
}

/**
 * Creates the full CM6 extension bundle for AI ghost text.
 * @returns {import("@codemirror/state").Extension}
 */
export function aiInlineCompletion() {
	return [
		ghostField,
		ghostDecorations,
		Prec.high(
			keymap.of([
				{ key: "Tab", run: acceptGhost },
				{ key: "Escape", run: dismissGhost },
			]),
		),
		EditorView.updateListener.of((update) => {
			if (!appSettings.value.aiGhostText) return;
			if (update.docChanged || update.selectionSet) {
				currentView = update.view;
				scheduleTrigger(update.view);
			}
		}),
	];
}

export default aiInlineCompletion;
