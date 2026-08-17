import test from "node:test";
import assert from "node:assert/strict";
import { buildPlainText, buildSubject, cleanHeader, validateSubmission } from "../src/core.js";

const valid = { name: "Avery Chen", email: "avery@example.com", company: "Acme", subject: "Customer portal", message: "We need a better workflow." };

test("validates and normalizes a real submission", () => {
  const result = validateSubmission(valid);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, valid);
});

test("rejects malformed email and missing fields", () => {
  assert.equal(validateSubmission({ ...valid, email: "nope" }).ok, false);
  assert.equal(validateSubmission({ ...valid, subject: "" }).ok, false);
  assert.equal(validateSubmission({ ...valid, message: "" }).ok, false);
});

test("honeypot submissions are silently accepted without sending", () => {
  const result = validateSubmission({ ...valid, website: "https://spam.example" });
  assert.equal(result.ok, false);
  assert.equal(result.silent, true);
});

test("subject prefix is exact and header injection is removed", () => {
  assert.equal(buildSubject("Portal\r\nBcc: victim@example.com"), "CUSTOM SOFTWARE REQUEST: Portal Bcc: victim@example.com");
  assert.equal(cleanHeader(" A\nB ", 20), "A B");
});

test("plain-text email contains reply and project details", () => {
  const text = buildPlainText(valid, { submittedAt: "2026-08-17T00:00:00.000Z", country: "US" });
  assert.match(text, /Avery Chen/);
  assert.match(text, /avery@example\.com/);
  assert.match(text, /Customer portal/);
  assert.match(text, /better workflow/);
  assert.match(text, /Country: US/);
});
