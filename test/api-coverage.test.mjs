import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { apiPaths, currentBackendApi, internalBackendApi, productionUrls } from "../src/endpoints.js";

const browserOpenApi = new Set([
  "GET /healthz",
  "GET /readyz",
  "POST /platform/v1/whatsapp/contacts/eligibility",
  "POST /platform/v1/whatsapp/campaigns/validate",
  "POST /platform/v1/whatsapp/messages",
  "GET /platform/v1/whatsapp/conversations",
  "GET /platform/v1/whatsapp/conversations/:conversationId",
  "GET /platform/v1/whatsapp/conversations/:conversationId/timeline",
  "POST /platform/v1/whatsapp/conversations/:conversationId/claim",
  "POST /platform/v1/whatsapp/conversations/:conversationId/assign",
  "POST /platform/v1/whatsapp/conversations/:conversationId/escalate",
  "POST /platform/v1/whatsapp/conversations/:conversationId/resolve",
  "POST /platform/v1/whatsapp/conversations/:conversationId/reopen",
  "POST /platform/v1/whatsapp/conversations/:conversationId/automation/:action",
  "POST /platform/v1/whatsapp/ai/drafts",
  "GET /platform/v1/whatsapp/ai/drafts/:commandId",
  "GET /platform/v1/whatsapp/ai/drafts/:commandId/result",
  "GET /platform/v1/whatsapp/dead-letters",
  "POST /platform/v1/whatsapp/dead-letters/:deadLetterId/replay",
  "GET /platform/v1/whatsapp/operations/:operationId",
  "GET /platform/v1/whatsapp/me",
  "GET /platform/v1/whatsapp/dashboard",
  "GET /platform/v1/whatsapp/contacts",
  "POST /platform/v1/whatsapp/contacts",
  "GET /platform/v1/whatsapp/contacts/:contactId",
  "PATCH /platform/v1/whatsapp/contacts/:contactId",
  "GET /platform/v1/whatsapp/templates",
  "POST /platform/v1/whatsapp/templates",
  "GET /platform/v1/whatsapp/templates/:templateId",
  "PATCH /platform/v1/whatsapp/templates/:templateId",
  "GET /platform/v1/whatsapp/campaigns",
  "POST /platform/v1/whatsapp/campaigns",
  "GET /platform/v1/whatsapp/campaigns/:campaignId",
  "PATCH /platform/v1/whatsapp/campaigns/:campaignId"
]);

test("frontend catalog covers all 34 browser-facing operations in the WhatsApp AI draft contract", () => {
  const frontend = new Set(currentBackendApi.map((item) => item.method + " " + decodeURIComponent(item.path)));
  assert.equal(frontend.size, 34);
  assert.deepEqual(frontend, browserOpenApi);
});

test("every browser-facing operation has a concrete API client binding", () => {
  const source = fs.readFileSync(new URL("../src/api.js", import.meta.url), "utf8");
  for (const item of currentBackendApi) {
    assert.ok(source.includes("  " + item.key + ":"), "missing API client binding: " + item.key);
  }
});

test("internal API remains explicitly service-only and absent from browser bindings", () => {
  const source = fs.readFileSync(new URL("../src/api.js", import.meta.url), "utf8");
  assert.equal(internalBackendApi.length, 3);
  for (const item of internalBackendApi) {
    assert.ok(item.path.startsWith("/internal/"));
    assert.ok(!source.includes("  " + item.key + ":"), "internal route leaked into browser client: " + item.key);
  }
});

test("browser-facing endpoint map never points directly at provider services", () => {
  assert.equal(productionUrls.api, "https://api.codestra.co");
  assert.equal(apiPaths.messages, "/platform/v1/whatsapp/messages");
  for (const item of currentBackendApi) assert.ok(!item.path.startsWith("/internal/"));
});

test("sendMessage preserves backend authority for contact eligibility and actor identity", () => {
  const source = fs.readFileSync(new URL("../src/api.js", import.meta.url), "utf8");
  assert.ok(source.includes("idempotency_key: idempotencyKey"));
  const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.ok(app.includes("contact_id: contact.contact_id"));
  assert.ok(app.includes('campaign_id: "agent-console-direct"'));
  for (const stale of ["recipient: contact.phone", "consent_status: contact.consent_status", "suppressed:", "opted_out:"]) {
    assert.ok(!app.includes(stale), "frontend must not duplicate backend contact authority: " + stale);
  }
});

test("conversation assignment uses the current actor_id contract", () => {
  const source = fs.readFileSync(new URL("../src/api.js", import.meta.url), "utf8");
  assert.ok(source.includes("body: { actor_id: actorId, expected_version: expectedVersion, reason, team }"));
  assert.ok(!source.includes("assignee_id:"));
});


test("professional UX keeps critical controls interactive and fail-closed", () => {
  const source = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  for (const required of [
    "Search customer, number or status",
    "Conversation filters",
    "Pause automation",
    "Escalate",
    "window.confirm",
    "Outbound messaging is locked",
    "Enter to send",
    "notification-popover"
  ]) {
    assert.ok(source.includes(required), "missing professional UX contract: " + required);
  }
  assert.ok(source.includes('disabled={safeMode || !sendText.trim() || actionBusy === "send"}'));
  assert.ok(source.includes('api.setAutomation('));
  assert.ok(source.includes('api.escalate('));
});


test("AI assistant is draft-only and never auto-sends", () => {
  const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const api = fs.readFileSync(new URL("../src/api.js", import.meta.url), "utf8");
  for (const required of [
    "Suggest reply", "Rewrite", "Shorter", "More professional", "Translate", "Summarize", "Knowledge answer",
    "Draft-only · human review required · never auto-sends",
    "Use this draft", "Nothing was sent."
  ]) assert.ok(app.includes(required), "missing AI UX contract: " + required);
  for (const required of ["createAiDraft:", "aiDraft:", "aiDraftResult:"]) {
    assert.ok(api.includes(required), "missing AI API binding: " + required);
  }
  assert.ok(!app.includes('api.sendMessage({\n        contact_id: contact.contact_id,\n        campaign_id: "agent-console-direct",\n        message: { type: "text", text: aiPreview'));
});
