export const productionUrls = Object.freeze({
  frontend: "https://whatsapp.codestra.co",
  api: "https://api.codestra.co",
  keycloak: "https://auth.codestra.co",
  keycloakIssuer: "https://auth.codestra.co/realms/codestra",
  whatsappInternal: "http://whatsapp-app:8782",
  middlewareInternal: "http://middleware-integration-api:8095",
  middlewareCommands: "http://middleware-integration-api:8095/platform/v1/commands",
  evolutionInternal: "http://evolution-api:8781"
});

const whatsapp = "/platform/v1/whatsapp";

export const apiPaths = Object.freeze({
  health: "/healthz",
  ready: "/readyz",

  me: whatsapp + "/me",
  dashboard: whatsapp + "/dashboard",

  eligibility: whatsapp + "/contacts/eligibility",
  contacts: whatsapp + "/contacts",
  contact: (contactId) => whatsapp + "/contacts/" + encodeURIComponent(contactId),

  campaignValidation: whatsapp + "/campaigns/validate",
  campaigns: whatsapp + "/campaigns",
  campaign: (campaignId) => whatsapp + "/campaigns/" + encodeURIComponent(campaignId),

  templates: whatsapp + "/templates",
  template: (templateId) => whatsapp + "/templates/" + encodeURIComponent(templateId),

  messages: whatsapp + "/messages",
  operation: (operationId) => whatsapp + "/operations/" + encodeURIComponent(operationId),

  conversations: whatsapp + "/conversations",
  conversation: (conversationId) => whatsapp + "/conversations/" + encodeURIComponent(conversationId),
  timeline: (conversationId) => whatsapp + "/conversations/" + encodeURIComponent(conversationId) + "/timeline",
  claim: (conversationId) => whatsapp + "/conversations/" + encodeURIComponent(conversationId) + "/claim",
  assign: (conversationId) => whatsapp + "/conversations/" + encodeURIComponent(conversationId) + "/assign",
  escalate: (conversationId) => whatsapp + "/conversations/" + encodeURIComponent(conversationId) + "/escalate",
  resolve: (conversationId) => whatsapp + "/conversations/" + encodeURIComponent(conversationId) + "/resolve",
  reopen: (conversationId) => whatsapp + "/conversations/" + encodeURIComponent(conversationId) + "/reopen",
  automation: (conversationId, action) => whatsapp + "/conversations/" + encodeURIComponent(conversationId) + "/automation/" + encodeURIComponent(action),

  aiDrafts: whatsapp + "/ai/drafts",
  aiDraft: (commandId) => whatsapp + "/ai/drafts/" + encodeURIComponent(commandId),
  aiDraftResult: (commandId) => whatsapp + "/ai/drafts/" + encodeURIComponent(commandId) + "/result",

  deadLetters: whatsapp + "/dead-letters",
  replayDeadLetter: (deadLetterId) => whatsapp + "/dead-letters/" + encodeURIComponent(deadLetterId) + "/replay",

  internalMetrics: "/internal/metrics",
  inboundEvents: "/internal/v1/inbound-events",
  inboundEvent: (eventId) => "/internal/v1/inbound-events/" + encodeURIComponent(eventId)
});

export function canonicalApiUrl(path) {
  return productionUrls.api + path;
}

export const publicApiUrls = Object.freeze({
  health: canonicalApiUrl(apiPaths.health),
  ready: canonicalApiUrl(apiPaths.ready),
  me: canonicalApiUrl(apiPaths.me),
  dashboard: canonicalApiUrl(apiPaths.dashboard),
  eligibility: canonicalApiUrl(apiPaths.eligibility),
  contacts: canonicalApiUrl(apiPaths.contacts),
  campaignValidation: canonicalApiUrl(apiPaths.campaignValidation),
  campaigns: canonicalApiUrl(apiPaths.campaigns),
  templates: canonicalApiUrl(apiPaths.templates),
  messages: canonicalApiUrl(apiPaths.messages),
  conversations: canonicalApiUrl(apiPaths.conversations),
  deadLetters: canonicalApiUrl(apiPaths.deadLetters)
});


