"use strict";

// Deliberately simple & readable — this is the whole detector.
const URL_REGEX = /(https?:\/\/[^\s]+)|(\bchat\.whatsapp\.com\/[^\s]+)|(\bwa\.me\/[^\s]+)|(\b[a-z0-9.-]+\.(?:com|net|org|io|co|link|xyz|shop|site|online|club|top|info)\b[^\s]*)/gi;

/**
 * Extract all URL-looking substrings from a message.
 */
function extractLinks(text) {
  if (!text) return [];
  const matches = text.match(URL_REGEX) || [];
  return matches.map((m) => m.trim());
}

function hostnameOf(link) {
  try {
    const withScheme = link.startsWith("http") ? link : `http://${link}`;
    return new URL(withScheme).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return link.toLowerCase();
  }
}

/**
 * Returns { violated: boolean, matched: string[] } — matched links that are
 * NOT in the allowedDomains whitelist.
 */
function checkAntilink(text, cfg) {
  if (!cfg.enabled) return { violated: false, matched: [] };

  const links = extractLinks(text);
  if (links.length === 0) return { violated: false, matched: [] };

  const allowed = new Set((cfg.allowedDomains || []).map((d) => d.toLowerCase()));
  const matched = links.filter((link) => {
    const host = hostnameOf(link);
    return ![...allowed].some((a) => host === a || host.endsWith(`.${a}`));
  });

  return { violated: matched.length > 0, matched };
}

module.exports = { checkAntilink, extractLinks };
