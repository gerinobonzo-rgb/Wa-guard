"use strict";

const { checkAntilink } = require("./antilink");
const { checkWordlock } = require("./wordlock");
const { checkAntispam } = require("./antispam");

/**
 * Run every moderation check against a single incoming text message.
 * Returns an array of violation objects, most-severe first:
 *   { kind: "antilink" | "wordlock" | "antispam", detail, action }
 * `action` is copied straight from that module's config ("delete" | "warn" | "kick").
 */
function evaluateMessage({ text, groupJid, senderJid, cfg }) {
  const violations = [];

  const link = checkAntilink(text, cfg.antilink);
  if (link.violated) {
    violations.push({ kind: "antilink", detail: link.matched.join(", "), action: cfg.antilink.action });
  }

  const word = checkWordlock(text, cfg.wordlock);
  if (word.violated) {
    violations.push({ kind: "wordlock", detail: word.matched, action: cfg.wordlock.action });
  }

  // Antispam always runs (it needs every message to keep its timestamp window
  // accurate), even if link/word already triggered above.
  const spam = checkAntispam(groupJid, senderJid, cfg.antispam);
  if (spam.violated) {
    violations.push({ kind: "antispam", detail: `${spam.reason} (${spam.count} msgs)`, action: cfg.antispam.action });
  }

  return violations;
}

module.exports = { evaluateMessage };