export const currentBackendApi = Object.freeze([
  { key: "health", method: "GET", path: apiPaths.health, purpose: "Application health" },
  { key: "ready", method: "GET", path: apiPaths.ready, purpose: "Durable application readiness" },
  { key: "eligibility", method: "POST", path: apiPaths.eligibility, purpose: "Recipient eligibility decision" },
  { key: "validateCampaign", method: "POST", path: apiPaths.campaignValidation, purpose: "Campaign validation" },
  { key: "sendMessage", method: "POST", path: apiPaths.messages, purpose: "Submit eligible message effect through Middleware V3" },
  { key: "conversations", method: "GET", path: apiPaths.conversations, purpose: "Conversation inbox" },
  { key: "conversation", method: "GET", path: apiPaths.conversation(":conversationId"), purpose: "Conversation readback" },
  { key: "timeline", method: "GET", path: apiPaths.timeline(":conversationId"), purpose: "Conversation timeline" },
  { key: "claim", method: "POST", path: apiPaths.claim(":conversationId"), purpose: "Claim conversation" },
  { key: "assign", method: "POST", path: apiPaths.assign(":conversationId"), purpose: "Supervisor assignment" },
  { key: "escalate", method: "POST", path: apiPaths.escalate(":conversationId"), purpose: "Escalate conversation" },
  { key: "resolve", method: "POST", path: apiPaths.resolve(":conversationId"), purpose: "Resolve conversation" },
  { key: "reopen", method: "POST", path: apiPaths.reopen(":conversationId"), purpose: "Reopen conversation" },
  { key: "setAutomation", method: "POST", path: apiPaths.automation(":conversationId", ":action"), purpose: "Pause/resume automation" },
  { key: "createAiDraft", method: "POST", path: apiPaths.aiDrafts, purpose: "Create human-review AI reply draft" },
  { key: "aiDraft", method: "GET", path: apiPaths.aiDraft(":commandId"), purpose: "AI draft command readback" },
  { key: "aiDraftResult", method: "GET", path: apiPaths.aiDraftResult(":commandId"), purpose: "AI draft result readback" },
  { key: "deadLetters", method: "GET", path: apiPaths.deadLetters, purpose: "Dead-letter list" },
  { key: "replayDeadLetter", method: "POST", path: apiPaths.replayDeadLetter(":deadLetterId"), purpose: "Dead-letter replay" },
  { key: "operation", method: "GET", path: apiPaths.operation(":operationId"), purpose: "Middleware operation readback" },
  { key: "me", method: "GET", path: apiPaths.me, purpose: "Current operator identity" },
  { key: "dashboard", method: "GET", path: apiPaths.dashboard, purpose: "Agent-console summary" },
  { key: "contacts", method: "GET", path: apiPaths.contacts, purpose: "Contact list" },
  { key: "createContact", method: "POST", path: apiPaths.contacts, purpose: "Create contact" },
  { key: "contact", method: "GET", path: apiPaths.contact(":contactId"), purpose: "Contact readback" },
  { key: "updateContact", method: "PATCH", path: apiPaths.contact(":contactId"), purpose: "Update contact" },
  { key: "templates", method: "GET", path: apiPaths.templates, purpose: "Template list" },
  { key: "createTemplate", method: "POST", path: apiPaths.templates, purpose: "Create template" },
  { key: "template", method: "GET", path: apiPaths.template(":templateId"), purpose: "Template readback" },
  { key: "updateTemplate", method: "PATCH", path: apiPaths.template(":templateId"), purpose: "Update template" },
  { key: "campaigns", method: "GET", path: apiPaths.campaigns, purpose: "Campaign list" },
  { key: "createCampaign", method: "POST", path: apiPaths.campaigns, purpose: "Create campaign" },
  { key: "campaign", method: "GET", path: apiPaths.campaign(":campaignId"), purpose: "Campaign readback" },
  { key: "updateCampaign", method: "PATCH", path: apiPaths.campaign(":campaignId"), purpose: "Update campaign" }
]);

export const internalBackendApi = Object.freeze([
  { key: "internalMetrics", method: "GET", path: apiPaths.internalMetrics, purpose: "Prometheus metrics; service-only" },
  { key: "inboundEvents", method: "POST", path: apiPaths.inboundEvents, purpose: "Durable normalized inbound ingress; service-only" },
  { key: "inboundEvent", method: "GET", path: apiPaths.inboundEvent(":eventId"), purpose: "Inbound event readback; service-only" }
]);
