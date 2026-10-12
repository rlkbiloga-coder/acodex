import { describe, expect, it, vi } from "vitest";
import {
	checkPermission,
	detectSdk,
	ensureDevicePermission,
	getPermission,
	getPermissionStatuses,
	isApplicable,
	PERMISSIONS,
	requestPermission,
} from "../../src/lib/devicePermissions";
import { buildPermissionItems } from "../../src/settings/permissionsSettings";

vi.mock("components/settingsPage", () => ({ default: vi.fn() }));
vi.mock("lib/devicePermissions", async (orig) => orig());

function fakeSystem(granted = new Set()) {
	return {
		hasPermission: (name, ok) => ok(granted.has(name) ? 1 : 0),
		requestPermissions: (names, ok) => {
			for (const name of names) granted.add(name);
			ok([]);
		},
	};
}

describe("devicePermissions", () => {
	it("cobre microfone, câmera, mídia, armazenamento e notificações", () => {
		expect(PERMISSIONS.map((p) => p.id)).toEqual([
			"microphone",
			"camera",
			"media",
			"storage",
			"notifications",
		]);
	});

	it("filtra por versão do Android", () => {
		expect(isApplicable(getPermission("media"), 33)).toBe(true);
		expect(isApplicable(getPermission("media"), 30)).toBe(false);
		expect(isApplicable(getPermission("storage"), 33)).toBe(false);
		expect(isApplicable(getPermission("storage"), 30)).toBe(true);
	});

	it("detecta SDK pelo user agent", () => {
		expect(detectSdk("Mozilla/5.0 (Linux; Android 14; X)")).toBe(34);
		expect(detectSdk("Mozilla/5.0 (Linux; Android 11; X)")).toBe(30);
		expect(detectSdk("sem android")).toBe(33);
	});

	it("check devolve denied, depois granted após pedir", async () => {
		const system = fakeSystem();
		const mic = getPermission("microphone");
		expect(await checkPermission(mic, system, 33)).toBe("denied");
		expect(await requestPermission(mic, system, 33)).toBe("granted");
	});

	it("media exige as três permissões", async () => {
		const system = fakeSystem(new Set(["android.permission.READ_MEDIA_IMAGES"]));
		expect(await checkPermission(getPermission("media"), system, 33)).toBe(
			"denied",
		);
	});

	it("sem plugin system fica unavailable e ensure libera", async () => {
		expect(await checkPermission(getPermission("camera"), null)).toBe(
			"unavailable",
		);
		expect(await ensureDevicePermission("camera", null)).toBe(true);
		expect(await ensureDevicePermission("inexistente", null)).toBe(false);
	});

	it("lista status e monta a lista da tela", async () => {
		const system = fakeSystem(new Set(["android.permission.RECORD_AUDIO"]));
		const statuses = await getPermissionStatuses(system, 34);
		expect(statuses.map((s) => s.id)).toEqual([
			"microphone",
			"camera",
			"media",
			"notifications",
		]);
		const items = buildPermissionItems(statuses);
		expect(items[0]).toMatchObject({ key: "microphone", chevron: false });
		expect(items[1]).toMatchObject({ key: "camera", chevron: true });
	});
});
