// web-cordova-shim.js — gera www/cordova.js para o build web (Vercel/preview).
// No Android o cordova.js real é gerado pelo Cordova; este stub só existe
// no deploy web, para a página dar boot (deviceready) no navegador.
// O runtime fica em utils/scripts/web-cordova-runtime.js; os módulos JS dos
// plugins nativos são embutidos aqui (mesmo contrato do pluginloader).
// www/cordova.js está no .gitignore — nunca comitar.

const fs = require("node:fs");
const path = require("node:path");

const pkg = require("../../package.json");
const runtimePath = path.join(__dirname, "web-cordova-runtime.js");
const dest = path.join(__dirname, "..", "..", "www", "cordova.js");

// JS de plugin embutido no stub, como o pluginloader do Cordova faria:
// cada arquivo é um módulo CommonJS que expõe o global do plugin.xml.
const WEB_PLUGINS = [
	{ file: "src/plugins/system/www/plugin.js", global: "system" },
	{ file: "src/plugins/iap/www/plugin.js", global: "iap" },
	{ file: "src/plugins/sdcard/www/plugin.js", global: "sdcard" },
];

const isFree = process.env.APP_VARIANT === "free";
const packageName = isFree ? "com.foxdebug.acodefree" : "com.foxdebug.acode";

/** android-versionCode do config.xml (mesma fonte do build Android). */
function readVersionCode(root) {
	try {
		const config = fs.readFileSync(path.join(root, "config.xml"), "utf8");
		const match = config.match(/android-versionCode="(\d+)"/);
		return match ? Number(match[1]) : 1;
	} catch (error) {
		return 1;
	}
}

function pluginModule(root, plugin) {
	const source = fs.readFileSync(path.join(root, plugin.file), "utf8");

	return [
		`\t// ${plugin.file} -> window.${plugin.global}`,
		"\twindow." + plugin.global + " = (function () {",
		"\t\tvar module = { exports: {} };",
		"\t\tvar exports = module.exports;",
		source,
		"\t\treturn module.exports;",
		"\t})();",
	].join("\n");
}

function buildStub(root) {
	return fs
		.readFileSync(runtimePath, "utf8")
		.replaceAll("__ACODEX_VERSION__", pkg.version)
		.replaceAll("__ACODEX_VERSION_CODE__", String(readVersionCode(root)))
		.replaceAll("__ACODEX_PACKAGE_NAME__", packageName)
		.replace(
			"// __ACODEX_WEB_PLUGINS__",
			WEB_PLUGINS.map((plugin) => pluginModule(root, plugin)).join("\n\n"),
		);
}

const root = path.join(__dirname, "..", "..");

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, buildStub(root));
console.log("web-cordova-shim: www/cordova.js gerado (stub browser)");
