import settingsPage from "components/settingsPage";
import {
	getPermission,
	getPermissionStatuses,
	requestPermission,
} from "lib/devicePermissions";

const STATUS_LABEL = {
	granted: "Concedida",
	denied: "Toque para permitir",
	unavailable: "Indisponível neste ambiente",
};

/**
 * Monta os itens da página a partir do estado atual das permissões.
 * @param {Array<{id: string, label: string, reason: string, status: string}>} statuses
 */
export function buildPermissionItems(statuses) {
	return statuses.map((item) => ({
		key: item.id,
		text: item.label,
		info: `${item.reason} ${STATUS_LABEL[item.status] ?? ""}`.trim(),
		icon: item.status === "granted" ? "check_circle" : "error_outline",
		chevron: item.status !== "granted",
	}));
}

/**
 * Página "Permissões do dispositivo": mostra o estado de cada permissão
 * que o AcodeX usa e permite pedir as que faltam.
 */
export default async function permissionsSettings() {
	const sys = globalThis.system;
	const statuses = await getPermissionStatuses(sys);

	const show = (list) => {
		const page = settingsPage(
			"Permissões do AcodeX",
			buildPermissionItems(list),
			async (key) => {
				const def = getPermission(key);
				if (!def) return;
				await requestPermission(def, sys);
				page.hide();
				permissionsSettings();
			},
			"separate",
			{
				preserveOrder: true,
				pageClassName: "detail-settings-page",
				listClassName: "detail-settings-list",
				groupByDefault: true,
			},
		);
		page.show();
	};
	show(statuses);
}
