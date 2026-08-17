export const SUBJECT_PREFIX = "CUSTOM SOFTWARE REQUEST:";
export const MAX_SUBJECT_LENGTH = 120;
export const MAX_MESSAGE_LENGTH = 5000;
export const ALLOWED_ORIGINS = new Set([
  "https://quantaintellect.com",
  "https://www.quantaintellect.com",
]);

export function cleanHeader(value, maxLength) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, maxLength);
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "")) && String(value).length <= 254;
}

export function validateSubmission(input) {
  const name = cleanHeader(input?.name, 100);
  const email = cleanHeader(input?.email, 254);
  const subject = cleanHeader(input?.subject, MAX_SUBJECT_LENGTH);
  const message = String(input?.message || "").trim().slice(0, MAX_MESSAGE_LENGTH);
  const company = cleanHeader(input?.company, 120);
  const hasQuote = input?.hasQuote === true || input?.hasQuote === "yes";
  const website = cleanHeader(input?.website, 200);

  if (website) return { ok: false, silent: true, error: "Invalid submission" };
  if (!name) return { ok: false, error: "Please enter your name." };
  if (!validEmail(email)) return { ok: false, error: "Please enter a valid email address." };
  if (!subject) return { ok: false, error: "Please enter a subject." };
  if (!message) return { ok: false, error: "Please describe your project." };

  return { ok: true, value: { name, email, subject, message, company, hasQuote } };
}

export function buildSubject(subject) {
  return `${SUBJECT_PREFIX} ${cleanHeader(subject, MAX_SUBJECT_LENGTH)}`;
}

export function buildPlainText({ name, email, company, subject, message, hasQuote }, metadata = {}) {
  return [
    "New custom software inquiry",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Company: ${company || "Not provided"}`,
    `Existing quote or proposal: ${hasQuote ? "Yes" : "No"}`,
    `Subject: ${subject}`,
    `Submitted: ${metadata.submittedAt || new Date().toISOString()}`,
    metadata.country ? `Country: ${metadata.country}` : null,
    "",
    "Project details:",
    message,
  ].filter(line => line !== null).join("\n");
}
