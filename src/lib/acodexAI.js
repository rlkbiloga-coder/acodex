/**
 * AcodeX IA — Copyright (c) 2026 mlk010173.
 * Licensed under the AcodeX IA License — see LICENSE-ACODEX-IA.
 * Personal and non-commercial use is allowed with attribution.
 * Any other use, copying, modification or distribution requires
 * prior written permission from the copyright holder.
 */

import select from "dialogs/select";
import { AGENT_REGISTRY, TIER_LABEL, buildApiHelperInstall } from "lib/acodexAgents";

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
	return `command -v ${agent.bin} >/dev/null 2>&1 || { ${agent.install}; }; ${agent.bin}`;
}

/**
 * Builds the shell command that installs the helper of an API agent.
 * @param {object} agent Entrada do registro com kind "api"
 * @returns {string}
 */
export function buildApiAgentCommand(agent) {
	const hint =
		`echo '${agent.script} pronto: ${agent.script} "sua mensagem para o agente"'`;
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
 * Launches an agent in a new terminal session.
 * @param {object} agent Entrada do registro (qualquer kind)
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
	const cmd =
		agent.kind === "api"
			? buildApiAgentCommand(agent)
			: buildAgentCommand(agent);
	component.write(`${cmd}\r`);
}

/**
 * Opens the AcodeX IA agent picker and launches the selected agent.
 * @returns {Promise<void>}
 */
export default async function acodexAI() {
	const agents = Object.values(AGENT_REGISTRY);
	const agentName = await select(
		strings["acodex ia agent"] || "AcodeX IA: choose an AI agent",
		agents.map((agent) => ({
			value: agent.name,
			text: agent.name,
			subText: `${agent.description} [${TIER_LABEL[agent.tier]}]`,
		})),
		{ hideOnSelect: true },
	);
	const agent = agents.find(({ name }) => name === agentName);
	if (!agent) return;
	await launchAiAgent(agent);
}
