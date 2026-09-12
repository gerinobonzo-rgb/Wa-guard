"use strict";

/**
 * Returns { violated: boolean, matched: string } for the first banned word
 * found (case-insensitive, substring match — keep the wordlist deliberate).
 */
function checkWordlock(text, cfg) {
  if (!cfg.enabled || !text) return { violated: false, matched: null };

  const lower = text.toLowerCase();
  const words = cfg.words || [];

  for (const word of words) {
    if (!word) continue;
    if (lower.includes(word.toLowerCase())) {
      return { violated: true, matched: word };
    }
  }
  return { violated: false, matched: null };
}

module.exports = { checkWordlock };
