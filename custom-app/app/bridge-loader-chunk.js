//#region ../../shared/utils/src/browser-polyfills.ts
/**
* Defence in depth for engines just below the declared browser floor.
* The floor is defined in `messaging/vite.browser-targets.mjs`.
*
* Internal Ada code should prefer direct helpers, such as `hasOwn(...)` from
* `guards.ts`. Every Ada bundle includes these fallbacks, including the host-page
* SDK. These fallbacks also ship inside the customer-held npm tarballs of the SDK
* and bridge. Each fallback defines a member only when it is missing. These
* fallbacks do not extend browser support below the floor required by the shipped CSS.
*/
var objectHasOwnProperty = Object.prototype.hasOwnProperty;
function defineValue(target, name, value) {
	Object.defineProperty(target, name, {
		value,
		configurable: true,
		writable: true
	});
}
if (!Object.hasOwn) defineValue(Object, "hasOwn", (object, key) => {
	if (object == null) throw new TypeError("ada browser-polyfills: Cannot convert undefined or null to object");
	return objectHasOwnProperty.call(Object(object), key);
});
function at(index) {
	const length = Math.trunc(Number(this.length)) || 0;
	let relativeIndex = Math.trunc(Number(index)) || 0;
	if (relativeIndex < 0) relativeIndex += length;
	return relativeIndex < 0 || relativeIndex >= length ? void 0 : this[relativeIndex];
}
function stringAt(index) {
	const value = String(this);
	const length = value.length;
	let relativeIndex = Math.trunc(Number(index)) || 0;
	if (relativeIndex < 0) relativeIndex += length;
	return relativeIndex < 0 || relativeIndex >= length ? void 0 : value.charAt(relativeIndex);
}
var typedArrayConstructors = [
	globalThis.Int8Array,
	globalThis.Uint8Array,
	globalThis.Uint8ClampedArray,
	globalThis.Int16Array,
	globalThis.Uint16Array,
	globalThis.Int32Array,
	globalThis.Uint32Array,
	globalThis.Float32Array,
	globalThis.Float64Array,
	globalThis.BigInt64Array,
	globalThis.BigUint64Array
].filter(Boolean);
if (!Array.prototype.at) defineValue(Array.prototype, "at", at);
if (!String.prototype.at) defineValue(String.prototype, "at", stringAt);
for (const TypedArrayConstructor of typedArrayConstructors) {
	const prototype = TypedArrayConstructor.prototype;
	if (!prototype.at) defineValue(prototype, "at", at);
}
//#endregion
//#region \0@oxc-project+runtime@0.122.0/helpers/typeof.js
function _typeof(o) {
	"@babel/helpers - typeof";
	return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
		return typeof o;
	} : function(o) {
		return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
	}, _typeof(o);
}
//#endregion
//#region \0@oxc-project+runtime@0.122.0/helpers/toPrimitive.js
function toPrimitive(t, r) {
	if ("object" != _typeof(t) || !t) return t;
	var e = t[Symbol.toPrimitive];
	if (void 0 !== e) {
		var i = e.call(t, r || "default");
		if ("object" != _typeof(i)) return i;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return ("string" === r ? String : Number)(t);
}
//#endregion
//#region \0@oxc-project+runtime@0.122.0/helpers/toPropertyKey.js
function toPropertyKey(t) {
	var i = toPrimitive(t, "string");
	return "symbol" == _typeof(i) ? i : i + "";
}
//#endregion
//#region \0@oxc-project+runtime@0.122.0/helpers/defineProperty.js
function _defineProperty(e, r, t) {
	return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
		value: t,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[r] = t, e;
}
//#endregion
//#region src/npm/loader.ts
var DEFAULT_CDN_BASE = "https://messaging-assets.ada.support";
var FALLBACK_CDN_BASE = "https://static.ada.support/messaging/";
var CUSTOM_APP_FRAME_NAME = "ada-custom-app";
var BRIDGE_ENTRY_PATH = "bridge/bridge.js";
var DEV_BUILD_MARKER = "dev";
var PINNED_BUILD_SHA_PATTERN = /^[0-9a-f]{40}$/i;
var PR_BUILD_ALIAS_PATTERN = /^pr-\d+$/;
/** Typed failure raised by {@link loadMessagingBridge}. */
var MessagingBridgeLoadError = class extends Error {
	constructor(message, code, cause, fallbackCause) {
		super(message);
		_defineProperty(this, "code", void 0);
		this.name = "MessagingBridgeLoadError";
		this.code = code;
		if (cause !== void 0) this.cause = cause;
		if (fallbackCause !== void 0) Object.defineProperty(this, "fallbackCause", {
			value: fallbackCause,
			enumerable: true
		});
	}
};
var defaultImportModule = (url) => import(
	/* webpackIgnore: true */
	/* @vite-ignore */
	url
);
var loadsByImporter = /* @__PURE__ */ new WeakMap();
var FALLBACK_WARNING_KEY = Symbol.for("ada.messaging.bridge.fallbackWarning");
var warningScope = globalThis;
var LOOPBACK_HOSTS = new Set([
	"localhost",
	"127.0.0.1",
	"[::1]",
	"::1"
]);
function isLoopbackHostname(hostname) {
	const normalized = hostname.trim().toLowerCase();
	return LOOPBACK_HOSTS.has(normalized) || normalized.endsWith(".localhost");
}
function trimTrailingSlashes(value) {
	let end = value.length;
	while (end > 0 && value[end - 1] === "/") end -= 1;
	return value.slice(0, end);
}
function bridgeFrameOnlyMessage(message) {
	return `${message} The bridge only runs inside an Ada-mounted custom-app frame.`;
}
var FRAME_NAME_MARKER_PREFIX = `${CUSTOM_APP_FRAME_NAME}:`;
function frameNameCarriesBuild(name) {
	return name.startsWith(FRAME_NAME_MARKER_PREFIX);
}
/**
* Read the build marker core stamps into the frame's `window.name`
* (`ada-custom-app:<marker>`). The name is Ada-owned for this frame, so the
* marker never touches customer-owned URL state such as a hash route.
*/
function resolveBridgeBuildFromFrameName(name) {
	if (name === CUSTOM_APP_FRAME_NAME) throw new MessagingBridgeLoadError("The mounting Ada core predates build-marker delivery, so it cannot select a versioned bridge. The Ada core rollout must include the marker-stamping core before the npm bridge can load.", "missing_build_sha");
	if (!frameNameCarriesBuild(name)) throw new MessagingBridgeLoadError(`${bridgeFrameOnlyMessage("This document was not mounted by an Ada core frame: window.name carries no ada-custom-app build marker.")} If this frame is Ada-mounted, make sure @ada-cx/messaging-bridge (or its /react entry) is imported from a module your page evaluates at startup — a lazily loaded chunk evaluates after customer code could overwrite window.name.`, "missing_build_sha");
	const value = name.slice(FRAME_NAME_MARKER_PREFIX.length);
	if (value === DEV_BUILD_MARKER) return { kind: "dev" };
	if (PR_BUILD_ALIAS_PATTERN.test(value)) return {
		kind: "alias",
		identifier: value
	};
	if (!PINNED_BUILD_SHA_PATTERN.test(value)) throw new MessagingBridgeLoadError(bridgeFrameOnlyMessage(`The window.name build marker must be exactly a bare 40-character hex git SHA or a lowercase pr-<N> alias. URLs and paths are not allowed: "${value}".`), "invalid_build_sha");
	return {
		kind: "sha",
		identifier: value.toLowerCase()
	};
}
var initialFrameName = typeof window === "undefined" ? "" : window.name;
var initialFrameNameHasBuild = frameNameCarriesBuild(initialFrameName);
function currentFrameName() {
	if (initialFrameNameHasBuild) return initialFrameName;
	return typeof window === "undefined" ? "" : window.name;
}
function resolveCdnBase(cdnBase) {
	const base = trimTrailingSlashes((cdnBase ?? DEFAULT_CDN_BASE).trim());
	let url;
	try {
		url = new URL(base);
	} catch (cause) {
		throw new MessagingBridgeLoadError(`The cdnBase option is not a valid URL: "${base}".`, "invalid_cdn_base", cause);
	}
	const isHttps = url.protocol === "https:";
	const isLoopbackHttp = url.protocol === "http:" && isLoopbackHostname(url.hostname);
	if (!isHttps && !isLoopbackHttp) throw new MessagingBridgeLoadError(`The cdnBase option must use https (plain http is allowed only for loopback hosts): "${base}".`, "invalid_cdn_base");
	return {
		base,
		hostname: url.hostname
	};
}
/**
* Resolve the bridge asset URL from this frame's name marker and the CDN
* base. Production builds always resolve the immutable SHA-rooted asset.
* PR aliases stay under the configured CDN base. A production-base alias that
* does not exist fails closed through the normal bridge import error.
* Local development resolves `/bridge/bridge.js` only on a loopback base.
* This reports the configured root only, not the root a fallback load used.
*/
function resolveBridgeCdnUrl(options) {
	const build = resolveBridgeBuildFromFrameName(currentFrameName());
	const { base, hostname } = resolveCdnBase(options?.cdnBase);
	if (build.kind === "dev" && !isLoopbackHostname(hostname)) throw new MessagingBridgeLoadError(bridgeFrameOnlyMessage(`The ${FRAME_NAME_MARKER_PREFIX}${DEV_BUILD_MARKER} frame-name marker requires a loopback cdnBase.`), "dev_marker_not_loopback");
	const assetPath = build.kind === "dev" ? `/${BRIDGE_ENTRY_PATH}` : `/${build.identifier}/${BRIDGE_ENTRY_PATH}`;
	return new URL(`${base}${assetPath}`).toString();
}
var REQUIRED_BRIDGE_FUNCTION_EXPORTS = [
	"createBridgeClient",
	"messageKey",
	"isHistoricalRow",
	"findFirstUnread",
	"selectUnread",
	"groupMessages",
	"filterDisplayable",
	"resolveBotName",
	"isAgentTyping",
	"isConnectivityLost"
];
function isMessagingBridgeModule(value) {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value;
	return candidate.STATE != null && REQUIRED_BRIDGE_FUNCTION_EXPORTS.every((key) => typeof candidate[key] === "function");
}
function describeRejection(cause) {
	try {
		return cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
	} catch {
		return "unknown error";
	}
}
async function importBridgeModule(url, importModule) {
	let loaded;
	try {
		loaded = await importModule(url);
	} catch (cause) {
		throw new MessagingBridgeLoadError(`The Ada bridge runtime failed to load from ${url}.`, "bridge_import_failed", cause);
	}
	if (!isMessagingBridgeModule(loaded)) throw new MessagingBridgeLoadError(`The module at ${url} does not expose the full Ada bridge surface; it is not a complete Ada bridge build.`, "bridge_module_invalid");
	return loaded;
}
function memoizeLoad(cache, url, load) {
	const existing = cache.get(url);
	if (existing) return existing;
	const pending = load();
	cache.set(url, pending);
	pending.catch(() => {
		if (cache.get(url) === pending) cache.delete(url);
	});
	return pending;
}
/**
* Load the bridge runtime that matches the mounting core frame. Loads are
* memoized per resolved URL and importer. A failed load is evicted for retry.
* Without `cdnBase`, an import failure at the default root is retried once
* from {@link FALLBACK_CDN_BASE}.
*/
function loadMessagingBridge(options = {}) {
	const importModule = options.importModule ?? defaultImportModule;
	let url;
	let fallbackUrl;
	try {
		url = resolveBridgeCdnUrl(options);
		if (options.cdnBase === void 0) fallbackUrl = resolveBridgeCdnUrl({ cdnBase: FALLBACK_CDN_BASE });
	} catch (error) {
		return Promise.reject(error);
	}
	const state = loadsByImporter.get(importModule) ?? {
		imports: /* @__PURE__ */ new Map(),
		defaultLoads: /* @__PURE__ */ new Map()
	};
	loadsByImporter.set(importModule, state);
	const load = (entryUrl) => memoizeLoad(state.imports, entryUrl, () => importBridgeModule(entryUrl, importModule));
	if (fallbackUrl === void 0) return load(url);
	const retryUrl = fallbackUrl;
	return memoizeLoad(state.defaultLoads, url, () => load(url).catch(async (error) => {
		if (!(error instanceof MessagingBridgeLoadError) || error.code !== "bridge_import_failed") throw error;
		let module;
		try {
			module = await load(retryUrl);
		} catch (cause) {
			if (!(cause instanceof MessagingBridgeLoadError)) throw cause;
			throw new MessagingBridgeLoadError(cause.code === "bridge_import_failed" ? `The Ada bridge runtime failed to load from both ${url} and ${retryUrl}.` : cause.message, cause.code, error, cause);
		}
		if (!warningScope[FALLBACK_WARNING_KEY]) {
			warningScope[FALLBACK_WARNING_KEY] = true;
			const cause = error.cause;
			try {
				console.warn(cause instanceof TypeError ? `[Ada] Loaded the Messaging bridge from ${FALLBACK_CDN_BASE} because the default root ${DEFAULT_CDN_BASE}/ was blocked or unavailable. Add ${DEFAULT_CDN_BASE} to script-src, connect-src and frame-src, or pass cdnBase: "${FALLBACK_CDN_BASE}".` : `[Ada] Loaded the Messaging bridge from ${FALLBACK_CDN_BASE} because the module at ${url} failed to evaluate (${describeRejection(cause)}). This is an Ada-side problem, not your host's CSP. Report it to Ada.`, cause);
			} catch {}
		}
		return module;
	}));
}
//#endregion
export { resolveBridgeCdnUrl as i, MessagingBridgeLoadError as n, loadMessagingBridge as r, FALLBACK_CDN_BASE as t };

//# sourceMappingURL=loader-BjjKuT42.js.map