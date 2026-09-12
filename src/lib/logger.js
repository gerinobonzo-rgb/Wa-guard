"use strict";

// Minimal dependency-free logger — avoids pulling in pino-pretty just for
// colored output. Baileys itself wants a pino-compatible logger instance
// passed into makeWASocket, so we shape this like one (child/info/warn/error/debug).

function ts() {
  return new Date().toISOString();
}

function make(prefix = "") {
  const tag = prefix ? `[${prefix}] ` : "";
  return {
    info: (...args) => console.log(`${ts()} INFO  ${tag}`, ...args),
    warn: (...args) => console.warn(`${ts()} WARN  ${tag}`, ...args),
    error: (...args) => console.error(`${ts()} ERROR ${tag}`, ...args),
    debug: (...args) => {
      if (process.env.LOG_LEVEL === "debug") console.debug(`${ts()} DEBUG ${tag}`, ...args);
    },
    trace: () => {},
    child: (bindings = {}) => make(bindings.class || bindings.module || prefix)
  };
}

module.exports = make();
