import { describe, expect, it } from "vitest";
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
		const suspicious = [
			/token/i,
			/api[_-]?key/i,
			/-----BEGIN/,
			/gsk_[A-Za-z0-9]/,
			/sk-[A-Za-z0-9]/,
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
			const fn = `acodex-connect ${connector.cmd}`;
			const caseBranch = new RegExp(
				`case.*\\$1|${connector.cmd}\\) connect`,
			);
			expect(CONNECT_HELPER_INSTALL).toMatch(caseBranch);
			expect(buildConnectCommand(connector)).toContain(
				`acodex-connect ${connector.cmd}`,
			);
			expect(buildConnectCommand(connector)).not.toContain(fn); // helper só é instalado uma vez
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
