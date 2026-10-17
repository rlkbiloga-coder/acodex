// web-cordova-shim.js — gera www/cordova.js para o build web (Vercel/preview).
// No Android o cordova.js real é gerado pelo Cordova; este stub só existe
// no deploy web, para o app dar boot no navegador sem plugins nativos.
//
// O que o boot do app realmente usa (e por isso é simulado aqui):
//   - cordova/exec do serviço "System": get-available-encodings, decode, encode
//   - File API (cordova-plugin-file): FileEntry/DirectoryEntry/FileWriter
//     sobre um "disco" em memória persistido em localStorage
//   - globais device, sdcard (stats), BuildInfo e os diretórios de cordova.file
// Todo o resto continua falhando como plugin indisponível — no navegador não
// existe terminal, S/FTP, advanced-http, ads, iap nem o plugin de auth.
// www/cordova.js está no .gitignore — nunca comitar.

const fs = require("node:fs");
const path = require("node:path");

const pkg = require("../../package.json");
const dest = path.join(__dirname, "..", "..", "www", "cordova.js");

const stub = `/*
 * cordova.js (stub web) — gerado por utils/scripts/web-cordova-shim.js
 * Plataforma: browser (deploy web / preview). Plugins nativos indisponíveis:
 * exec do System (encodings), File API em memória e os globais device/sdcard/
 * BuildInfo são simulados aqui para o app abrir no navegador.
 */
(function () {
  "use strict";

  var VERSION = "${pkg.version}";
  var PACKAGE_NAME = "${pkg.name}";
  // espelha src/utils/installSource.js: no navegador não há Play Store, mas o
  // contrato de system.getInstaller precisa responder algo.
  var INSTALL_SOURCE_PLAY = "com.android.vending";
  // Marcador exclusivo do stub gerado para o preview web. O app usa isto para
  // não chamar serviços remotos que só existem no app/website em produção.
  window.__ACODE_BROWSER_PREVIEW__ = true;

  function unavailableExec(success, fail) {
    if (typeof fail === "function") {
      fail("Plugin nativo indisponivel no navegador");
    }
  }

  // ── System: encodings ───────────────────────────────────────────────

  var ENCODINGS = {
    "UTF-8": {
      label: "UTF-8",
      name: "UTF-8",
      aliases: ["utf8", "utf-8", "unicode-1-1-utf-8", "unicode20utf8", "x-unicode20utf8"]
    },
    "UTF-16LE": {
      label: "UTF-16 LE",
      name: "UTF-16LE",
      aliases: ["utf16le", "utf-16le", "ucs-2", "unicode", "unicodefeff"]
    },
    "UTF-16BE": {
      label: "UTF-16 BE",
      name: "UTF-16BE",
      aliases: ["utf16be", "utf-16be", "unicodefffe"]
    },
    "ISO-8859-1": {
      label: "ISO-8859-1",
      name: "ISO-8859-1",
      aliases: ["iso88591", "iso-8859-1", "latin1", "windows-1252", "cp1252"]
    }
  };

  function decoderLabel(charset) {
    var name = String(charset || "UTF-8").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (name === "utf16le" || name === "ucs2") return "utf-16le";
    if (name === "utf16be") return "utf-16be";
    if (name === "iso88591" || name === "latin1" || name === "cp1252" || name === "windows1252") return "iso-8859-1";
    return "utf-8";
  }

  function decodeBuffer(buffer, charset) {
    if (typeof buffer === "string") return buffer;
    if (buffer && !(buffer instanceof ArrayBuffer) && buffer.buffer) {
      buffer = buffer.buffer;
    }
    try {
      return new TextDecoder(decoderLabel(charset)).decode(buffer);
    } catch (error) {
      return "";
    }
  }

  function encodeText(text, charset) {
    var value = String(text == null ? "" : text);
    var label = decoderLabel(charset);
    if (label === "utf-8") return new TextEncoder().encode(value).buffer;

    var width = label === "iso-8859-1" ? 1 : 2;
    var buffer = new ArrayBuffer(value.length * width);
    var view = new DataView(buffer);
    for (var index = 0; index < value.length; index++) {
      var code = value.charCodeAt(index);
      if (width === 1) view.setUint8(index, code & 0xff);
      else view.setUint16(index * 2, code, label === "utf-16be" ? false : true);
    }
    return buffer;
  }

  var execHandlers = {
    "System.get-available-encodings": function () {
      return ENCODINGS;
    },
    "System.decode": function (args) {
      return decodeBuffer(args[0], args[1]);
    },
    "System.encode": function (args) {
      return encodeText(args[0], args[1]);
    }
  };

  function browserExec(success, fail, service, action, args) {
    var key = String(service) + "." + String(action);
    if (!Object.prototype.hasOwnProperty.call(execHandlers, key)) {
      unavailableExec(success, fail);
      return;
    }

    var result;
    try {
      result = execHandlers[key](args || []);
    } catch (error) {
      unavailableExec(success, fail);
      return;
    }

    setTimeout(function () {
      if (typeof success === "function") success(result);
    }, 0);
  }

  // ── File API em memória (cordova-plugin-file) ───────────────────────
  // settings.json, a pasta de plugins e os arquivos abertos vivem nesse
  // "disco", persistido em localStorage: sobrevive ao reload, mas não é o
  // armazenamento do aparelho.

  var STORAGE_KEY = "acodex.web.filesystem.v1";
  var nodes = null;

  function readNodes() {
    if (nodes) return nodes;

    nodes = {};
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) nodes = JSON.parse(raw) || {};
    } catch (error) {
      nodes = {};
    }

    ["/app", "/app/www", "/data", "/cache", "/cache/external"].forEach(function (path) {
      if (!nodes[path]) nodes[path] = { dir: true };
    });

    return nodes;
  }

  function writeNodes() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(readNodes()));
    } catch (error) {
      // Sem quota: o preview segue usando o disco em memória.
    }
  }

  function toPath(url) {
    var raw = decodeURI(String(url == null ? "" : url));

    var hashIndex = raw.indexOf("#");
    if (hashIndex >= 0) raw = raw.slice(0, hashIndex);
    var queryIndex = raw.indexOf("?");
    if (queryIndex >= 0) raw = raw.slice(0, queryIndex);

    var schemeIndex = raw.indexOf("://");
    if (schemeIndex >= 0) {
      var rest = raw.slice(schemeIndex + 3);
      var slashIndex = rest.indexOf("/");
      var authority = (slashIndex >= 0 ? rest.slice(0, slashIndex) : rest).toLowerCase();
      var pathPart = slashIndex >= 0 ? rest.slice(slashIndex) : "/";

      // cdvfile://localhost/persistent|temporary aponta para os mesmos diretórios
      if (authority === "localhost" || authority === "") {
        if (pathPart === "/persistent" || pathPart.indexOf("/persistent/") === 0) {
          pathPart = "/data" + pathPart.slice(11);
        } else if (pathPart === "/temporary" || pathPart.indexOf("/temporary/") === 0) {
          pathPart = "/cache" + pathPart.slice(10);
        }
      }

      raw = pathPart;
    }

    var parts = raw.split("/");
    var stack = [];
    for (var index = 0; index < parts.length; index++) {
      var part = parts[index];
      if (!part || part === ".") continue;
      if (part === "..") stack.pop();
      else stack.push(part);
    }

    return "/" + stack.join("/");
  }

  function nodeAt(path) {
    var store = readNodes();
    return Object.prototype.hasOwnProperty.call(store, path) ? store[path] : null;
  }

  function basename(path) {
    var parts = String(path).split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "";
  }

  function dirname(path) {
    var parts = String(path).split("/").filter(Boolean);
    parts.pop();
    return "/" + parts.join("/");
  }

  function joinPath(base, name) {
    return toPath(String(base) + "/" + String(name == null ? "" : name));
  }

  function messageFor(code) {
    switch (code) {
      case 1:
        return "Path not found";
      case 9:
        return "Invalid modification";
      case 11:
        return "Type mismatch";
      case 12:
        return "Path already exists";
      default:
        return "Uncaught error";
    }
  }

  function errorFor(code) {
    return { code: code, message: messageFor(code) };
  }

  function fail(error, failCallback) {
    if (typeof failCallback === "function") failCallback(error);
  }

  function contentOf(node) {
    if (!node) return "";
    return typeof node.data === "string" ? node.data : "";
  }

  function writerFor(path) {
    var writer = {
      readyState: 0,
      position: 0,
      onwrite: null,
      onwriteend: null,
      onerror: null,
      onabort: null,
      onprogress: null,
      abort: function () {
        if (typeof writer.onabort === "function") writer.onabort({ target: writer });
      },
      truncate: function (length) {
        storeContent(path, contentOf(nodeAt(path)).slice(0, length || 0));
        if (typeof writer.onwriteend === "function") writer.onwriteend({ target: writer });
      },
      write: function (data) {
        persist(path, data, function () {
          setTimeout(function () {
            if (typeof writer.onwrite === "function") writer.onwrite({ target: writer });
            if (typeof writer.onwriteend === "function") writer.onwriteend({ target: writer });
          }, 0);
        }, function () {
          if (typeof writer.onerror === "function") {
            writer.onerror({ target: { error: errorFor(9) } });
          }
        });
      }
    };

    return writer;
  }

  function storeContent(path, text) {
    var store = readNodes();
    store[path] = { dir: false, data: text, modified: Date.now() };
    writeNodes();
  }

  function persist(path, data, done, failed) {
    var parent = nodeAt(dirname(path));
    if (!parent || !parent.dir) {
      failed();
      return;
    }

    if (data == null || typeof data === "string") {
      storeContent(path, data == null ? "" : String(data));
      done();
      return;
    }

    if (typeof Blob !== "undefined" && data instanceof Blob) {
      var reader = new FileReader();
      reader.onerror = failed;
      reader.onloadend = function () {
        storeContent(path, String(reader.result == null ? "" : reader.result));
        done();
      };
      reader.readAsText(data);
      return;
    }

    storeContent(path, decodeBuffer(data, "UTF-8"));
    done();
  }

  function removeNode(path, recursive, success, failCallback) {
    var node = nodeAt(path);
    if (!node) {
      fail(errorFor(1), failCallback);
      return;
    }

    var store = readNodes();
    var children = Object.keys(store).filter(function (key) {
      return key !== path && key.indexOf(path + "/") === 0;
    });

    if (children.length && !recursive) {
      fail(errorFor(9), failCallback);
      return;
    }

    children.forEach(function (key) {
      delete store[key];
    });
    delete store[path];
    writeNodes();

    if (typeof success === "function") success();
  }

  function copyOrMove(source, destEntry, name, move, success, failCallback) {
    var node = nodeAt(source);
    if (!node) {
      fail(errorFor(1), failCallback);
      return;
    }

    if (!destEntry || !destEntry.isDirectory) {
      fail(errorFor(11), failCallback);
      return;
    }

    var dest = joinPath(
      destEntry.fullPath,
      name == null || name === "" ? basename(source) : name
    );

    if (nodeAt(dest)) {
      fail(errorFor(12), failCallback);
      return;
    }

    var store = readNodes();
    var prefix = source + "/";

    store[dest] = node.dir
      ? { dir: true, modified: Date.now() }
      : { dir: false, data: contentOf(node), modified: Date.now() };

    Object.keys(store).forEach(function (key) {
      if (key.indexOf(prefix) !== 0) return;

      var child = store[key];
      var target = dest + key.slice(source.length);
      store[target] = child.dir
        ? { dir: true, modified: Date.now() }
        : { dir: false, data: contentOf(child), modified: Date.now() };

      if (move) delete store[key];
    });

    if (move) delete store[source];
    writeNodes();

    if (typeof success === "function") success(makeEntry(dest));
  }

  function makeEntry(path) {
    var node = nodeAt(path);
    var isDirectory = !!(node && node.dir);

    function requireDirectory(failCallback, run) {
      if (!node) return fail(errorFor(1), failCallback);
      if (!node.dir) return fail(errorFor(11), failCallback);
      return run();
    }

    return {
      isFile: !!(node && !node.dir),
      isDirectory: isDirectory,
      name: basename(path),
      fullPath: path,
      nativeURL: "file://" + path,
      toURL: function () {
        return "file://" + path;
      },
      toInternalURL: function () {
        return "cdvfile://localhost" + path;
      },
      getMetadata: function (success, failCallback) {
        if (!node) return fail(errorFor(1), failCallback);
        if (typeof success === "function") {
          success({
            modificationTime: new Date(node.modified || Date.now()),
            size: node.dir ? 0 : String(contentOf(node)).length
          });
        }
      },
      getParent: function (success, failCallback) {
        var parentPath = dirname(path);
        if (!nodeAt(parentPath)) return fail(errorFor(1), failCallback);
        if (typeof success === "function") success(makeEntry(parentPath));
      },
      file: function (success, failCallback) {
        if (!node) return fail(errorFor(1), failCallback);
        if (node.dir) return fail(errorFor(11), failCallback);
        if (typeof success === "function") {
          success(new Blob([contentOf(node)], { type: "text/plain" }));
        }
      },
      createWriter: function (success, failCallback) {
        if (!node) return fail(errorFor(1), failCallback);
        if (node.dir) return fail(errorFor(11), failCallback);
        if (typeof success === "function") success(writerFor(path));
      },
      createReader: function () {
        return {
          readEntries: function (success, failCallback) {
            requireDirectory(failCallback, function () {
              var store = readNodes();
              var entries = Object.keys(store)
                .filter(function (key) {
                  return key !== path && dirname(key) === path;
                })
                .map(makeEntry);

              if (typeof success === "function") success(entries);
            });
          }
        };
      },
      getFile: function (name, options, success, failCallback) {
        requireDirectory(failCallback, function () {
          var target = joinPath(path, name);
          var existing = nodeAt(target);

          if (existing && existing.dir) return fail(errorFor(11), failCallback);
          if (existing && options && options.create && options.exclusive) {
            return fail(errorFor(12), failCallback);
          }

          if (!existing) storeContent(target, "");
          if (typeof success === "function") success(makeEntry(target));
        });
      },
      getDirectory: function (name, options, success, failCallback) {
        requireDirectory(failCallback, function () {
          var target = joinPath(path, name);
          var existing = nodeAt(target);

          if (existing && !existing.dir) return fail(errorFor(11), failCallback);
          if (existing && options && options.create && options.exclusive) {
            return fail(errorFor(12), failCallback);
          }

          if (!existing) {
            if (!options || !options.create) return fail(errorFor(1), failCallback);
            var store = readNodes();
            store[target] = { dir: true, modified: Date.now() };
            writeNodes();
          }

          if (typeof success === "function") success(makeEntry(target));
        });
      },
      remove: function (success, failCallback) {
        removeNode(path, false, success, failCallback);
      },
      removeRecursively: function (success, failCallback) {
        removeNode(path, true, success, failCallback);
      },
      copyTo: function (destEntry, name, success, failCallback) {
        copyOrMove(path, destEntry, name, false, success, failCallback);
      },
      moveTo: function (destEntry, name, success, failCallback) {
        copyOrMove(path, destEntry, name, true, success, failCallback);
      }
    };
  }

  window.resolveLocalFileSystemURL =
    window.resolveLocalFileSystemURL ||
    function (url, success, failCallback) {
      var path = toPath(url);
      if (!nodeAt(path)) {
        setTimeout(function () {
          fail(errorFor(1), failCallback);
        }, 0);
        return;
      }

      setTimeout(function () {
        if (typeof success === "function") success(makeEntry(path));
      }, 0);
    };

  // ── Globais que o boot espera dos plugins ───────────────────────────

  window.BuildInfo = window.BuildInfo || {
    packageName: PACKAGE_NAME,
    version: VERSION,
    versionCode: 1
  };

  window.device = window.device || {
    platform: "browser",
    version: "",
    uuid: "browser-preview",
    model: "Browser preview",
    manufacturer: "preview",
    isVirtual: true,
    cordova: VERSION
  };

  // cordova-plugin-system: só o que o boot usa responde de verdade. O resto
  // segue sendo um plugin ausente (navegador não tem permissões, cache nem
  // intents do Android).
  // Os métodos do plugin chegam de dois jeitos: com argumentos antes dos
  // callbacks (helpers.promisify -> (..., resolve, reject)) ou só com os
  // callbacks (success, error). Responder sempre ao PRIMEIRO callback resolve
  // os dois casos; quem só chama sem callback não trava.
  function answer(value) {
    return function () {
      var success = Array.prototype.filter.call(arguments, function (arg) {
        return typeof arg === "function";
      })[0];
      if (!success) return;
      setTimeout(function () {
        success(value);
      }, 0);
    };
  }

  window.system = window.system || {
    hasPermission: answer(true),
    requestPermission: answer(true),
    requestPermissions: answer(true),
    getInstaller: answer(INSTALL_SOURCE_PLAY),
    isManageExternalStorageDeclared: answer(false),
    hasGrantedStorageManager: answer(false),
    isExternalStorageManager: answer(false),
    isPowerSaveMode: answer(false),
    getArch: answer("x86_64"),
    getFilesDir: answer("/app/files"),
    getGlobalSetting: answer(null),
    getAppInfo: answer({
      packageName: PACKAGE_NAME,
      versionName: VERSION,
      versionCode: 1
    }),
    getWebviewInfo: answer({ major: 0, version: "browser" }),
    clearCache: answer(),
    setUiTheme: answer(),
    setInputType: answer(),
    setNativeContextMenuDisabled: answer(),
    setIntentHandler: function () {},
    getCordovaIntent: function (success) {
      if (typeof success === "function") success({});
    },
    openInBrowser: function (url) {
      window.open(url, "_blank", "noopener");
    },
    compareFileText: function () {
      return Promise.resolve(false);
    },
    compareTexts: function () {
      return Promise.resolve(false);
    }
  };

  // Acode WebView: o app só precisa que o botão do menu exista.
  try {
    if (!navigator.app) {
      Object.defineProperty(navigator, "app", {
        configurable: true,
        value: {
          overrideButton: function () {},
          exitApp: function () {}
        }
      });
    }
  } catch (error) {
    /* navegador sem navigator.app definível: segue sem ele */
  }

  window.sdcard = window.sdcard || {
    watchFile: function () {},
    stats: function (url, success, failCallback) {
      var path = toPath(url);
      var node = nodeAt(path);
      if (!node) return fail(errorFor(1), failCallback);

      if (typeof success === "function") {
        success({
          url: "file://" + path,
          name: basename(path),
          isFile: !node.dir,
          isDirectory: !!node.dir,
          size: node.dir ? 0 : String(contentOf(node)).length,
          modifiedDate: node.modified || Date.now(),
          canRead: true,
          canWrite: true
        });
      }
    }
  };

  var memFS = {
    applicationDirectory: "file:///app/",
    externalDataDirectory: "file:///data/",
    externalCacheDirectory: "file:///cache/external/",
    dataDirectory: "file:///data/",
    cacheDirectory: "file:///cache/"
  };

  window.cordova = window.cordova || {
    platformId: "browser",
    version: VERSION,
    plugins: {},
    exec: browserExec,
    require: function (name) {
      return name === "cordova/exec" ? browserExec : {};
    },
    define: function () {}
  };
  window.cordova.file = memFS;

  // dispara deviceready como o Cordova faria
  function fireReady() {
    var evt;
    try {
      evt = new Event("deviceready");
    } catch (e) {
      evt = document.createEvent("Events");
      evt.initEvent("deviceready", true, false);
    }
    document.dispatchEvent(evt);
  }
  if (document.readyState === "complete") {
    setTimeout(fireReady, 50);
  } else {
    window.addEventListener("load", function () { setTimeout(fireReady, 50); });
  }
})();
`;

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, stub);
console.log("web-cordova-shim: www/cordova.js gerado (stub browser)");
