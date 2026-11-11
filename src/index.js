"use strict";
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200, {'Content-Type': 'text/plain'}); res.end('Wa-guard is running'); }).listen(PORT, () => console.log('Health server listening on ' + PORT));


const path = require("path");
const qrcode = require("qrcode-terminal");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");

const logger = require("./lib/logger");
const { getGroupConfig } = require("./lib/config");
const { addWarning, getWarnings } = require("./lib/warnings");
const { isGroupAdmin, invalidate: invalidateGroupCache } = require("./lib/groupAdmins");
const { evaluateMessage } = require("./moderation");
const { handleCommand } = require("./commands");

const AUTH_DIR = path.join(__dirname, "..", "auth_info");

function extractText(msg) {
  const m = msg.message;
  if (!m) return "";
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ""
  );
}

async function punish({ sock, groupJid, senderJid, msg, violation, cfg, isSenderAdmin }) {
  const { kind, detail, action } = violation;

  // Always try to delete the offending message first when it's a content
  // violation (antilink / wordlock). Antispam has nothing to "delete" beyond
  // the latest message, so we skip that for it.
  if (kind !== "antispam") {
    try {
      await sock.sendMessage(groupJid, { delete: msg.key });
    } catch (err) {
      logger.warn("Failed to delete offending message:", err.message);
    }
  }

  const mention = `@${senderJid.split("@")[0]}`;

  if (action === "delete") {
    // Deletion already happened above; nothing further to do.
    return;
  }

  if (action === "warn") {
    const count = addWarning(groupJid, senderJid, kind);
    const limit = cfg[kind]?.warnLimit ?? 3;
    await sock.sendMessage(groupJid, {
      text: `⚠️ ${mention} — ${kind} violation (${detail}). Warning ${count}/${limit}.`,
      mentions: [senderJid]
    });
    if (count >= limit && !isSenderAdmin) {
      await kick({ sock, groupJid, senderJid, reason: `reached ${limit} ${kind} warnings` });
    }
    return;
  }

  if (action === "kick") {
    if (isSenderAdmin) {
      // Never auto-kick an admin even if a group owner misconfigured this.
      await sock.sendMessage(groupJid, {
        text: `⚠️ ${mention} triggered ${kind} (${detail}) but is a group admin — no action taken.`,
        mentions: [senderJid]
      });
      return;
    }
    await sock.sendMessage(groupJid, {
      text: `🚫 ${mention} removed — ${kind} violation (${detail}).`,
      mentions: [senderJid]
    });
    await kick({ sock, groupJid, senderJid });
  }
}

async function kick({ sock, groupJid, senderJid }) {
  try {
    await sock.groupParticipantsUpdate(groupJid, [senderJid], "remove");
  } catch (err) {
    logger.error(`Failed to remove ${senderJid} from ${groupJid} (is the bot a group admin?):`, err.message);
  }
}

async function handleGroupMessage(sock, msg) {
  const groupJid = msg.key.remoteJid;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  if (!senderJid || msg.key.fromMe) return;

  const text = extractText(msg);
  const cfg = getGroupConfig(groupJid);

  let isSenderAdmin = false;
  try {
    isSenderAdmin = await isGroupAdmin(sock, groupJid, senderJid);
  } catch (err) {
    logger.warn("Could not resolve group admin status:", err.message);
  }

  // Commands (owner/admin controlled) short-circuit moderation.
  if (text && text.startsWith(getPrefixSafe())) {
    const handled = await handleCommand({ sock, msg, groupJid, senderJid, text, isSenderAdmin });
    if (handled !== false) return;
  }

  if (cfg.adminsImmune && isSenderAdmin) return;

  const violations = evaluateMessage({ text, groupJid, senderJid, cfg });
  for (const violation of violations) {
    await punish({ sock, groupJid, senderJid, msg, violation, cfg, isSenderAdmin });
  }
}

function getPrefixSafe() {
  try {
    return require("./lib/config").getPrefix();
  } catch {
    return ".";
  }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        logger: logger.quiet,
        browser: ["wa-guard", "Chrome", "1.0.0"],
        printQRInTerminal: false
    });

    // PAIRING CODE kwa 255742661910
    if (!state.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode("255742661910");
                logger.info("PAIRING CODE YAKO: " + code);
            } catch (e) {
                logger.error("Pairing failed:", e);
            }
        }, 3000);
    }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    // QR imezimwa - tunatumia pairing code

    if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      logger.warn(`Connection closed (code ${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) start();
    } else if (connection === "open") {
      logger.info("✅ wa-guard connected.");
    }
  });

  sock.ev.on("group-participants.update", (update) => {
    invalidateGroupCache(update.id);
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (!msg.message) continue;
      const isGroup = msg.key.remoteJid?.endsWith("@g.us");
      if (!isGroup) continue;
      try {
        await handleGroupMessage(sock, msg);
      } catch (err) {
        logger.error("Error handling message:", err);
      }
    }
  });
}

start().catch((err) => {
  logger.error("Fatal startup error:", err);
  process.exit(1);
});
