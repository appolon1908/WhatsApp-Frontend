# Codestra WhatsApp — Staging Operations Dashboard

Codestra WhatsApp is a standalone web frontend backed by the Codestra WhatsApp business-policy API and a private Evolution / Meta provider adapter. The deployed interface is a **safe-mode staging workspace, not yet a live customer inbox**.

**Live deployment:** `https://whatsapp.codestra.co/` for authorized private-network users. Public access is blocked at Caddy with HTTP 403 until proper per-agent identity is integrated. Server 3 hosts the frontend and two Node backends in isolated Docker networks; the Middleware server remains separate.

## Implemented and verified

| Workspace section | Implemented functionality |
| --- | --- |
| Overview | Actual API and adapter health, fail-closed send state, Middleware registration status, live in-session samples |
| Inbox | Honest "not connected" screen; no fabricated customer data |
| Contacts | Live backend strict opt-in eligibility checker, without saving recipients |
| Campaigns | Live backend campaign draft validator; bulk approval is required when the audience has more than one recipient |
| Templates | Displays unconnected protected registry state; no browser-side shadow templates |
| Automations | Displays disabled state; no external workflows can be initiated |
| Channels | Adapter's actual Evolution and Meta readiness, no credentials |
| Activity | In-memory dashboard and validation events for this browser session only |
| Diagnostics | Sanitized live health/readiness JSON, health evidence snapshot export |
| Settings | Read-only service safety, access and identity gates |

The dashboard **never proxies messaging commands, provider operations, webhooks, or internal admin APIs**. Nginx exposes four safe GET health/readiness routes and two rate-limited, deterministic POST validation endpoints. Only in-session health and event data are retained. No credentials, contact identities, conversation logs, or bulk sends are persisted by the frontend.

## Local verification

Node.js 22 or newer:

```bash
node --check app.js
node --test test/frontend.test.mjs
docker build -t codestra-whatsapp-frontend-ci .
```

The Nginx config requires Docker networking with `whatsapp-api` and `evolution-adapter` DNS aliases for `nginx -t`; `.github/workflows/dashboard-ci.yml` provisions mock aliases. A live browser acceptance suite additionally requires Playwright 1.56.1:

```bash
npm install --no-save playwright@1.56.1
DASHBOARD_URL=http://10.0.0.218:3082 node test/browser.e2e.mjs
```

The browser suite checks UI pages, real positive/negative policy decisions, channel truth, local activity, mobile navigation, no JS exceptions, and zero attempted message sends.

## Architecture and release boundary

```text
Private browser → Caddy verified HTTPS + private IP allowlist
 → Nginx frontend :3082
 → WhatsApp business-policy API :8782 (private Docker only)
 → Evolution / Meta adapter :8781 (private Docker only)
 → Middleware V3 command authority (NOT YET CERTIFIED / REGISTERED)
```

Frontend project owns no Middleware ledger, provider retries, idempotency, reconciliation, or authoritative consent database. Full inbox, template registry, Keycloak role-based access, campaign persistence, automated delivery, provider session setup and historical reporting are **not implemented**. Do not count them as completed.

Production sends must remain disabled (`WHATSAPP_PRODUCTION_SEND=false`, `WHATSAPP_BULK_SEND=false`, `WHATSAPP_EXTERNAL_RECIPIENTS=false`, `WHATSAPP_AI_AUTOREPLY=false`, `EXTERNAL_SEND_ENABLED=false`, `FORWARD_EVENTS_ENABLED=false`). Promotion requires an independently reviewed Middleware WhatsApp command registration, tenant-specific Keycloak SSO, consent/readback authority, authenticated provider integration, tests, backups and explicit GO approval.

See [deployment and rollback](deploy/DEPLOYMENT.md). Development proceeds through protected PR review; no direct commits to `main`.
