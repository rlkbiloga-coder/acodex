/**
 * fetch() compatible wrapper that uses cordova-plugin-advanced-http when
 * available. The native HTTP stack ignores CORS, which providers such as
 * NVIDIA NIM do not allow from a WebView origin ("Failed to fetch").
 * Falls back to the regular fetch outside Cordova (tests, browsers).
 */

const CHUNK_SIZE = 48;

function getHttp() {
	return globalThis.cordova?.plugin?.http || null;
}

/**
 * @param {string} text
 * @param {AbortSignal} [signal]
 * @returns {ReadableStream<Uint8Array>}
 */
function textToSseStream(text, signal) {
	const encoder = new TextEncoder();
	return new ReadableStream({
		start(controller) {
			// Native plugin returns the whole body at once; replay it in chunks
			// so the SSE parser sees a normal stream.
			for (let i = 0; i < text.length; i += CHUNK_SIZE) {
				if (signal?.aborted) break;
				controller.enqueue(encoder.encode(text.slice(i, i + CHUNK_SIZE)));
			}
			controller.close();
		},
	});
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export function nativeFetch(url, init = {}) {
	const http = getHttp();
	if (!http?.sendRequest) return globalThis.fetch(url, init);

	const { signal } = init;
	if (signal?.aborted) {
		return Promise.reject(new DOMException("Aborted", "AbortError"));
	}

	return new Promise((resolve, reject) => {
		let settled = false;
		let onAbort = null;
		let requestId = null;

		const cleanup = () => {
			if (onAbort && signal?.removeEventListener) {
				signal.removeEventListener("abort", onAbort);
			}
		};

		if (signal) {
			onAbort = () => {
				if (settled) return;
				settled = true;
				cleanup();
				try {
					if (requestId != null) http.abort(requestId);
				} catch {
					// ignore abort failures
				}
				reject(new DOMException("Aborted", "AbortError"));
			};
			signal.addEventListener("abort", onAbort);
		}

		requestId = http.sendRequest(
			url,
			{
				method: (init.method || "GET").toLowerCase(),
				headers: init.headers || {},
				data: typeof init.body === "string" ? init.body : undefined,
				serializer: "utf8",
				responseType: "text",
				timeout: 120,
			},
			(res) => {
				if (settled) return;
				settled = true;
				cleanup();
				const body = res.data ?? "";
				resolve(buildResponse(body, res.status, res.headers, init.signal));
			},
			(err) => {
				if (settled) return;
				settled = true;
				cleanup();
				// HTTP error codes still carry a body we want to surface.
				if (err && typeof err.status === "number" && err.status > 0) {
					resolve(buildResponse(err.error ?? "", err.status, err.headers));
					return;
				}
				reject(new TypeError(err?.error || "Failed to fetch"));
			},
		);
	});
}

/**
 * @param {string} body
 * @param {number} status
 * @param {Record<string,string>} [headers]
 * @param {AbortSignal} [signal]
 */
function buildResponse(body, status, headers = {}, signal) {
	const isStream = /text\/event-stream/i.test(
		headers["content-type"] || headers["Content-Type"] || "",
	);
	const init = { status: status === 204 ? 200 : status, headers };
	if (isStream) {
		return new Response(textToSseStream(body, signal), init);
	}
	return new Response(body, init);
}
