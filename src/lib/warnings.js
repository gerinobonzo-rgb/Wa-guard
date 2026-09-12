"use strict";

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const STORE_PATH = path.join(DATA_DIR, "warnings.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, "{}");

let store = JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));

function persist() {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function key(groupJid, userJid) {
  return `${groupJid}::${userJid}`;
}

/** Increment and return the new warning count for (group, user, kind). */
function addWarning(groupJid, userJid, kind) {
  const k = key(groupJid, userJid);
  if (!store[k]) store[k] = {};
  store[k][kind] = (store[k][kind] || 0) + 1;
  persist();
  return store[k][kind];
}

function getWarnings(groupJid, userJid, kind) {
  const k = key(groupJid, userJid);
  return (store[k] && store[k][kind]) || 0;
}

function resetWarnings(groupJid, userJid, kind) {
  const k = key(groupJid, userJid);
  if (!store[k]) return;
  if (kind) {
    delete store[k][kind];
  } else {
    delete store[k];
  }
  persist();
}

function resetAllForGroup(groupJid) {
  for (const k of Object.keys(store)) {
    if (k.startsWith(`${groupJid}::`)) delete store[k];
  }
  persist();
}

module.exports = { addWarning, getWarnings, resetWarnings, resetAllForGroup };
