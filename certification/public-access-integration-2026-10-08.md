# Codestra WhatsApp — Public Access and Middleware Integration Recheck

**Date:** 2026-10-08  
**Scope:** secure public staging access and read-only frontend/backend connectivity  
**Verdict:** **PASS** for accessible authenticated staging and verified backend readiness; **PRODUCTION GO = NO**.

## Cause and remedy

The public hostname `https://whatsapp.codestra.co` was deliberately returning **HTTP 403** to non-LAN/non-Tailscale clients. The Caddy rule has been updated to require encrypted **Basic Authentication** for external visitors, while preserving LAN/Tailscale access.

The existing frontend also used `fetch(..., credentials:"omit")`, which would strip HTTP Basic credentials from same-origin API requests after sign-in. Frontend PR #8 now uses `credentials:"same-origin"` for its GET health checks and non-persistent POST policy validators. Caddy removes the `Authorization` header before forwarding to either Node/Nginx or Middleware.

A dedicated **GET-only** gateway endpoint `/api/integrations/middleware` rewrites to the live Middleware `/readyz` on the same edge host and provides live read-only status to the dashboard. It does not expose command execution or provider effects.

## Verified tests

| Verification | Result |
| --- | --- |
| GoDaddy `whatsapp.codestra.co` resolves through `codestra.agency` to the Caddy edge | PASS |
| TLS certificate verification, private desktop | PASS |
| External visitor without credentials, `/` | 401 (expected) |
| External visitor without credentials, `/api/integrations/middleware` | 401 (expected) |
| External visitor with credentials, `/` | 200 |
| External visitor with credentials, `/api/healthz` | 200 |
| External visitor with credentials, `/adapter/healthz` | 200 |
| External visitor with credentials, `/api/integrations/middleware` | 200 |
| Authenticated policy validation, strict opt-in | 200; `eligible=false` for unknown consent |
| Authenticated request to message effects via frontend | 404 (expected block) |
| Authenticated request to provider internal transport via frontend | 404 (expected block) |
| Actual Middleware readiness | `status=ready`, `service=middleware-integration-api`, `delivery=disabled` |
| Chromium on dev-desktop, private HTTPS route | Business API Online, adapter Online, Middleware V3 Online, delivery Locked |
| Node frontend tests after update | 6/6 passed |
| Nginx configuration validation | PASS |
| Staging front container redeploy | PASS |
| Existing `codestra.agency` website | HTTP 200, unaffected |

The external-access credential is stored only at `/etc/codestra/secrets/whatsapp-dashboard-access` on `s1-middleware` with mode 0600; its value is not recorded in GitHub. The temporary transfer copy was removed.

## Source and deployment

- `appolon1908/WhatsApp-Frontend` staging implementation: [PR #8](https://github.com/appolon1908/WhatsApp-Frontend/pull/8)
- Browser frontend and Nginx on CRM Server 3: `10.0.0.218:3082`
- Business API and Evolution adapter run internally in Docker and remain healthy.
- Middleware V3 endpoint: the verified Caddy edge on `10.0.0.73`, using a read-only gateway probe.

## Production gaps (not certified)

- Per-agent Keycloak/OIDC authentication, campaign/tenant authorization and RBAC
- An authenticated and persisted customer conversation inbox with proper historical data
- Meta/Evolution provider sessions, webhook verification, durable readback and delivery reconciliation
- Reviewed Middleware V3 WhatsApp send command registration and exact permissions
- Authorized live customer messages, templates, and automations
- Protected GitHub PR approval/merge and production promotion gates

**No production message sending was enabled.** This is a *staging integration certificate*, not full WhatsApp product certification.
