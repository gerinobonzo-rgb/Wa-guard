"use strict";

// Zero-dependency smoke test for the pure moderation logic (no network/WhatsApp needed).
// Run with: node test/moderation.test.js

const assert = require("assert");
const { checkAntilink } = require("../src/moderation/antilink");
const { checkWordlock } = require("../src/moderation/wordlock");
const { checkAntispam, resetCounter } = require("../src/moderation/antispam");

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("antilink:");
test("flags a plain https link", () => {
  const r = checkAntilink("check this out https://example.com/x", { enabled: true, allowedDomains: [] });
  assert.strictEqual(r.violated, true);
});
test("flags a whatsapp invite link", () => {
  const r = checkAntilink("join here chat.whatsapp.com/AbC123", { enabled: true, allowedDomains: [] });
  assert.strictEqual(r.violated, true);
});
test("allows a whitelisted domain", () => {
  const r = checkAntilink("see https://youtube.com/watch?v=1", { enabled: true, allowedDomains: ["youtube.com"] });
  assert.strictEqual(r.violated, false);
});
test("does nothing when disabled", () => {
  const r = checkAntilink("https://spam.com", { enabled: false, allowedDomains: [] });
  assert.strictEqual(r.violated, false);
});
test("ignores plain text with no links", () => {
  const r = checkAntilink("hello everyone, how are you", { enabled: true, allowedDomains: [] });
  assert.strictEqual(r.violated, false);
});

console.log("wordlock:");
test("flags a banned phrase case-insensitively", () => {
  const r = checkWordlock("EARN MONEY fast!!", { enabled: true, words: ["earn money"] });
  assert.strictEqual(r.violated, true);
});
test("ignores clean messages", () => {
  const r = checkWordlock("good morning group", { enabled: true, words: ["earn money"] });
  assert.strictEqual(r.violated, false);
});

console.log("antispam:");
test("does not trip below threshold", () => {
  const cfg = { enabled: true, windowMs: 5000, maxMessages: 5, burstMs: 1000, burstMax: 10 };
  let last;
  for (let i = 0; i < 3; i++) last = checkAntispam("g1@g.us", "u1@s.whatsapp.net", cfg);
  assert.strictEqual(last.violated, false);
  resetCounter("g1@g.us", "u1@s.whatsapp.net");
});
test("trips the flood window after enough messages", () => {
  const cfg = { enabled: true, windowMs: 5000, maxMessages: 3, burstMs: 200, burstMax: 100 };
  let last;
  for (let i = 0; i < 4; i++) last = checkAntispam("g2@g.us", "u2@s.whatsapp.net", cfg);
  assert.strictEqual(last.violated, true);
  assert.strictEqual(last.reason, "window");
  resetCounter("g2@g.us", "u2@s.whatsapp.net");
});
test("trips burst threshold on rapid-fire messages", () => {
  const cfg = { enabled: true, windowMs: 60000, maxMessages: 999, burstMs: 500, burstMax: 3 };
  let last;
  for (let i = 0; i < 4; i++) last = checkAntispam("g3@g.us", "u3@s.whatsapp.net", cfg);
  assert.strictEqual(last.violated, true);
  assert.strictEqual(last.reason, "burst");
  resetCounter("g3@g.us", "u3@s.whatsapp.net");
});

console.log(`\n${passed} assertions passed.`);
if (process.exitCode) {
  console.error("SOME TESTS FAILED");
} else {
  console.log("ALL TESTS PASSED");
}
