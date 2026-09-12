"use strict";

const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "..", "..", "config.json");

function loadRaw() {
  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  return JSON.parse(raw);
}

let cache = loadRaw();

function reload() {
  cache = loadRaw();
  return cache;
}

function saveRaw() {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cache, null, 2));
}

/**
 * Deep-merge group-specific overrides on top of the shared defaults.
 * Group config in config.json only needs to contain the keys it overrides.
 */
function getGroupConfig(jid) {
  const base = JSON.parse(JSON.stringify(cache.defaults));
  const override = cache.groups[jid] || {};
  for (const section of Object.keys(override)) {
    if (typeof override[section] === "object" && !Array.isArray(override[section])) {
      base[section] = { ...base[section], ...override[section] };
    } else {
      base[section] = override[section];
    }
  }
  return base;
}

function setGroupConfig(jid, partial) {
  if (!cache.groups[jid]) cache.groups[jid] = {};
  for (const [section, value] of Object.entries(partial)) {
    if (typeof value === "object" && !Array.isArray(value)) {
      cache.groups[jid][section] = { ...(cache.groups[jid][section] || {}), ...value };
    } else {
      cache.groups[jid][section] = value;
    }
  }
  saveRaw();
}

function getPrefix() {
  return cache.prefix || ".";
}

function isOwner(numberJid) {
  const bare = numberJid.split("@")[0].split(":")[0];
  return (cache.ownerNumbers || []).some((n) => n.replace(/\D/g, "") === bare.replace(/\D/g, ""));
}

module.exports = {
  reload,
  getGroupConfig,
  setGroupConfig,
  getPrefix,
  isOwner
};
