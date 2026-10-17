/**
 * AcodeX IA — Copyright (c) 2026 mlk010173.
 * Licensed under the AcodeX IA License — see LICENSE-ACODEX-IA.
 * Personal and non-commercial use is allowed with attribution.
 * Any other use, copying, modification or distribution requires
 * prior written permission from the copyright holder.
 */

import select from "dialogs/select";
import {
	AGENT_REGISTRY,
	buildApiHelperInstall,
	TIER_LABEL,
} from "lib/acodexAgents";
import iaThumb from "./acodexAi/acodex-ia-thumb.jpg?inline";

/**
 * AcodeX IA — AI coding agent launcher.
 *
 * Tudo é lido do REGISTRO ÚNICO em lib/acodexAgents.js:
 * para adicionar ou remover um agente, altere apenas aquele arquivo.
 * O seletor abre um terminal e, dentro do sandbox, garante que o
 * agente esteja instalado antes de iniciá-lo. Agentes de API instalam
 * um helper discreto (um único script) que fala com o serviço externo.
 */

/**
 * Builds the shell command that ensures a CLI agent is installed and runs it.
 * @param {object} agent Entrada do registro com kind "cli"
 * @returns {string}
 */
export function buildAgentCommand(agent) {
	return `command -v ${agent.bin} >/dev/null 2>&1 || { ${agent.install}; }; ${agent.bin}${agent.args ? ` ${agent.args}` : ""}`;
}

/**
 * Builds the shell command that installs the helper of an API agent.
 * @param {object} agent Entrada do registro com kind "api"
 * @returns {string}
 */
export function buildApiAgentCommand(agent) {
	const hint = `echo '${agent.script} pronto: ${agent.script} "sua mensagem para o agente"'`;
	return `${buildApiHelperInstall(agent)}; ${hint}`;
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
 * Opens a new terminal session and runs a shell command in the sandbox.
 * @param {string} name Título da sessão de terminal
 * @param {string} cmd Comando shell a executar
 * @returns {Promise<void>}
 */
export async function launchShellInTerminal(name, cmd) {
	const { TerminalManager } = await import(
		/* webpackChunkName: "terminal" */ "components/terminal"
	);
	const instance = await TerminalManager.createServerTerminal({ name });
	const component = instance?.component;
	if (!component) {
		throw new Error("Terminal component is not available");
	}
	const connected = await waitForConnection(component);
	if (!connected) {
		throw new Error("Terminal session did not connect in time");
	}
	component.write(`${cmd}\r`);
}

/**
 * Launches an agent in a new terminal session.
 * @param {object} agent Entrada do registro (qualquer kind)
 * @returns {Promise<void>}
 */
export async function launchAiAgent(agent) {
	const cmd =
		agent.kind === "api"
			? buildApiAgentCommand(agent)
			: buildAgentCommand(agent);
	await launchShellInTerminal(agent.name, cmd);
}

/**
 * Opens the AcodeX IA agent picker and launches the selected agent.
 * @returns {Promise<void>}
 */
export default async function acodexAI() {
	const agents = Object.values(AGENT_REGISTRY);
	const agentName = await select(
		strings["acodex ia agent"] || "AcodeX IA: choose an AI agent",
		agents.map((agent, index) => ({
			value: agent.name,
			text:
				index === 0
					? `<img src="${iaThumb}" width="28" height="28" style="vertical-align:middle;border-radius:6px;margin-right:8px" alt="">${agent.name}`
					: agent.name,
			subText: `${agent.description} [${TIER_LABEL[agent.tier]}]`,
		})),
		{ hideOnSelect: true },
	);
	const agent = agents.find(({ name }) => name === agentName);
	if (!agent) return;
	await launchAiAgent(agent);
}
