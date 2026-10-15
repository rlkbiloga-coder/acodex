import toast from "components/toast";
import {
	ensureSession,
	getClient,
	getSessionId,
	setSessionId,
} from "lib/acodexAi/liveBrowser";
import actionStack from "lib/actionStack";
import appSettings from "lib/settings";
import { createIcon } from "./homeScreen";

/**
 * Painel do Live Browser no chat do Acodex IA.
 *
 * Adaptação do frontend-example do starter para dentro do app: URL bar,
 * screenshot em tempo real, status e configuração do servidor open source
 * (server/live-browser). A sessão é compartilhada com as tools do agente
 * (browser_navigate e cia.), então o usuário vê o que a IA está fazendo.
 */

/**
 * @param {object} [options]
 * @param {(message: string) => void} [options.toastImpl]
 * @returns {{ $btn: HTMLButtonElement, open: () => void }}
 */
export function createBrowserPanel(options = {}) {
	const notify = options.toastImpl || ((message) => toast(message));
	let $panel = null;

	const $btn = (
		<button
			type="button"
			className="ai-send ai-attach"
			aria-label="Navegador IA"
			title="Navegador IA (servidor próprio)"
			onclick={open}
		/>
	);
	$btn.append(createIcon("globe", 16));

	function readConfigInputs($url, $token) {
		return {
			liveBrowserUrl: $url.value.trim(),
			liveBrowserToken: $token.value.trim(),
		};
	}

	async function saveConfig($url, $token) {
		try {
			await appSettings.update(readConfigInputs($url, $token), false);
			notify("Servidor Live Browser salvo.");
			return true;
		} catch {
			notify("Não foi possível salvar a configuração.");
			return false;
		}
	}

	function clientOrNull() {
		const client = getClient(appSettings);
		if (!client) {
			notify(
				"Configure a URL do servidor Live Browser primeiro (veja server/live-browser).",
			);
			return null;
		}
		return client;
	}

	async function refreshScreenshot($img, $status) {
		const client = clientOrNull();
		if (!client) return;
		$status.textContent = "Carregando...";
		try {
			const { id } = await ensureSession(client);
			$img.src = await client.screenshotDataUrl(id);
			const state = await client.getState(id);
			$status.textContent = `${state.title || state.url}`;
			$img.classList.remove("empty");
		} catch (error) {
			$status.textContent = error.message;
		}
	}

	async function navigate($urlInput, $img, $status) {
		const client = clientOrNull();
		if (!client) return;
		const target = $urlInput.value.trim();
		if (!target) return;
		$status.textContent = "Navegando...";
		try {
			const { id } = await ensureSession(client);
			const result = await client.navigate(
				id,
				/^[a-z]+:\/\//i.test(target) ? target : `https://${target}`,
			);
			$status.textContent =
				result?.state?.title || result?.state?.url || "Pronto";
			await refreshScreenshot($img, $status);
		} catch (error) {
			$status.textContent = error.message;
		}
	}

	async function closeSession($img, $status) {
		const client = clientOrNull();
		if (!client) return;
		const id = getSessionId();
		if (!id) return;
		try {
			await client.close(id);
		} catch {
			// sessão já pode ter expirado; seguir em frente
		}
		setSessionId(null);
		$img.removeAttribute("src");
		$img.classList.add("empty");
		$status.textContent = "Sessão encerrada.";
	}

	function open() {
		if ($panel) return;
		const { liveBrowserUrl = "", liveBrowserToken = "" } =
			appSettings.value || {};
		const $serverUrl = (
			<input
				type="url"
				placeholder="http://192.168.1.20:3000"
				value={liveBrowserUrl}
				aria-label="URL do servidor Live Browser"
			/>
		);
		const $serverToken = (
			<input
				type="password"
				placeholder="Token (se ativo no servidor)"
				value={liveBrowserToken}
				aria-label="Token do servidor Live Browser"
			/>
		);
		const $status = (
			<span className="lb-status">
				Servidor: {liveBrowserUrl || "não configurado"}
			</span>
		);
		const $urlInput = (
			<input
				type="text"
				placeholder="Endereço ou termo de busca"
				enterKeyHint="go"
				aria-label="Endereço para abrir"
			/>
		);
		const $img = (
			<img className="lb-shot empty" alt="Screenshot do navegador remoto" />
		);
		$img.addEventListener("load", () => $img.classList.remove("empty"));

		const $closeBtn = (
			<button type="button" className="lb-close" aria-label="Fechar">
				{createIcon("chevron", 18)}
			</button>
		);
		$closeBtn.addEventListener("click", remove);

		const $navBtn = (
			<button type="button" className="lb-action primary">
				Abrir
			</button>
		);
		$navBtn.addEventListener("click", () => navigate($urlInput, $img, $status));
		$urlInput.addEventListener("keydown", (event) => {
			if (event.key === "Enter") navigate($urlInput, $img, $status);
		});

		const $shotBtn = (
			<button type="button" className="lb-action">
				Screenshot
			</button>
		);
		$shotBtn.addEventListener("click", () => refreshScreenshot($img, $status));

		const $endBtn = (
			<button type="button" className="lb-action">
				Encerrar sessão
			</button>
		);
		$endBtn.addEventListener("click", () => closeSession($img, $status));

		const $saveBtn = (
			<button type="button" className="lb-action">
				Salvar servidor
			</button>
		);
		$saveBtn.addEventListener("click", () =>
			saveConfig($serverUrl, $serverToken),
		);

		$panel = (
			<div className="lb-overlay" role="dialog" aria-label="Navegador IA">
				<div className="lb-panel">
					<div className="lb-header">
						{createIcon("globe", 20)}
						<span className="lb-title">Navegador IA</span>
						{$closeBtn}
					</div>
					<div className="lb-config">
						{$serverUrl}
						{$serverToken}
						{$saveBtn}
					</div>
					<div className="lb-bar">
						{$urlInput}
						{$navBtn}
					</div>
					<div className="lb-shot-container">{$img}</div>
					<div className="lb-footer">
						{$status}
						<span className="lb-actions">
							{$shotBtn}
							{$endBtn}
						</span>
					</div>
				</div>
			</div>
		);

		app.append($panel);
		actionStack.push({ id: "live-browser-panel", action: remove });
	}

	function remove() {
		if (!$panel) return;
		actionStack.remove("live-browser-panel");
		$panel.remove();
		$panel = null;
	}

	return { $btn, open };
}
