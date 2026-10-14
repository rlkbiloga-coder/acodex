/**
 * Source code of the sandbox Web Worker.
 *
 * Runs untrusted JavaScript inside a Worker: console.* calls and errors are
 * posted back to the host as structured messages. Kept as a plain string
 * (no imports) so it can be unit-tested and instantiated via a Blob URL.
 *
 * Networking: the global `net` object lets sandboxed code call
 * net.get(url, options). The request is routed through the host, which
 * validates the URL and performs it with the native HTTP stack (no CORS).
 */

export const JS_WORKER_SOURCE = `
"use strict";
function fmt(value) {
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(value);
	} catch (_) {
		return String(value);
	}
}
function post(type, text) {
	self.postMessage({ type, text });
}
function makeSend(level) {
	return function send() {
		var parts = [];
		for (var i = 0; i < arguments.length; i++) {
			parts.push(fmt(arguments[i]));
		}
		post(level, parts.join(" "));
	};
}
self.console = {
	log: makeSend("log"),
	info: makeSend("log"),
	warn: makeSend("warn"),
	error: makeSend("error"),
	debug: makeSend("log"),
};
self.addEventListener("error", function (event) {
	post("error", event.message || "Unknown error");
});
self.addEventListener("unhandledrejection", function (event) {
	var reason = event.reason && event.reason.message
		? event.reason.message
		: String(event.reason);
	post("error", "Unhandled promise rejection: " + reason);
});
var netSeq = 0;
var netPending = {};
self.net = {
	get: function netGet(url, options) {
		var id = ++netSeq;
		return new Promise(function (resolve, reject) {
			netPending[id] = { resolve: resolve, reject: reject };
			self.postMessage({
				type: "net",
				id: id,
				url: String(url),
				options: options || {}
			});
		});
	}
};
function settle(promise) {
	if (promise && typeof promise.then === "function") {
		promise.then(
			function (value) {
				if (value !== undefined) post("result", fmt(value));
				post("end", "");
			},
			function (error) {
				post("error", error && error.message ? error.message : String(error));
				post("end", "");
			}
		);
	} else {
		if (promise !== undefined) post("result", fmt(promise));
		post("end", "");
	}
}
self.addEventListener("message", function (event) {
	var data = event.data;
	if (data && data.type === "net-result") {
		var pending = netPending[data.id];
		if (!pending) return;
		delete netPending[data.id];
		if (data.ok) pending.resolve(data.response);
		else pending.reject(new Error(data.error));
		return;
	}
	if (!data || data.type !== "run") return;
	try {
		settle(self.eval(data.code));
	} catch (error) {
		post("error", error && error.message ? error.message : String(error));
		post("end", "");
	}
});
`;

/** Builds a Blob URL for the worker source. Exposed for tests. */
export function createWorkerUrl(source = JS_WORKER_SOURCE) {
	return URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
}
