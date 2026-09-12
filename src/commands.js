"use strict";

const { resetWarnings, resetAllForGroup } = require("./lib/warnings");
const { setGroupConfig, getGroupConfig, getPrefix, isOwner } = require("./lib/config");
const { resetCounter } = require("./moderation/antispam");

/**
 * Very small owner/admin-only command set for runtime control.
 * All commands are prefixed (default ".") and only work inside groups,
 * except where noted. `isSenderAdmin` is resolved by the caller (index.js)
 * so this module stays free of network calls.
 */
async function handleCommand({ sock, msg, groupJid, senderJid, text, isSenderAdmin }) {
  const prefix = getPrefix();
  if (!text.startsWith(prefix)) return false;

  const [cmdRaw, ...args] = text.slice(prefix.length).trim().split(/\s+/);
  const cmd = (cmdRaw || "").toLowerCase();

  const allowed = isSenderAdmin || isOwner(senderJid);
  const reply = (body) => sock.sendMessage(groupJid, { text: body }, { quoted: msg });

  switch (cmd) {
    case "antilink":
      if (!allowed) return reply("🚫 Admins only.");
      if (args[0] === "on" || args[0] === "off") {
        setGroupConfig(groupJid, { antilink: { enabled: args[0] === "on" } });
        return reply(`✅ Antilink turned ${args[0].toUpperCase()}.`);
      }
      return reply(`Usage: ${prefix}antilink on|off`);

    case "wordlock":
      if (!allowed) return reply("🚫 Admins only.");
      if (args[0] === "on" || args[0] === "off") {
        setGroupConfig(groupJid, { wordlock: { enabled: args[0] === "on" } });
        return reply(`✅ Wordlock turned ${args[0].toUpperCase()}.`);
      }
      if (args[0] === "add" && args[1]) {
        const cfg = getGroupConfig(groupJid);
        const words = [...new Set([...(cfg.wordlock.words || []), args.slice(1).join(" ")])];
        setGroupConfig(groupJid, { wordlock: { words } });
        return reply(`✅ Added banned phrase.`);
      }
      return reply(`Usage: ${prefix}wordlock on|off | ${prefix}wordlock add <phrase>`);

    case "antispam":
      if (!allowed) return reply("🚫 Admins only.");
      if (args[0] === "on" || args[0] === "off") {
        setGroupConfig(groupJid, { antispam: { enabled: args[0] === "on" } });
        return reply(`✅ Antispam turned ${args[0].toUpperCase()}.`);
      }
      return reply(`Usage: ${prefix}antispam on|off`);

    case "resetwarns": {
      if (!allowed) return reply("🚫 Admins only.");
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
      if (!mentioned) {
        resetAllForGroup(groupJid);
        return reply("✅ Cleared warnings for everyone in this group.");
      }
      resetWarnings(groupJid, mentioned);
      resetCounter(groupJid, mentioned);
      return reply(`✅ Cleared warnings for @${mentioned.split("@")[0]}`, );
    }

    case "status": {
      const cfg = getGroupConfig(groupJid);
      return reply(
        `*wa-guard status*\n` +
        `Antilink: ${cfg.antilink.enabled ? "ON" : "OFF"} (action: ${cfg.antilink.action})\n` +
        `Wordlock: ${cfg.wordlock.enabled ? "ON" : "OFF"} (${(cfg.wordlock.words || []).length} phrases)\n` +
        `Antispam: ${cfg.antispam.enabled ? "ON" : "OFF"} (${cfg.antispam.maxMessages}/${cfg.antispam.windowMs}ms, action: ${cfg.antispam.action})`
      );
    }

    case "help":
      return reply(
        `*wa-guard commands*\n` +
        `${prefix}status\n` +
        `${prefix}antilink on|off\n` +
        `${prefix}wordlock on|off\n` +
        `${prefix}wordlock add <phrase>\n` +
        `${prefix}antispam on|off\n` +
        `${prefix}resetwarns [@user]`
      );

    default:
      return false;
  }
}

module.exports = { handleCommand };
