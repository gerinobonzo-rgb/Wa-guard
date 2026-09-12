"use strict";

// Tiny TTL cache for group metadata so we don't hammer WhatsApp with
// groupMetadata() calls on every single message.
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // jid -> { data, expires }

async function getGroupMetadata(sock, jid) {
  const hit = cache.get(jid);
  if (hit && hit.expires > Date.now()) return hit.data;

  const data = await sock.groupMetadata(jid);
  cache.set(jid, { data, expires: Date.now() + CACHE_TTL_MS });
  return data;
}

function invalidate(jid) {
  cache.delete(jid);
}

async function isGroupAdmin(sock, jid, userJid) {
  const meta = await getGroupMetadata(sock, jid);
  const bareUser = userJid.split(":")[0];
  const participant = meta.participants.find((p) => p.id.split(":")[0] === bareUser);
  return !!participant && (participant.admin === "admin" || participant.admin === "superadmin");
}

module.exports = { getGroupMetadata, invalidate, isGroupAdmin };
