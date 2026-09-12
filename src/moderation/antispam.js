"use strict";

/**
 * In-memory sliding-window flood detector. State is intentionally NOT
 * persisted to disk — a restart just resets everyone's counters, which is
 * the correct/safe behaviour for a rate limiter.
 *
 * state shape: Map<"group::user", number[]> (message timestamps, ms)
 */
const state = new Map();

function key(groupJid, userJid) {
  return `${groupJid}::${userJid}`;
}

function prune(timestamps, now, windowMs) {
  return timestamps.filter((t) => now - t <= windowMs);
}

/**
 * Record a message and decide if it trips flood or burst thresholds.
 * Returns { violated: boolean, reason: "burst" | "window" | null, count: number }
 */
function checkAntispam(groupJid, userJid, cfg) {
  if (!cfg.enabled) return { violated: false, reason: null, count: 0 };

  const now = Date.now();
  const k = key(groupJid, userJid);
  let timestamps = state.get(k) || [];

  timestamps.push(now);
  // Keep only what's relevant to the larger of the two windows to bound memory.
  const maxWindow = Math.max(cfg.windowMs, cfg.burstMs);
  timestamps = prune(timestamps, now, maxWindow);
  state.set(k, timestamps);

  const inBurstWindow = prune(timestamps, now, cfg.burstMs).length;
  if (inBurstWindow >= cfg.burstMax) {
    return { violated: true, reason: "burst", count: inBurstWindow };
  }

  const inFloodWindow = prune(timestamps, now, cfg.windowMs).length;
  if (inFloodWindow >= cfg.maxMessages) {
    return { violated: true, reason: "window", count: inFloodWindow };
  }

  return { violated: false, reason: null, count: inFloodWindow };
}

/** Clear a user's flood counters, e.g. after punishing them. */
function resetCounter(groupJid, userJid) {
  state.delete(key(groupJid, userJid));
}

module.exports = { checkAntispam, resetCounter };
