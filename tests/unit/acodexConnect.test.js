import { describe, expect, it, vi } from "vitest";

// dialogs/select e lib/acodexAI usam JSX/DOM do app; o teste só valida o
// registro e o helper shell, então mockamos a camada de UI.
vi.mock("dialogs/select", () => ({ default: vi.fn() }));
vi.mock("lib/acodexAI", () => ({ launchShellInTerminal: vi.fn() }));
import {
	CONNECTORS,
	CONNECT_HELPER_INSTALL,
	buildConnectCommand,
} from "lib/acodexConnect";

describe("acodexConnect registry", () => {
	it("expõe os conectores pedidos com campos completos", () => {
		expect(CONNECTORS.map((c) => c.id)).toEqual([
			"github",
			"gmail",
			"whatsapp",
		]);
		for (const connector of CONNECTORS) {
			expect(connector.name).toBeTruthy();
			expect(connector.description).toBeTruthy();
			expect(connector.cmd).toBeTruthy();
		}
	});

	it("não embute nenhum segredo no helper", () => {
		// Formatos reais de credenciais (a palavra "token" aparece legitimamente
		// no fluxo OAuth, então procuramos valores, não nomes).
		const suspicious = [
			/-----BEGIN [A-Z ]*PRIVATE KEY/,
			/gh[pousr]_[A-Za-z0-9]{30,}/,
			/github_pat_[A-Za-z0-9_]{20,}/,
			/gsk_[A-Za-z0-9]{20,}/,
			/sk-[A-Za-z0-9]{20,}/,
			/AIza[0-9A-Za-z_-]{30,}/,
			/GOCSPX-[0-9A-Za-z_-]{20,}/,
			/\d{6,}-[a-z0-9]{20,}\.apps\.googleusercontent\.com/,
		];
		for (const pattern of suspicious) {
			expect(CONNECT_HELPER_INSTALL).not.toMatch(pattern);
		}
	});

	it("helper é um heredoc POSIX completo e executável", () => {
		expect(CONNECT_HELPER_INSTALL).toContain(
			"cat > /usr/local/bin/acodex-connect <<'ACODEX_CONNECT_EOF'",
		);
		expect(CONNECT_HELPER_INSTALL).toContain("ACODEX_CONNECT_EOF");
		expect(CONNECT_HELPER_INSTALL).toContain("chmod 755 /usr/local/bin/acodex-connect");
	});

	it("helper cobre todos os conectores do registro", () => {
		for (const connector of CONNECTORS) {
			// o helper trata o comando (case) e define a função connect_<cmd>
			expect(CONNECT_HELPER_INSTALL).toContain(`${connector.cmd}) connect_${connector.cmd}`);
			expect(CONNECT_HELPER_INSTALL).toContain(`connect_${connector.cmd}()`);
			// o comando final instala o helper e depois o executa com o conector
			const cmd = buildConnectCommand(connector);
			expect(cmd.startsWith(CONNECT_HELPER_INSTALL)).toBe(true);
			expect(cmd.endsWith(`; acodex-connect ${connector.cmd}`)).toBe(true);
		}
	});

	it("leva aos sites oficiais de autorização", () => {
		expect(CONNECT_HELPER_INSTALL).toContain(
			"github.com/login/device",
		);
		expect(CONNECT_HELPER_INSTALL).toContain(
			"accounts.google.com/o/oauth2/v2/auth",
		);
		expect(CONNECT_HELPER_INSTALL).toContain("openclaw channels add");
	});

	it("tokens são guardados criptografados, nunca em texto puro", () => {
		expect(CONNECT_HELPER_INSTALL).toContain("openssl enc -aes-256-cbc");
		expect(CONNECT_HELPER_INSTALL).toContain("chmod 600");
		expect(CONNECT_HELPER_INSTALL).toContain("chmod 700");
	});
});
