"use strict";

// Minimal dependency-free logger — avoids pulling in pino-pretty just for
// colored output. Baileys itself wants a pino-compatible logger instance
// passed into makeWASocket, so we shape this like one (child/info/warn/error/debug).
//
// NOTE: Baileys is very chatty at "info" level — it logs full protocol
// objects (handshake buffers, client payloads, etc.) meant for pino's
// single-line JSON formatting, not console.log's multi-line pretty-print.
// `quiet: true` (used for the socket passed into makeWASocket) suppresses
// info/debug/trace so the terminal stays readable; warnings/errors still
// come through. Our own app logs always use the normal (non-quiet) logger.

function ts() {
  return new Date().toISOString();
}

function make(prefix = "", quiet = false) {
  const tag = prefix ? `[${prefix}] ` : "";
  return {
    info: (...args) => {
      if (!quiet) console.log(`${ts()} INFO  ${tag}`, ...args);
    },
    warn: (...args) => console.warn(`${ts()} WARN  ${tag}`, ...args),
    error: (...args) => console.error(`${ts()} ERROR ${tag}`, ...args),
    debug: (...args) => {
      if (process.env.LOG_LEVEL === "debug") console.debug(`${ts()} DEBUG ${tag}`, ...args);
    },
    trace: () => {},
    child: (bindings = {}) => make(bindings.class || bindings.module || prefix, quiet)
  };
}

const appLogger = make();
appLogger.quiet = make("baileys", process.env.LOG_LEVEL !== "debug");

module.exports = appLogger;

