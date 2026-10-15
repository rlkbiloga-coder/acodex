/**
 * Acodex IA — cliente do Live Browser (open source, self-hosted).
 *
 * Fala com o backend `server/live-browser` (Express + Playwright, Docker).
 * Todas as funções puras (`normalizeServerUrl`, `parseEndpointError`) são
 * testáveis sem rede; a fábrica `createLiveBrowserClient` aceita um
 * `fetch` injetável para os testes.
 */

const DEFAULT_TIMEOUT_MS = 12_000;
const NAVIGATE_TIMEOUT_MS = 35_000;

/**
 * Normaliza a URL do servidor (http/https, sem barra final).
 * @param {string} raw
 * @returns {string}
 */
export function normalizeServerUrl(raw) {
	const trimmed = String(raw || "")
		.trim()
		.replace(/\/+$/, "");
	if (!trimmed) throw new Error("Informe a URL do servidor Live Browser.");
	const url = new URL(trimmed);
	if (!["http:", "https:"].includes(url.protocol)) {
		throw new Error("Use http:// ou https:// na URL do servidor.");
	}
	return trimmed;
}

/**
 * Extrai mensagem de erro de uma resposta JSON do backend.
 * @param {{status?: number, ok?: boolean, code?: string, error?: string}} data
 * @param {number} status
 * @returns {Error}
 */
export function parseEndpointError(data, status) {
	const message = data?.error || `Erro HTTP ${status}`;
	const error = new Error(message);
	error.status = status;
	error.code = data?.code || "HTTP_ERROR";
	return error;
}

/**
 * @param {object} options
 * @param {string} options.baseUrl Ex.: http://192.168.1.20:3000
 * @param {string} [options.token] Token enviado em x-acx-token
 * @param {typeof fetch} [options.fetchImpl] Injável para testes
 * @param {(patch: object) => Promise<void>} [options.onSaveConfig] Persiste URL/token
 * @returns {{
 *   request: (path: string, init?: RequestInit & {timeoutMs?: number}) => Promise<any>,
 *   createSession: () => Promise<{id: string, state: any}>,
 *   navigate: (id: string, url: string) => Promise<any>,
 *   getState: (id: string) => Promise<any>,
 *   screenshotDataUrl: (id: string) => Promise<string>,
 *   click: (id: string, selector: string, opts?: any) => Promise<any>,
 *   fill: (id: string, selector: string, value: string) => Promise<any>,
 *   close: (id: string) => Promise<any>,
 *   serverConfig: () => Promise<any>,
 * }}
 */
export function createLiveBrowserClient({
	baseUrl,
	token = "",
	fetchImpl = fetch,
	onSaveConfig = null,
}) {
	const root = normalizeServerUrl(baseUrl);

	/**
	 * @param {string} path
	 * @param {RequestInit & {timeoutMs?: number}} [init]
	 */
	async function request(path, init = {}) {
		const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const response = await fetchImpl(`${root}${path}`, {
				...rest,
				signal: controller.signal,
				headers: {
					"Content-Type": "application/json",
					...(token ? { "x-acx-token": token } : {}),
					...(rest.headers || {}),
				},
			});
			const contentType = response.headers?.get?.("content-type") || "";
			const data = contentType.includes("application/json")
				? await response.json()
				: null;
			if (!response.ok) throw parseEndpointError(data, response.status);
			return data;
		} catch (error) {
			if (error?.name === "AbortError") {
				throw new Error(
					"O servidor Live Browser não respondeu no tempo esperado.",
				);
			}
			if (error?.message?.includes("fetch failed")) {
				throw new Error(
					"Não foi possível conectar ao servidor Live Browser. Confira a URL.",
				);
			}
			throw error;
		} finally {
			clearTimeout(timer);
		}
	}

	async function screenshotDataUrl(id) {
		const response = await fetchImpl(`${root}/api/browser/${id}/screenshot`, {
			headers: token ? { "x-acx-token": token } : {},
		});
		if (!response.ok) {
			throw parseEndpointError(
				response.headers?.get?.("content-type")?.includes("json")
					? await response.json().catch(() => null)
					: null,
				response.status,
			);
		}
		const blob = await response.blob();
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(String(reader.result));
			reader.onerror = () => reject(new Error("Falha ao ler o screenshot."));
			reader.readAsDataURL(blob);
		});
	}

	return {
		request,
		serverConfig: () => request("/api/config"),
		createSession: () =>
			request("/api/browser/sessions", { method: "POST", body: "{}" }),
		navigate: (id, url) =>
			request(`/api/browser/${id}/navigate`, {
				method: "POST",
				body: JSON.stringify({ url }),
				timeoutMs: NAVIGATE_TIMEOUT_MS,
			}),
		getState: (id) => request(`/api/browser/${id}/state`),
		screenshotDataUrl,
		click: (id, selector, opts = {}) =>
			request(`/api/browser/${id}/click`, {
				method: "POST",
				body: JSON.stringify({ selector, ...opts }),
			}),
		fill: (id, selector, value) =>
			request(`/api/browser/${id}/fill`, {
				method: "POST",
				body: JSON.stringify({ selector, value }),
			}),
		close: (id) =>
			request(`/api/browser/${id}/close`, { method: "POST", body: "{}" }),
	};
}

/** Cache da sessão corrente (um navegador por app, MVP). */
let currentSessionId = null;

/**
 * Fábrica pronta para uso no app: lê as settings e devolve o client.
 * @param {{value: any, update: (patch: object, flag?: boolean) => Promise<void>}} appSettings
 * @returns {ReturnType<typeof createLiveBrowserClient> | null}
 */
export function getClient(appSettings) {
	const url = appSettings.value?.liveBrowserUrl;
	if (!url) return null;
	return createLiveBrowserClient({
		baseUrl: url,
		token: appSettings.value?.liveBrowserToken || "",
	});
}

/** @returns {string | null} */
export function getSessionId() {
	return currentSessionId;
}

/** @param {string | null} id */
export function setSessionId(id) {
	currentSessionId = id;
}

/**
 * Garante uma sessão aberta, reaproveitando a corrente.
 * @param {ReturnType<typeof createLiveBrowserClient>} client
 * @returns {Promise<{id: string, state: any}>}
 */
export async function ensureSession(client) {
	if (currentSessionId) {
		try {
			return {
				id: currentSessionId,
				state: await client.getState(currentSessionId),
			};
		} catch {
			setSessionId(null);
		}
	}
	const created = await client.createSession();
	setSessionId(created.id);
	return created;
}
