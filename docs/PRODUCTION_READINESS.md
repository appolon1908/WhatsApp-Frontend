# Codestra WhatsApp — Production Release Gates (2026-10-08)

State: PREPRODUCTION VALIDATED. PRODUCTION GO = NO.

## Completed implementation
- Keycloak RS256 JWKS, issuer/audience/azp validation, signed tenant and administrator role checks. Browser OAuth authorization code + PKCE S256 foundation. Tokens kept in memory.
- Production startup blocks staging-only admin passwords, memory-only data, missing OIDC issuer/client, and unapproved production effects.
- Outbound Middleware message commands require verified operator identity; caller-provided tenant and actor cannot override it.
- Durable single-node phone registry with tenant isolation, duplicate checks, masked API responses, optimistic revisions, bounded audits and write-ahead uncertain-provider-effect markers.
- Meta registration pre-checks approved WABA ownership and phone-number membership; request_code now uses the documented locale field.
- Evolution QR adapter restricts instances to configured prefixes.
- Node services run non-root; Nginx dynamically resolves Docker service IPs and rejects public Basic Auth credentials while allowing role-checked Bearer phone routes.
- Checksum-verifiable, permission-restricted registry snapshots and authenticated release-readiness API.
- Separate preproduction at 10.0.0.218:3103. Existing public staging at https://whatsapp.codestra.co still uses 10.0.0.218:3093, with prior fallback at 10.0.0.218:3082.

## Outstanding hard release gates — every item must pass

1. KEYCLOAK: Create a real public Codestra WhatsApp client in the codestra realm, use exact https://whatsapp.codestra.co/ redirect, S256 PKCE, correct audience, authorized party, trusted tenant_id claim, whatsapp_admin / codestra_super_admin roles. The unauthenticated safe client-auth probe returned 400 invalid client; do not claim successful SSO until a real login passes.
2. GATEWAY: Replace temporary public Caddy Basic Auth with an approved OIDC session/access policy that can carry validated Bearer tokens. Current public Caddy strips Authorization and cannot support production Bearer login. Preserve TLS, access restriction, rate limits, secure cookies and CSRF safeguards.
3. IDENTITY NETWORK: Allowlist an outbound path from the isolated backend to trusted Keycloak JWKS; do not grant general Internet access to sensitive API containers.
4. META: Complete business verification, Meta app / WABA onboarding, number ownership verification, approved credentials in a secrets manager, WABA allowlist, registered phone IDs, and signed webhook callback certification.
5. EVOLUTION: Deploy a pinned trusted upstream version, scoped key, private session store, instance prefix, actual QR and pairing verification, signed webhooks. Unofficial QR/Baileys has different compliance/operational risks than official Meta Cloud API.
6. MIDDLEWARE: Register and test the approved WhatsApp V3 command in Kong/Middleware with tenant JWT, replay, idempotency, ledger/outbox, readback, DLQ and reconciliation. Middleware readiness is healthy with delivery disabled; public command route previously returned 404.
7. RESILIENCE AND DATA: Test an off-host/offline encrypted backup and full restore, set RPO/RTO and retention rules. A local SHA256 backup was verified, but this is not an offsite DR certificate. Single-node file storage must not be treated as HA; introduce PostgreSQL transactional persistence and multi-replica serialization before horizontal scaling.
8. RELEASE: CI PASS on exact SHA, independent code review / CODEOWNERS, merge via protected branches, signed deployment evidence, application smoke, user acceptance, explicit production GO and rollback plan.

## Safe environment settings
NODE_ENV=production
PHONE_AUTH_MODE=oidc
PHONE_OIDC_ISSUER=https://auth.codestra.co/realms/codestra
PHONE_OIDC_AUDIENCE=codestra-whatsapp
PHONE_OIDC_CLIENT_ID=codestra-whatsapp-frontend
PHONE_ACCOUNTS_FILE=/data/accounts.json
PHONE_ENROLLMENT_EFFECTS_ENABLED=false
WHATSAPP_PRODUCTION_SEND=false
WHATSAPP_BULK_SEND=false
WHATSAPP_EXTERNAL_RECIPIENTS=false
WHATSAPP_AI_AUTOREPLY=false
PRODUCTION_GO=NO
PHONE_BACKUP_VERIFIED=false

In the provider adapter keep PROVIDER_ENROLLMENT_ENABLED=false, EXTERNAL_SEND_ENABLED=false, FORWARD_EVENTS_ENABLED=false until separate authorization. Do not put real secrets, verification codes, PINs or private keys into GitHub.

## Final certification scope
Passing preproduction health checks, unit tests, browser tests, and local backup verification does not constitute Meta activation, successful real QR pairing, working Keycloak browser login, successful Middleware effects, or an authorized production rollout. Live customer messaging is OFF.

## Rollback
Preserve the staging public Caddy configuration and production DNS. Only replace the WhatsApp upstream after review; revert it to 10.0.0.218:3093 if a future production promotion fails. Leave other Codestra/Odoo vhosts untouched.

References:
- Meta Cloud API: https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api
- Evolution QR: https://docs.evoapicloud.com/api-reference/instance-controller/instance-connect
