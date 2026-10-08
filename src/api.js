import { getAccessToken, isDevBypass, sessionIdentity } from "./auth.js";

const baseUrl = String(import.meta.env.VITE_WHATSAPP_API_BASE_URL || "").replace(/\/+$/, "");

function makeId(prefix) {
  return prefix + "-" + crypto.randomUUID();
}

function queryString(query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? "?" + encoded : "";
}

async function request(path, options = {}) {
  if (!baseUrl) throw new Error("VITE_WHATSAPP_API_BASE_URL is not configured");
  const identity = sessionIdentity();
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");

  const token = getAccessToken();
  if (token) headers.set("authorization", "Bearer " + token);
  if (identity.tenantId) headers.set("x-tenant-id", identity.tenantId);
  if (isDevBypass()) headers.set("x-actor-id", identity.subject || "frontend-dev");

  const response = await fetch(baseUrl + path, {
    ...options,
    headers,
    body: options.body === undefined || typeof options.body === "string"
      ? options.body
      : JSON.stringify(options.body)
  });

  const type = response.headers.get("content-type") || "";
  const payload = type.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const error = new Error(payload?.error?.message || payload?.message || "Request failed with status " + response.status);
    error.status = response.status;
    error.code = payload?.error?.code || payload?.code || "request_failed";
    error.details = payload?.error?.details || payload?.details;
    throw error;
  }
  return { data: payload, response };
}

export const api = {
  health: () => request("/healthz").then((r) => r.data),
  ready: () => request("/readyz").then((r) => r.data),

  me: () => request("/platform/v1/whatsapp/me").then((r) => r.data),
  dashboard: () => request("/platform/v1/whatsapp/dashboard").then((r) => r.data),
  eligibility: (body) => request("/platform/v1/whatsapp/contacts/eligibility", { method: "POST", body }).then((r) => r.data),

  conversations: (query) => request("/platform/v1/whatsapp/conversations" + queryString(query)).then((r) => r.data),
  conversation: (id) => request("/platform/v1/whatsapp/conversations/" + encodeURIComponent(id)).then((r) => r.data),
  timeline: (id) => request("/platform/v1/whatsapp/conversations/" + encodeURIComponent(id) + "/timeline").then((r) => r.data),
  claim: (id, expectedVersion) => request("/platform/v1/whatsapp/conversations/" + encodeURIComponent(id) + "/claim", {
    method: "POST",
    body: { expected_version: expectedVersion }
  }).then((r) => r.data),
  assign: (id, actorId, expectedVersion, reason, team) => request("/platform/v1/whatsapp/conversations/" + encodeURIComponent(id) + "/assign", {
    method: "POST",
    body: { actor_id: actorId, expected_version: expectedVersion, reason, team }
  }).then((r) => r.data),
  escalate: (id, expectedVersion, reason) => request("/platform/v1/whatsapp/conversations/" + encodeURIComponent(id) + "/escalate", {
    method: "POST",
    body: { expected_version: expectedVersion, reason }
  }).then((r) => r.data),
  resolve: (id, expectedVersion, reason) => request("/platform/v1/whatsapp/conversations/" + encodeURIComponent(id) + "/resolve", {
    method: "POST",
    body: { expected_version: expectedVersion, reason }
  }).then((r) => r.data),
  reopen: (id, expectedVersion, reason) => request("/platform/v1/whatsapp/conversations/" + encodeURIComponent(id) + "/reopen", {
    method: "POST",
    body: { expected_version: expectedVersion, reason }
  }).then((r) => r.data),
  setAutomation: (id, action, expectedVersion, reason) => request("/platform/v1/whatsapp/conversations/" + encodeURIComponent(id) + "/automation/" + action, {
    method: "POST",
    body: { expected_version: expectedVersion, reason }
  }).then((r) => r.data),

  createAiDraft: (body) => request("/platform/v1/whatsapp/ai/drafts", { method: "POST", body }).then((r) => r.data),
  aiDraft: (id) => request("/platform/v1/whatsapp/ai/drafts/" + encodeURIComponent(id)).then((r) => r.data),
  aiDraftResult: (id) => request("/platform/v1/whatsapp/ai/drafts/" + encodeURIComponent(id) + "/result").then((r) => r.data),

  contacts: (query) => request("/platform/v1/whatsapp/contacts" + queryString(query)).then((r) => r.data),
  contact: (id) => request("/platform/v1/whatsapp/contacts/" + encodeURIComponent(id)).then((r) => r.data),
  createContact: (body) => request("/platform/v1/whatsapp/contacts", { method: "POST", body }).then((r) => r.data),
  updateContact: (id, body) => request("/platform/v1/whatsapp/contacts/" + encodeURIComponent(id), { method: "PATCH", body }).then((r) => r.data),

  templates: (query) => request("/platform/v1/whatsapp/templates" + queryString(query)).then((r) => r.data),
  template: (id) => request("/platform/v1/whatsapp/templates/" + encodeURIComponent(id)).then((r) => r.data),
  createTemplate: (body) => request("/platform/v1/whatsapp/templates", { method: "POST", body }).then((r) => r.data),
  updateTemplate: (id, body) => request("/platform/v1/whatsapp/templates/" + encodeURIComponent(id), { method: "PATCH", body }).then((r) => r.data),

  campaigns: (query) => request("/platform/v1/whatsapp/campaigns" + queryString(query)).then((r) => r.data),
  campaign: (id) => request("/platform/v1/whatsapp/campaigns/" + encodeURIComponent(id)).then((r) => r.data),
  validateCampaign: (body) => request("/platform/v1/whatsapp/campaigns/validate", { method: "POST", body }).then((r) => r.data),
  createCampaign: (body) => request("/platform/v1/whatsapp/campaigns", { method: "POST", body }).then((r) => r.data),
  updateCampaign: (id, body) => request("/platform/v1/whatsapp/campaigns/" + encodeURIComponent(id), { method: "PATCH", body }).then((r) => r.data),

  sendMessage: (body) => {
    const idempotencyKey = body.idempotency_key || makeId("wa-idem");
    return request("/platform/v1/whatsapp/messages", {
      method: "POST",
      headers: {
        "x-command-id": crypto.randomUUID(),
        "x-correlation-id": makeId("wa"),
        "idempotency-key": idempotencyKey
      },
      body: { ...body, idempotency_key: idempotencyKey }
    }).then((r) => r.data);
  },

  operation: (id) => request("/platform/v1/whatsapp/operations/" + encodeURIComponent(id), {
    headers: { "x-correlation-id": makeId("read") }
  }).then((r) => r.data),

  deadLetters: (query) => request("/platform/v1/whatsapp/dead-letters" + queryString(query)).then((r) => r.data),
  replayDeadLetter: (id, reason) => request("/platform/v1/whatsapp/dead-letters/" + encodeURIComponent(id) + "/replay", {
    method: "POST",
    headers: {
      "x-command-id": crypto.randomUUID(),
      "x-correlation-id": makeId("replay"),
      "idempotency-key": makeId("wa-replay")
    },
    body: { reason }
  }).then((r) => r.data)
};

export { baseUrl, queryString };
