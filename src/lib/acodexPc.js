/**
 * AcodeX IA — Copyright (c) 2026 mlk010173.
 * Licensed under the AcodeX IA License — see LICENSE-ACODEX-IA.
 * Personal and non-commercial use is allowed with attribution.
 * Any other use, copying, modification or distribution requires
 * prior written permission from the copyright holder.
 */

import select from "dialogs/select";
import { buildGuiHelperInstall, SANDBOX_TOOLS } from "lib/acodexAgents";

/**
 * AcodeX PC — capacidades de "PC na nuvem" no sandbox do terminal.
 * Open-source e grátis: display virtual + VNC para programas de
 * janela, OpenCL (POCL) para processamento paralelo e build do APK
 * em CI grátis quando o ambiente suportar.
 */
export default async function acodexPc() {
	const tools = Object.values(SANDBOX_TOOLS);
	const toolName = await select(
		"AcodeX PC: capacidades do sandbox",
		tools.map((tool) => ({
			value: tool.name,
			text: tool.name,
			subText: tool.what,
		})),
		{ hideOnSelect: true },
	);
	if (!toolName) return;

	const { TerminalManager } = await import(
		/* webpackChunkName: "terminal" */ "components/terminal"
	);
	const instance = await TerminalManager.createServerTerminal({
		name: toolName,
	});
	const component = instance?.component;
	if (!component) {
		throw new Error("Terminal component is not available");
	}

	const isGui = toolName === SANDBOX_TOOLS.gui.name;
	const cmd = isGui
		? `${buildGuiHelperInstall()}; acodex-gui start`
		: `echo '${toolName}'; echo '${tools.find((t) => t.name === toolName).what}'; echo 'instale com:'; echo '  ${tools.find((t) => t.name === toolName).install}'; echo '${tools.find((t) => t.name === toolName).note}'`;
	component.write(`${cmd}\r`);
}
