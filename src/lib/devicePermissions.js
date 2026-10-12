/**
 * Permissões do dispositivo usadas pelo AcodeX (microfone, câmera, mídia,
 * notificações, armazenamento). Camada fina sobre o plugin `system`
 * (hasPermission / requestPermission). As funções recebem o objeto `system`
 * por parâmetro para serem testáveis fora do app.
 */

/**
 * @typedef {Object} PermissionDef
 * @property {string} id identificador estável
 * @property {string} label nome exibido
 * @property {string} reason por que o AcodeX precisa dela
 * @property {string[]} android permissões Android equivalentes (qualquer uma concedida basta)
 * @property {number} [minSdk] SDK mínimo em que a permissão existe
 * @property {number} [maxSdk] SDK máximo em que a permissão existe
 */

/** @type {PermissionDef[]} */
export const PERMISSIONS = [
	{
		id: "microphone",
		label: "Microfone",
		reason: "Ditado por voz no chat de IA.",
		android: ["android.permission.RECORD_AUDIO"],
	},
	{
		id: "camera",
		label: "Câmera",
		reason: "Tirar foto e enviar para a IA analisar.",
		android: ["android.permission.CAMERA"],
	},
	{
		id: "media",
		label: "Fotos e mídia",
		reason: "Anexar imagens, vídeos e áudios aos projetos e à IA.",
		android: [
			"android.permission.READ_MEDIA_IMAGES",
			"android.permission.READ_MEDIA_VIDEO",
			"android.permission.READ_MEDIA_AUDIO",
		],
		minSdk: 33,
	},
	{
		id: "storage",
		label: "Armazenamento",
		reason: "Abrir e salvar arquivos de projeto.",
		android: [
			"android.permission.READ_EXTERNAL_STORAGE",
			"android.permission.WRITE_EXTERNAL_STORAGE",
		],
		maxSdk: 32,
	},
	{
		id: "notifications",
		label: "Notificações",
		reason: "Avisar quando processos do terminal terminarem.",
		android: ["android.permission.POST_NOTIFICATIONS"],
		minSdk: 33,
	},
];

/**
 * @param {string} id
 * @returns {PermissionDef | undefined}
 */
export function getPermission(id) {
	return PERMISSIONS.find((permission) => permission.id === id);
}

/**
 * Se a permissão é relevante na versão de Android informada.
 * @param {PermissionDef} def
 * @param {number} sdk nível de API do Android
 */
export function isApplicable(def, sdk) {
	if (def.minSdk && sdk < def.minSdk) return false;
	if (def.maxSdk && sdk > def.maxSdk) return false;
	return true;
}

/** Nível de API do Android lido do user agent (33 se desconhecido). */
export function detectSdk(userAgent = globalThis.navigator?.userAgent || "") {
	const match = /Android\s+(\d+)/i.exec(userAgent);
	if (!match) return 33;
	const release = Number(match[1]);
	// Android 13 = API 33; mapeamento aproximado para versões anteriores.
	if (release >= 13) return 20 + release;
	const map = { 12: 31, 11: 30, 10: 29, 9: 28, 8: 26, 7: 24, 6: 23 };
	return map[release] ?? 23;
}

/** Converte callback style do plugin em Promise. */
function call(fn, ...args) {
	return new Promise((resolve, reject) => {
		fn(...args, resolve, reject);
	});
}

/**
 * Consulta se a permissão está concedida (todas as permissões Android da
 * definição que se aplicam ao SDK atual).
 * @param {PermissionDef} def
 * @param {any} system plugin system do Cordova
 * @param {number} [sdk]
 * @returns {Promise<"granted" | "denied" | "unavailable">}
 */
export async function checkPermission(def, system, sdk = detectSdk()) {
	if (!system?.hasPermission) return "unavailable";
	if (!isApplicable(def, sdk)) return "granted";
	try {
		const results = await Promise.all(
			def.android.map((name) => call(system.hasPermission.bind(system), name)),
		);
		return results.every(Boolean) ? "granted" : "denied";
	} catch {
		return "unavailable";
	}
}

/**
 * Pede a permissão ao Android (só as que ainda não foram concedidas).
 * @param {PermissionDef} def
 * @param {any} system plugin system do Cordova
 * @param {number} [sdk]
 * @returns {Promise<"granted" | "denied" | "unavailable">}
 */
export async function requestPermission(def, system, sdk = detectSdk()) {
	if (!system?.requestPermissions) return "unavailable";
	if (!isApplicable(def, sdk)) return "granted";
	try {
		await call(system.requestPermissions.bind(system), def.android);
	} catch {
		// o usuário pode ter negado; o estado real vem da checagem abaixo
	}
	return checkPermission(def, system, sdk);
}

/**
 * Estado de todas as permissões aplicáveis.
 * @param {any} system
 * @param {number} [sdk]
 * @returns {Promise<Array<PermissionDef & {status: string}>>}
 */
export async function getPermissionStatuses(system, sdk = detectSdk()) {
	const applicable = PERMISSIONS.filter((def) => isApplicable(def, sdk));
	return Promise.all(
		applicable.map(async (def) => ({
			...def,
			status: await checkPermission(def, system, sdk),
		})),
	);
}

/**
 * Garante uma permissão antes de usar o recurso (ex.: microfone no ditado).
 * @param {string} id id em PERMISSIONS
 * @param {any} system
 * @returns {Promise<boolean>} true se concedida
 */
export async function ensureDevicePermission(id, system) {
	const def = getPermission(id);
	if (!def) return false;
	const current = await checkPermission(def, system);
	if (current === "granted") return true;
	if (current === "unavailable") return true; // web/sem plugin: deixa o navegador decidir
	return (await requestPermission(def, system)) === "granted";
}
