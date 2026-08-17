import { ALLOWED_ORIGINS, buildPlainText, buildSubject, validateSubmission } from "./core.js";

const RESEND_API = "https://api.resend.com/emails";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60;

function corsHeaders(origin) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(origin, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(origin) });
}

async function isRateLimited(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const bucket = Math.floor(Date.now() / (RATE_LIMIT_WINDOW_SECONDS * 1000));
  const key = `contact:${ip}:${bucket}`;
  const count = Number(await env.CONTACT_RATE_LIMIT.get(key) || "0");
  if (count >= RATE_LIMIT_MAX) return true;
  await env.CONTACT_RATE_LIMIT.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS * 2 });
  return false;
}

async function sendContactEmail(env, submission, request) {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");
  const response = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Quanta Intellect Website <website@premium.quantaintellect.com>",
      to: ["hello@quantaintellect.com"],
      reply_to: submission.email,
      subject: buildSubject(submission.subject),
      text: buildPlainText(submission, {
        submittedAt: new Date().toISOString(),
        country: request.cf?.country || "",
      }),
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend delivery failed (${response.status}): ${detail.slice(0, 500)}`);
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json(origin, { ok: true, service: "quanta-contact-form" });
    }

    if (!ALLOWED_ORIGINS.has(origin)) return json(origin, { error: "Origin not allowed" }, 403);

    if (request.method === "OPTIONS") {
      const headers = corsHeaders(origin);
      headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Content-Type";
      headers["Access-Control-Max-Age"] = "86400";
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== "POST" || url.pathname !== "/submit") {
      return json(origin, { error: "Not found" }, 404);
    }

    if (!String(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
      return json(origin, { error: "Content-Type must be application/json" }, 415);
    }

    if (await isRateLimited(request, env)) {
      return json(origin, { error: "Too many requests. Please try again later or email hello@quantaintellect.com." }, 429);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json(origin, { error: "Invalid request body" }, 400);
    }

    const result = validateSubmission(payload);
    if (!result.ok) {
      if (result.silent) return json(origin, { ok: true });
      return json(origin, { error: result.error }, 400);
    }

    try {
      await sendContactEmail(env, result.value, request);
      return json(origin, { ok: true });
    } catch (error) {
      console.error("Contact email delivery failed", error);
      return json(origin, { error: "We couldn't send your request right now. Please email hello@quantaintellect.com directly." }, 502);
    }
  },
};
