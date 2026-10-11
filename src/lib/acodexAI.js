/**
 * AcodeX IA — Copyright (c) 2026 mlk010173.
 * Licensed under the AcodeX IA License — see LICENSE-ACODEX-IA.
 * Personal and non-commercial use is allowed with attribution.
 * Any other use, copying, modification or distribution requires
 * prior written permission from the copyright holder.
 */

import select from "dialogs/select";

/**
 * AcodeX IA — AI coding agent launcher.
 *
 * Opens a picker with the supported AI coding agents, creates a terminal
 * session and, inside the sandbox, installs the agent (if missing) and
 * starts it. Non-interactive agents are never auto-installed twice:
 * the generated command checks for the binary first.
 */

/**
 * @typedef {Object} AiAgent
 * @property {string} name Display name shown in the picker.
 * @property {string} bin Binary used to start the agent.
 * @property {string} description Short description shown in the picker.
 * @property {string} install Shell command that installs the agent
 *   inside the Alpine sandbox when the binary is missing.
 */

/** @type {AiAgent[]} */
export const AI_AGENTS = [
	{
		name: "Claude Code",
		bin: "claude",
		description: "Anthropic coding agent",
		install: "npm install -g @anthropic-ai/claude-code",
	},
	{
		name: "OpenAI Codex",
		bin: "codex",
		description: "OpenAI coding agent",
		install: "npm install -g @openai/codex",
	},
	{
		name: "Gemini CLI",
		bin: "gemini",
		description: "Google AI coding agent",
		install: "npm install -g @google/gemini-cli",
	},
	{
		name: "OpenCode",
		bin: "opencode",
		description: "Open source coding agent",
		install: "npm install -g opencode-ai",
	},
	{
		name: "Crush",
		bin: "crush",
		description: "Charm coding agent",
		install: "npm install -g @charmbracelet/crush",
	},
	{
		name: "Aider",
		bin: "aider",
		description: "AI pair programming (Python)",
		install:
			"apk add -q python3 py3-pip >/dev/null 2>&1; python3 -m pip install --break-system-packages aider-chat",
	},
];

/**
 * Builds the shell command that ensures the agent is installed and runs it.
 * @param {AiAgent} agent
 * @returns {string}
 */
export function buildAgentCommand(agent) {
	return `command -v ${agent.bin} >/dev/null 2>&1 || { ${agent.install}; }; ${agent.bin}`;
}

/**
 * Waits until the terminal component is connected to its process.
 * @param {object} component Terminal component
 * @param {number} [timeout] Milliseconds to wait, defaults to 15000
 * @returns {Promise<boolean>} Whether the component got connected
 */
async function waitForConnection(component, timeout = 15000) {
	const deadline = Date.now() + timeout;
	while (!component.isConnected && Date.now() < deadline) {
		// eslint-disable-next-line no-await-in-loop
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	return component.isConnected === true;
}

/**
 * Launches an agent in a new terminal session.
 * @param {AiAgent} agent
 * @returns {Promise<void>}
 */
export async function launchAiAgent(agent) {
	const { TerminalManager } = await import(
		/* webpackChunkName: "terminal" */ "components/terminal"
	);
	const instance = await TerminalManager.createServerTerminal({
		name: agent.name,
	});
	const component = instance?.component;
	if (!component) {
		throw new Error("Terminal component is not available");
	}
	const connected = await waitForConnection(component);
	if (!connected) {
		throw new Error("Terminal session did not connect in time");
	}
	component.write(`${buildAgentCommand(agent)}\r`);
}

/**
 * Opens the AcodeX IA agent picker and launches the selected agent.
 * @returns {Promise<void>}
 */
export default async function acodexAI() {
	const agentName = await select(
		strings["acodex ia agent"] || "AcodeX IA: choose an AI agent",
		AI_AGENTS.map((agent) => ({
			value: agent.name,
			text: agent.name,
			subText: agent.description,
		})),
		{ hideOnSelect: true },
	);
	const agent = AI_AGENTS.find(({ name }) => name === agentName);
	if (!agent) return;
	await launchAiAgent(agent);
}
