# Codestra WhatsApp Multi-Number Enrollment — Staging Certification
**Date:** 2026-10-08  
**Scope:** Protected Meta/Evolution number enrollment implementation with live messaging and enrollment effects disabled.  
**Verdict:** **STAGING PASS, PRODUCTION GO = NO**.

## Source and implementation

Three independent implementation branches named `feat/phone-enrollment-staging-20261008` were created in:
- [WhatsApp — PR #20](https://github.com/appolon1908/WhatsApp/pull/20): durable tenant-scoped phone accounts, masked numbers, draft create, update, duplicate rejection, version checks, persistent bounded audit, idempotent action gate and effectful provider calls behind an independent server-side admin key.
- [Evolution-API — PR #16](https://github.com/appolon1908/Evolution-API/pull/16): private authenticated Meta Cloud API phone-number discovery, SMS/voice request_code, verify_code, register with PIN; Evolution instance creation, temporary PNG QR retrieval and connection-state readback; sanitized provider errors, strict URL/ID and response validation.
- [WhatsApp-Frontend — PR #9](https://github.com/appolon1908/WhatsApp-Frontend/pull/9): Phone Accounts workspace with Meta and Evolution wizards, admin-key form, tenant account list, masked numbers, action controls, temporary QR image, no browser persistence of secrets and restricted Nginx proxy.

## Isolated staging topology

- Previous WhatsApp staging stack remains running, bound to `10.0.0.218:3082`, as rollback fallback.
- New `codestra-whatsapp-phone-preview` Compose project runs on Server 3, bind `10.0.0.218:3093`.
- The domain `https://whatsapp.codestra.co/` was switched only within the existing Caddy WhatsApp virtual host from port 3082 to port 3093. All unrelated Caddy entries are preserved. A pre-cutover backup is at `/etc/caddy/Caddyfile.backup-whatsapp-phone-preview-20261008`.
- HTTPS certificate and public Caddy Basic Auth remain operational; unauthenticated public HTTP 401, credentialed public dashboard HTTP 200. A separate, manually entered phone-admin key gates registry operations, including private LAN access.
- Secrets are generated on Server 3 under `/opt/codestra-whatsapp-phone-preview/private`, not in GitHub or this certificate. Secret mounts are read-only. The enrollment registry uses a separate persistent data directory.
- Caddy still proxies `GET /api/integrations/middleware` to the real, read-only Middleware `/readyz` endpoint.
- `codestra.agency` remains HTTP 200.

## Verified results

| Check | Result |
| --- | --- |
| WhatsApp business backend Node tests | **9/9 PASS** |
| Evolution provider adapter Node tests | **10/10 PASS** |
| Frontend Node tests (including old staging contract) | **12/12 PASS** |
| Frontend Meta/Evolution wizard browser checks | **PASS** |
| Live preview GET `/`, `/phone-accounts.js`, API and adapter health | **200** |
| Public HTTPS login required, unauthenticated | **401** |
| Public authenticated dashboard, JS, app, adapter and Middleware health | **200** |
| Public authenticated account registry without separate admin key | **401** |
| Valid admin key, tenant list initially empty | **200 / 0 accounts** |
| Create a Meta-number staging draft | **201** |
| Create an Evolution-instance staging draft | **201** |
| Duplicate phone-number draft | **409** |
| Cross-tenant list access | **200 / 0 other-tenant accounts** |
| Stale version edit | **409** |
| Valid version update | **200; version incremented** |
| Meta request-code while provider effects disabled | **423** |
| Evolution QR while provider effects disabled | **423** |
| Persistence after backend restart | **2 isolated STAGING_QA records retained** |
| Frontend message-delivery route | **404** |
| Frontend internal adapter path | **404** |
| Existing website `https://codestra.agency/` | **200** |
| WhatsApp API and adapter containers | **Healthy** |
| GitHub Node20/22 enrollment CI — business API | **Success** |
| GitHub Node20/22 enrollment CI — provider adapter | **Success** |
| GitHub frontend feature push CI | **Success** |

**Staging test data:** Two synthetic `STAGING_QA` phone-account drafts (Meta and Evolution) were deliberately retained in the isolated preview registry to verify server-side persistence. They are not linked real accounts, are tenant-isolated from `CODESTRA`, and have never generated SMS, QR, or WhatsApp messages.

## Limits / not certified

- No real WhatsApp phone was registered, verified, linked, or used to send a message.
- Real Meta Embedded Signup requires an approved Meta Business app, linked WABA, verified number, valid system-user token, verification code and registration PIN; this user's actual Meta credentials and phone information were not provided. The frontend provides a WhatsApp Manager handoff, not a full Meta SDK OAuth Embedded Signup implementation.
- Evolution QR pairing requires a configured trusted Evolution API instance and a user's phone scanning the temporary QR. Provider environment variables are not configured.
- Both independent enrollment activation flags remain **false**: `PHONE_ENROLLMENT_EFFECTS_ENABLED=false` and `PROVIDER_ENROLLMENT_ENABLED=false`.
- `WHATSAPP_PRODUCTION_SEND=false`, `WHATSAPP_BULK_SEND=false`, `WHATSAPP_AI_AUTOREPLY=false`, `WHATSAPP_EXTERNAL_RECIPIENTS=false`, `EXTERNAL_SEND_ENABLED=false`, `FORWARD_EVENTS_ENABLED=false`.
- Public Basic Auth plus separate staging administrator key is temporary, not certified per-agent Keycloak RBAC. Do not enable provider enrollment or customer messages until authenticated tenant roles, Middleware send command registration, webhook audit and release gates are approved.
- Protected pull request reviews, parent-branch merges and exact production release approvals remain separate GitHub governance requirements; no protected branches were bypassed.

## Recovery

Roll back only the WhatsApp Caddy upstream target from `10.0.0.218:3093` to `10.0.0.218:3082`, preserving the current public Basic Auth and other virtual hosts. Do not remove existing GoDaddy DNS or unrelated Docker resources. Do not delete the new phone registry data without a reviewed backup.

**Certification scope is staging implementation and safe-mode integration, not provider activation or production messaging.**
