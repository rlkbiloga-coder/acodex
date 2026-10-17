/*
 * cordova.js (runtime web) — plataforma do build web do AcodeX.
 *
 * NAO editar `www/cordova.js`: ele e gerado por `utils/scripts/web-cordova-shim.js`
 * a partir deste arquivo + os modulos JS dos plugins nativos (window.system,
 * window.iap, window.sdcard).
 *
 * No Android o cordova.js real e gerado pelo Cordova e traz o pluginloader.
 * No navegador ele precisa apenas dar boot no app: implementa em memoria o
 * subconjunto das APIs nativas usadas na inicializacao (cordova/exec,
 * cordova.file + resolveLocalFileSystemURL, System, Device, Iap, SDcard) e
 * responde com erro claro para o resto (terminal, SD card real, permissoes
 * do Android nao existem no browser).
 *
 * O gerador substitui os marcadores de versao/pacote e injeta os modulos dos
 * plugins no ponto marcado como marcador de plugins.
 */
(function () {
	"use strict";

	var VERSION = "__ACODEX_VERSION__";
	var VERSION_CODE = Number("__ACODEX_VERSION_CODE__") || 1;
	var PACKAGE_NAME = "__ACODEX_PACKAGE_NAME__";

	// O app le `strings.*` em caminhos de erro (ex: initEncodings) antes de
	// `lang.set()` resolver a promessa que define o global. Sem o global a
	// leitura lanca ReferenceError e derruba o boot inteiro; com um objeto
	// vazio no lugar o app so mostra o rotulo vazio e segue.
	window.strings = window.strings || {};

	// ------------------------------------------------------------- filesystem
	// Arvore em memoria no formato cordova-plugin-file (DirectoryEntry /
	// FileEntry). Nada e persistido entre recarregamentos.
	var ERROR = {
		NOT_FOUND_ERR: 1,
		SECURITY_ERR: 2,
		ABORT_ERR: 3,
		NOT_READABLE_ERR: 4,
		NO_MODIFICATION_ALLOWED_ERR: 6,
		INVALID_MODIFICATION_ERR: 9,
		TYPE_MISMATCH_ERR: 11,
		PATH_EXISTS_ERR: 12,
	};

	function fileError(code, message) {
		return { code: code, message: message || "Erro de arquivo" };
	}

	var nodes = Object.create(null);

	function isDir(path) {
		var node = nodes[path];
		return Boolean(node) && node.dir === true;
	}

	function makeDir(path) {
		if (!nodes[path]) nodes[path] = { dir: true, mtime: Date.now() };
	}

	function makeFile(path, bytes, mime) {
		nodes[path] = {
			dir: false,
			bytes: bytes === undefined ? new ArrayBuffer(0) : bytes,
			mime: mime || "text/plain",
			mtime: Date.now(),
		};
	}

	function makeDirs(paths) {
		paths.forEach(function (path) {
			var parts = path.split("/").filter(Boolean);
			var current = "";
			parts.forEach(function (part) {
				current += "/" + part;
				makeDir(current);
			});
		});
	}

	function baseName(path) {
		if (path === "/") return "";
		return path.slice(path.lastIndexOf("/") + 1);
	}

	function dirName(path) {
		if (path === "/") return "/";
		var index = path.lastIndexOf("/");
		return index <= 0 ? "/" : path.slice(0, index);
	}

	function joinPath(parent, name) {
		return parent === "/" ? "/" + name : parent + "/" + name;
	}

	function childPaths(path) {
		var prefix = path === "/" ? "/" : path + "/";
		return Object.keys(nodes).filter(function (key) {
			if (key === path || key.indexOf(prefix) !== 0) return false;
			var rest = key.slice(prefix.length);
			return rest !== "" && rest.indexOf("/") === -1;
		});
	}

	function toPath(url) {
		var value = String(url === undefined || url === null ? "" : url);
		value = value.replace(/^filesystem:[^/]*\/\/*/, "");
		value = value.replace(/^file:\/\//, "");
		value = value.split("?")[0].split("#")[0];
		try {
			value = decodeURIComponent(value);
		} catch (error) {
			// url com escape invalido: usa como veio
		}
		value = value.replace(/\/{2,}/g, "/");
		if (value.charAt(0) !== "/") value = "/" + value;
		if (value.length > 1) value = value.replace(/\/+$/, "");
		return value;
	}

	function byteLength(bytes) {
		if (!bytes) return 0;
		if (typeof bytes === "string") return bytes.length;
		if (typeof bytes.byteLength === "number") return bytes.byteLength;
		if (typeof bytes.size === "number") return bytes.size;
		return 0;
	}

	function blobUrl(path) {
		var node = nodes[path];
		if (!node) return "file://" + path;
		try {
			return URL.createObjectURL(new Blob([node.bytes], { type: node.mime }));
		} catch (error) {
			return "file://" + path;
		}
	}

	function collectTree(path) {
		var tree = [];
		Object.keys(nodes).forEach(function (key) {
			if (key === path || key.indexOf(path + "/") === 0) tree.push(key);
		});
		return tree;
	}

	function removeTree(path) {
		collectTree(path).forEach(function (key) {
			delete nodes[key];
		});
	}

	function transfer(path, parentPath, newName, copy) {
		var target = joinPath(parentPath, newName || baseName(path));
		if (target === path) throw fileError(ERROR.PATH_EXISTS_ERR);
		if (nodes[target]) throw fileError(ERROR.PATH_EXISTS_ERR);

		collectTree(path).forEach(function (key) {
			var node = nodes[key];
			var moved = copy
				? {
						dir: node.dir,
						bytes: node.bytes,
						mime: node.mime,
						mtime: node.mtime,
					}
				: node;
			nodes[target + key.slice(path.length)] = moved;
			if (!copy) delete nodes[key];
		});

		return target;
	}

	function getParentEntry(path, success, fail) {
		if (path === "/") {
			if (typeof fail === "function") fail(fileError(ERROR.NOT_FOUND_ERR));
			return;
		}
		if (typeof success === "function") success(directoryEntry(dirName(path)));
	}

	function resolveChild(parentPath, name, options, success, fail, wantDir) {
		var path = joinPath(parentPath, name);
		var node = nodes[path];
		var create = Boolean(options && options.create);
		var exclusive = options && options.exclusive !== false;

		if (node) {
			if (Boolean(node.dir) !== wantDir) {
				if (typeof fail === "function") fail(fileError(ERROR.TYPE_MISMATCH_ERR));
				return;
			}
			if (create && exclusive) {
				if (typeof fail === "function") fail(fileError(ERROR.PATH_EXISTS_ERR));
				return;
			}
		} else if (create) {
			if (wantDir) makeDir(path);
			else makeFile(path, new ArrayBuffer(0));
		} else {
			if (typeof fail === "function") fail(fileError(ERROR.NOT_FOUND_ERR));
			return;
		}

		if (typeof success === "function")
			success(wantDir ? directoryEntry(path) : fileEntry(path));
	}

	function metadata(path, size, success) {
		var node = nodes[path];
		if (typeof success === "function")
			success({
				modificationTime: new Date(node ? node.mtime : Date.now()),
				size: size || 0,
			});
	}

	function directoryEntry(path) {
		return {
			isFile: false,
			isDirectory: true,
			name: baseName(path),
			fullPath: path,
			nativeURL: "file://" + path,
			toURL: function () {
				return "file://" + path;
			},
			toInternalURL: function () {
				return "filesystem:file:///persistent" + path;
			},
			getParent: function (success, fail) {
				getParentEntry(path, success, fail);
			},
			createReader: function () {
				return {
					readEntries: function (success, fail) {
						try {
							var entries = childPaths(path)
								.sort()
								.map(function (child) {
									return isDir(child)
										? directoryEntry(child)
										: fileEntry(child);
								});
							if (typeof success === "function") success(entries);
						} catch (error) {
							if (typeof fail === "function") fail(error);
						}
					},
				};
			},
			getFile: function (name, options, success, fail) {
				resolveChild(path, name, options, success, fail, false);
			},
			getDirectory: function (name, options, success, fail) {
				resolveChild(path, name, options, success, fail, true);
			},
			remove: function (success, fail) {
				if (path === "/" || childPaths(path).length) {
					if (typeof fail === "function")
						fail(fileError(ERROR.INVALID_MODIFICATION_ERR));
					return;
				}
				removeTree(path);
				if (typeof success === "function") success();
			},
			removeRecursively: function (success, fail) {
				if (path === "/") {
					if (typeof fail === "function")
						fail(fileError(ERROR.NO_MODIFICATION_ALLOWED_ERR));
					return;
				}
				removeTree(path);
				if (typeof success === "function") success();
			},
			getMetadata: function (success) {
				metadata(path, 0, success);
			},
			copyTo: function (parent, newName, success, fail) {
				try {
					var target = transfer(path, toPath(parent.nativeURL), newName, true);
					if (typeof success === "function") success(directoryEntry(target));
				} catch (error) {
					if (typeof fail === "function") fail(error);
				}
			},
			moveTo: function (parent, newName, success, fail) {
				try {
					var target = transfer(path, toPath(parent.nativeURL), newName, false);
					if (typeof success === "function") success(directoryEntry(target));
				} catch (error) {
					if (typeof fail === "function") fail(error);
				}
			},
		};
	}

	function fileEntry(path) {
		return {
			isFile: true,
			isDirectory: false,
			name: baseName(path),
			fullPath: path,
			nativeURL: "file://" + path,
			toURL: function () {
				return "file://" + path;
			},
			toInternalURL: function () {
				return blobUrl(path);
			},
			getParent: function (success, fail) {
				getParentEntry(path, success, fail);
			},
			file: function (success, fail) {
				var node = nodes[path];
				if (!node) {
					if (typeof fail === "function") fail(fileError(ERROR.NOT_FOUND_ERR));
					return;
				}
				if (typeof success === "function")
					success(
						new File([node.bytes], baseName(path), {
							type: node.mime,
							lastModified: node.mtime,
						}),
					);
			},
			createWriter: function (success, fail) {
				var node = nodes[path];
				if (!node) {
					if (typeof fail === "function") fail(fileError(ERROR.NOT_FOUND_ERR));
					return;
				}

				var writer = {
					position: 0,
					onwriteend: null,
					onwrite: null,
					onerror: null,
					onprogress: null,
					write: function (data) {
						node.bytes = data;
						node.mtime = Date.now();
						if (typeof writer.onwrite === "function")
							writer.onwrite({ target: writer });
						if (typeof writer.onwriteend === "function")
							writer.onwriteend({ target: writer });
					},
					truncate: function (length) {
						if (node.bytes instanceof ArrayBuffer)
							node.bytes = node.bytes.slice(0, length || 0);
					},
					seek: function (offset) {
						writer.position = offset;
					},
					abort: function () {},
				};

				if (typeof success === "function") success(writer);
			},
			remove: function (success) {
				delete nodes[path];
				if (typeof success === "function") success();
			},
			removeRecursively: function (success) {
				removeTree(path);
				if (typeof success === "function") success();
			},
			getMetadata: function (success) {
				metadata(path, byteLength(nodes[path] && nodes[path].bytes), success);
			},
			copyTo: function (parent, newName, success, fail) {
				try {
					var target = transfer(path, toPath(parent.nativeURL), newName, true);
					if (typeof success === "function") success(fileEntry(target));
				} catch (error) {
					if (typeof fail === "function") fail(error);
				}
			},
			moveTo: function (parent, newName, success, fail) {
				try {
					var target = transfer(path, toPath(parent.nativeURL), newName, false);
					if (typeof success === "function") success(fileEntry(target));
				} catch (error) {
					if (typeof fail === "function") fail(error);
				}
			},
		};
	}

	// Diretorios de cordova.file no navegador (todos na arvore em memoria).
	var FILE_DIRS = {
		applicationDirectory: "file:///android_asset/",
		applicationStorageDirectory: "file:///data/",
		dataDirectory: "file:///data/",
		cacheDirectory: "file:///cache/",
		externalApplicationStorageDirectory: "file:///sdcard/Android/data/" + PACKAGE_NAME + "/",
		externalDataDirectory: "file:///sdcard/Android/data/" + PACKAGE_NAME + "/files/",
		externalCacheDirectory: "file:///sdcard/Android/data/" + PACKAGE_NAME + "/cache/",
		externalRootDirectory: "file:///sdcard/",
	};

	makeDirs([
		"/android_asset/www",
		"/data",
		"/cache",
		"/sdcard/Android/data/" + PACKAGE_NAME + "/files",
		"/sdcard/Android/data/" + PACKAGE_NAME + "/cache",
	]);

	window.resolveLocalFileSystemURL = function (url, success, fail) {
		var path = toPath(url);
		var node = nodes[path];

		if (!node) {
			if (typeof fail === "function")
				fail(fileError(ERROR.NOT_FOUND_ERR, "Path not found: " + path));
			return;
		}

		if (typeof success === "function")
			success(node.dir ? directoryEntry(path) : fileEntry(path));
	};

	// ------------------------------------------------------------------ exec
	var execHandlers = Object.create(null);

	function registerExec(service, action, handler) {
		execHandlers[service + "." + action] = handler;
	}

	function exec(success, fail, service, action, args) {
		var handler = execHandlers[service + "." + action];

		if (!handler) {
			console.warn(
				"[cordova-web] " + service + "." + action + " nao existe no build web",
			);
			if (typeof fail === "function")
				fail("Plugin nativo " + service + "." + action + " indisponivel no navegador");
			return;
		}

		try {
			handler(args || [], success, fail);
		} catch (error) {
			console.warn("[cordova-web] falha em " + service + "." + action, error);
			if (typeof fail === "function") fail(error.message || String(error));
		}
	}

	function callback(fn, value) {
		if (typeof fn === "function") fn(value);
	}

	// ----------------------------------------------------------------- System
	// Subconjunto de charsets do Android que o browser tambem decodifica.
	var ENCODINGS = {
		"UTF-8": {
			label: "UTF-8",
			aliases: ["utf8", "utf-8"],
			name: "UTF-8",
		},
		"UTF-16LE": {
			label: "UTF-16LE",
			aliases: ["utf-16le", "utf16le", "unicode"],
			name: "UTF-16LE",
		},
		"UTF-16BE": {
			label: "UTF-16BE",
			aliases: ["utf-16be", "utf16be"],
			name: "UTF-16BE",
		},
		"windows-1252": {
			label: "windows-1252",
			aliases: ["cp1252", "cp-1252"],
			name: "windows-1252",
		},
		"ISO-8859-1": {
			label: "ISO-8859-1",
			aliases: ["latin1", "iso8859-1", "iso-8859-1"],
			name: "ISO-8859-1",
		},
	};

	function encodeText(text, charset) {
		var name = String(charset || "UTF-8").toUpperCase();

		if (name === "UTF-16LE" || name === "UTF-16BE") {
			var buffer = new ArrayBuffer(text.length * 2);
			var view = new Uint8Array(buffer);
			var little = name === "UTF-16LE";
			for (var i = 0; i < text.length; i++) {
				var code = text.charCodeAt(i);
				view[i * 2 + (little ? 0 : 1)] = code & 0xff;
				view[i * 2 + (little ? 1 : 0)] = code >> 8;
			}
			return buffer;
		}

		if (name === "UTF-8") return new TextEncoder().encode(text).buffer;

		// charsets de um byte (windows-1252 / ISO-8859-1)
		var bytes = new Uint8Array(text.length);
		for (var j = 0; j < text.length; j++) bytes[j] = text.charCodeAt(j) & 0xff;
		return bytes.buffer;
	}

	registerExec("System", "get-available-encodings", function (args, success) {
		callback(success, ENCODINGS);
	});

	registerExec("System", "decode", function (args, success) {
		var charset = args[1] || "UTF-8";
		var decoder;
		try {
			decoder = new TextDecoder(charset);
		} catch (error) {
			decoder = new TextDecoder("utf-8");
		}
		callback(success, decoder.decode(args[0]));
	});

	registerExec("System", "encode", function (args, success) {
		callback(success, encodeText(String(args[0]), args[1]));
	});

	registerExec("System", "get-android-version", function (args, success) {
		callback(success, 34);
	});

	registerExec("System", "has-permission", function (args, success) {
		callback(success, 1);
	});

	registerExec("System", "request-permission", function (args, success) {
		callback(success, 1);
	});

	registerExec("System", "request-permissions", function (args, success) {
		callback(success, 1);
	});

	registerExec("System", "get-global-setting", function (args, success) {
		// O app usa "animator_duration_scale" para decidir se anima a UI.
		callback(success, args[0] === "animator_duration_scale" ? "1.0" : null);
	});

	// Recompensas de anuncio sao do Android: sem pass ativo no navegador.
	registerExec("System", "getRewardStatus", function (args, success) {
		callback(success, null);
	});

	// Configuracao do sistema (teclado/rotacao). No navegador nao ha teclado
	// nativo nem rotacao: teclado escondido e sem teclado externo.
	registerExec("System", "get-configuration", function (args, success) {
		callback(success, {
			isAcceptingText: false,
			keyboardHeight: 0,
			locale: navigator.language || "en-US",
			fontScale: 1,
			keyboard: 0,
			keyboardHidden: 2,
			hardKeyboardHidden: 2,
			navigationHidden: 2,
			navigation: 0,
			orientation: window.innerWidth >= window.innerHeight ? 2 : 1,
		});
	});

	// Acoes so de UI/tema do Android: nada a fazer, mas respondem sucesso
	// para o app nao tratar como falha nativa.
	[
		"set-ui-theme",
		"set-input-type",
		"set-native-context-menu-disabled",
		"set-app-icon",
		"add-shortcut",
		"remove-shortcut",
		"pin-shortcut",
		"pin-file-shortcut",
		"manage-all-files",
		"in-app-browser",
		"is-powersave-mode",
		"get-webkit-info",
	].forEach(function (action) {
		registerExec("System", action, function (args, success) {
			callback(success, null);
		});
	});

	registerExec("System", "get-installer", function (args, success) {
		callback(success, "browser");
	});

	registerExec("System", "getInstaller", function (args, success) {
		callback(success, "browser");
	});

	registerExec("System", "clearCache", function (args, success) {
		callback(success, null);
	});

	registerExec("System", "open-in-browser", function (args, success) {
		window.open(String(args[0]), "_blank", "noopener");
		callback(success, null);
	});

	registerExec("System", "shareText", function (args, success) {
		if (navigator.share) {
			navigator.share({ text: String(args[0]) }).catch(function () {});
		}
		callback(success, null);
	});

	registerExec("System", "getNativeLibraryPath", function (args, success) {
		callback(success, "");
	});

	// Intents do Android nao existem no navegador: sem callback nao ha
	// promise pendente (o app nao espera retorno aqui).
	registerExec("System", "set-intent-handler", function () {});
	registerExec("System", "get-cordova-intent", function () {});

	// ----------------------------------------------------------------- Device
	var deviceInfo = {
		cordova: VERSION,
		platform: "browser",
		model: "navegador",
		manufacturer: "AcodeX",
		version: "0",
		uuid: "acodex-web-preview",
		isVirtual: true,
		serial: "web",
	};

	window.device = deviceInfo;

	registerExec("Device", "getDeviceInfo", function (args, success) {
		callback(success, deviceInfo);
	});

	// -------------------------------------------------------------------- Iap
	// Sem Google Play no navegador: conexao ok, nenhuma compra.
	registerExec("Iap", "startConnection", function (args, success) {
		callback(success, null);
	});

	registerExec("Iap", "getPurchases", function (args, success) {
		callback(success, []);
	});

	registerExec("Iap", "getProducts", function (args, success) {
		callback(success, []);
	});

	registerExec("Iap", "setPurchaseUpdatedListener", function () {});

	// ----------------------------------------------------------------- SDcard
	function statFor(url) {
		var path = toPath(url);
		var node = nodes[path];

		if (!node) return null;

		return {
			url: "file://" + path,
			name: baseName(path),
			isFile: node.dir !== true,
			isDirectory: node.dir === true,
			isLink: false,
			canRead: true,
			canWrite: true,
			size: node.dir ? 0 : byteLength(node.bytes),
			modifiedDate: node.mtime,
		};
	}

	registerExec("SDcard", "stats", function (args, success, fail) {
		var stats = statFor(args[0]);
		if (!stats) {
			callback(fail, fileError(ERROR.NOT_FOUND_ERR, "Path not found: " + args[0]));
			return;
		}
		callback(success, stats);
	});

	registerExec("SDcard", "exists", function (args, success) {
		callback(success, Boolean(nodes[toPath(args[0])]));
	});

	registerExec("SDcard", "format uri", function (args, success) {
		callback(success, "file://" + toPath(args[0]));
	});

	// ------------------------------------------------------------------ build
	var cordova = window.cordova || {};

	cordova.platformId = "browser";
	cordova.version = VERSION;
	cordova.plugins = cordova.plugins || {};
	cordova.exec = exec;
	cordova.require = function (name) {
		return name === "cordova/exec" ? exec : {};
	};
	cordova.define = function (name, factory) {
		if (typeof factory === "function") factory(cordova.require, {}, {});
	};
	cordova.file = FILE_DIRS;

	window.cordova = cordova;
	window.BuildInfo = window.BuildInfo || {
		packageName: PACKAGE_NAME,
		version: VERSION,
		versionCode: VERSION_CODE,
	};

	// __ACODEX_WEB_PLUGINS__

	// dispara deviceready como o Cordova faria (depois dos plugins acima).
	function fireReady() {
		var event;
		try {
			event = new Event("deviceready");
		} catch (error) {
			event = document.createEvent("Events");
			event.initEvent("deviceready", true, false);
		}
		document.dispatchEvent(event);
	}

	if (document.readyState === "complete") {
		setTimeout(fireReady, 50);
	} else {
		window.addEventListener("load", function () {
			setTimeout(fireReady, 50);
		});
	}
})();
