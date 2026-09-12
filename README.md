# wa-guard

A tiny, fully-readable WhatsApp group moderation bot: **antilink, banned-word lock, and flood/antispam protection.**

Built directly on [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys) (MIT, ~11k stars, actively maintained). No closed-source binaries, no third-party dashboards, no telemetry, no code you can't read in five minutes. Everything the bot does lives in `src/`.

> ⚠️ **Honesty first:** Baileys is an *unofficial* WhatsApp Web protocol client. Automating WhatsApp this way is against WhatsApp's Terms of Service, and Meta does detect and ban numbers that behave in obviously automated ways. Use a secondary number for testing, keep punishment thresholds sane, and understand the ban risk before pointing this at your primary account.

## What it does

| Feature | Behavior |
|---|---|
| **Antilink** | Detects links (including `chat.whatsapp.com` invite links) in group messages, deletes them, and optionally warns/kicks the sender. Domains can be allow-listed. |
| **Wordlock** | Deletes any message containing a configured banned phrase (scam keywords, spam phrases, etc.). |
| **Antispam** | Sliding-window flood detector (`N messages in M ms`) plus a fast "burst" threshold for bot-speed spam. Warns then kicks repeat offenders. |
| **Admin immunity** | Group admins are never auto-punished (configurable). |
| **Per-group config** | Every group can override the shared defaults independently, stored in `config.json`. |

## Why this exists

Closed-source "WhatsApp bot" projects (forked-and-reskinned MD bots, prebuilt binaries downloaded from anonymous GitHub releases, etc.) ask you to hand over your WhatsApp session to code you can't read. This repo is the opposite: every moderation rule is under 60 lines, in `src/moderation/`, and you can — and should — read all of it before running it against your account.

## Setup

```bash
git clone git@github.com:overtunned/wa-guard.git
cd wa-guard
npm install
cp config.json.example config.json   # if you keep an example file; otherwise edit config.json directly
node src/index.js
```

On first run, a QR code prints to your terminal. Scan it from WhatsApp → Linked Devices. Session credentials are saved to `auth_info/` (git-ignored — **never commit this directory**, it is equivalent to your WhatsApp login).

## Configuration (`config.json`)

```jsonc
{
  "prefix": ".",
  "ownerNumbers": ["15551234567"],   // no +, no spaces
  "defaults": {
    "antilink":  { "enabled": true, "allowedDomains": [], "warnLimit": 3, "action": "kick" },
    "wordlock":  { "enabled": true, "words": ["chat.whatsapp.com", "free money"], "action": "delete" },
    "antispam":  { "enabled": true, "windowMs": 4000, "maxMessages": 6, "burstMs": 1000, "burstMax": 8, "action": "warn", "warnLimit": 3 },
    "adminsImmune": true
  },
  "groups": {
    // Optional per-group overrides, keyed by group JID (e.g. "1203630xxxx@g.us")
    // "1203630xxxx@g.us": { "antilink": { "action": "warn" } }
  }
}
```

`action` per module: `"delete"` (just remove the message), `"warn"` (warn, then kick after `warnLimit` hits), or `"kick"` (immediate removal, no warning).

## In-chat commands (admins/owner only)

```
.status                 Show current config for this group
.antilink on|off
.wordlock on|off
.wordlock add <phrase>
.antispam on|off
.resetwarns [@user]     Clear warnings for one user, or everyone if no mention
```

## Requirements

- The bot's WhatsApp account **must be a group admin** to delete messages or remove participants.
- Node.js 18+.

## Deployment notes

- Run this on a box you control (a spare VPS, a Docker container, whatever). Nothing phones home except WhatsApp's own servers via Baileys.
- Use a **secondary/spare number**, not your primary daily-driver number, especially while tuning thresholds.
- `data/warnings.json` persists warning counts across restarts; delete it to reset everyone.
- Antispam counters are in-memory only and reset on restart by design (a rate limiter shouldn't punish someone for activity before a crash).

### Running with Docker

```bash
mkdir -p auth_info data
sudo chown -R 1001:1001 auth_info data   # container runs as uid 1001, non-root
docker compose up -d --build
docker compose logs -f                    # scan the QR code shown here
```

The container publishes no ports (outbound-only), runs as a non-root user, and mounts `auth_info/`, `data/`, and `config.json` from the host so your session/config survive rebuilds. `docker compose down && docker compose up -d` will reconnect using the saved session — no need to re-scan the QR unless you log out from the WhatsApp app or delete `auth_info/`.


## What this does *not* do

- No mass-kick / mass-message tooling (footgun risk, deliberately omitted).
- No remote/JID-alias batch management across groups you're not in — every group is configured independently and explicitly.
- No auto-approval or invite-link regeneration logic — your group link/join settings are completely untouched by this bot. It only reacts to messages after they're posted.

## License

MIT — see [LICENSE](./LICENSE).
