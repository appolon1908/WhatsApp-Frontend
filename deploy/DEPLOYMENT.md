# Codestra WhatsApp — Staging deployment and verification
**Last verified:** 2026-10-08, Santo Domingo timezone. **Promotion:** production GO = NO.

This is a 10-section operations dashboard with backend-driven health, consent eligibility and campaign policy validation. It is **not** a live message inbox. External effects, AI replies, bulk sends, forwarding and customer delivery remain disabled.

## Source of truth and release refs

On CRM Server 3 (`10.0.0.218`) the following sibling checkouts are in `/opt/codestra-whatsapp-staging`:

- `whatsapp-app`: `appolon1908/WhatsApp`, reviewed CLI-fix candidate branch
- `evolution-adapter`: `appolon1908/Evolution-API`, reviewed CLI-fix candidate branch
- `frontend`: `appolon1908/WhatsApp-Frontend`, `feat/safe-staging-console-20261008`

Use exact reviewed commit SHAs. Never overwrite dirty or divergent branches, alter the real Odoo database, or bypass protected reviews. The runtime currently also has a `/opt/codestra-whatsapp-staging/docker-compose.yml` configuration identical to the source-controlled `frontend/deploy/compose.staging.yml` (resolved with `STAGING_BIND_IP=10.0.0.218`); keep them synchronized on further upgrades.

```bash
cd /opt/codestra-whatsapp-staging
sudo STAGING_BIND_IP=10.0.0.218 docker compose -f frontend/deploy/compose.staging.yml config --quiet
sudo STAGING_BIND_IP=10.0.0.218 docker compose -f frontend/deploy/compose.staging.yml up -d --build
```

Docker publishes **only frontend port 3082**, bound to LAN IP `10.0.0.218`. The Node APIs are isolated inside the private Docker network. Resource limits, read-only filesystems, dropped capabilities, no-new-privileges and restart policies are configured on every service. Do not expose internal Node APIs or provider credentials directly.

## Live endpoints and expected smoke checks

- GET `/`, `/app.js`, `/styles.css`: HTTP 200
- GET `/api/healthz`, `/api/readyz`: HTTP 200, API configured in safe mode
- GET `/adapter/healthz`, `/adapter/readyz`: HTTP 200, provider adapter in safe mode
- POST `/api/contacts/eligibility`: deterministic, non-persistent opt-in eligibility decision (200)
- POST `/api/campaigns/validate`: deterministic non-persistent campaign validation (200 or 422)
- POST `/api/platform/v1/whatsapp/messages`: HTTP 404 at frontend ingress (deny)
- Direct POST to business API send route inside isolated network: HTTP 423 while sending disabled
- Unauthenticated direct POST to provider transport: HTTP 503 while service auth unconfigured (not publicly accessible)

Requests to other `/api/*` and `/adapter/*` routes fail closed. Policy check endpoints use request limits, no forwarded Authorization or Cookie, and a maximum request body of 8 KiB. Form values are never persisted or included in health exports.

## Browser, source and integration tests

```bash
node --check frontend/app.js
node --test frontend/test/frontend.test.mjs
docker compose build frontend
docker compose run --rm --no-deps --entrypoint nginx frontend -t
```

Run the browser acceptance suite in a Playwright 1.56.1 container (or install its npm package and matching Chromium). Use `DASHBOARD_URL=http://10.0.0.218:3082` to verify policy form actions against running backend; the suite explicitly asserts zero attempts to send messages, no browser JavaScript errors and correct responsive mobile navigation. The GitHub workflow `dashboard-ci.yml` validates source and container configuration on pull requests.

2026-10-08 local evidence: WhatsApp backend unit tests **4/4**, Evolution backend **5/5**, dashboard tests **5/5**, Nginx parser valid; live browser acceptance checks passed, including positive and negative consent/campaign tests. No production provider testing was performed.

## GoDaddy, HTTPS, public authentication and private desktop access

GoDaddy DNS points `whatsapp.codestra.co CNAME codestra.agency.`, TTL 600, to the existing verified Caddy ingress on `s1-middleware` (`10.0.0.73` private IP). The public certificate is valid. The upstream private frontend remains `10.0.0.218:3082`.

**External visitors:** HTTP 401 with the browser's standard HTTPS Basic Authentication prompt. A strong randomly generated password is stored only on the Middleware server at `/etc/codestra/secrets/whatsapp-dashboard-access` with mode 0600. The login name is `codestra-admin`. To access it securely, open a console/SSH session **on s1-middleware** and run `sudo cat /etc/codestra/secrets/whatsapp-dashboard-access`. Do not paste credentials into PRs, screenshots, this chat, source code, or logs. Rotate/remove this temporary access method when approved Keycloak SSO is available. Caddy strips `Authorization` before forwarding either frontend or Middleware requests. Unauthenticated external requests must receive HTTP 401; authenticated requests return HTTP 200.

**Internal users:** trusted LAN `10.0.0.0/24` and Tailscale `100.64.0.0/10` continue to use the private no-password route. No external recipient sends or provider effects can be initiated from the frontend.

Caddy has two distinct upstreams for this hostname:

- Normal site and the only approved policy validation routes: `10.0.0.218:3082` (frontend Nginx; both backends are private Docker services).
- `GET /api/integrations/middleware`: Caddy rewrites to `/readyz` and reverse-proxies directly to `127.0.0.1:8000` on the **Middleware server**, giving live read-only Middleware V3 readiness. POST to this path is not an allowed integration operation.

The frontend uses `fetch(..., credentials:"same-origin")` so cached HTTPS Basic credentials accompany its same-origin API requests. This does **not** send the password to upstream Node or Middleware services because Caddy removes the authentication header.

The `dev-desktop` account `codestra` has a Chrome app launcher, applications-menu entry, and graphical-login autostart. Desktop DNS maps `whatsapp.codestra.co` to private Caddy edge `10.0.0.73`; Chrome and TLS verified HTTP 200, with Middleware V3 connection shown as Online. **A graphical login is required for the application window to appear on the desktop**. Do not sign into the login greeter as a service account or bypass workstation login.

## Authentication and security acceptance criteria

- Public unauthenticated GET `/` and `/api/integrations/middleware`: HTTP 401
- Public authenticated GET `/` and `/api/integrations/middleware`: HTTP 200
- Private authorized browser: application API Online, adapter Online, Middleware Online, message delivery Locked
- `POST /api/platform/v1/whatsapp/messages` remains HTTP 404 even after access login
- Caddy `Authorization` request header must be removed at both upstream boundaries
- `codestra.agency` remains HTTP 200

These checks certify accessible **safe-mode staging**, not authenticated per-agent identity, customer data security or production WhatsApp operations.

## Unfinished production gates

1. Approved Keycloak OIDC login, session handling and tenant/campaign role checks.
2. Real durable conversation store and inbox APIs; secure contact/lead synchronization and consent evidence.
3. Signed provider webhooks, readback, reconciliation, webhook audit, confirmed provider credentials.
4. Approved Middleware V3 WhatsApp command registration; the currently observed Caddy/Kong `/platform/v1/commands` returns 404 from Server 3 although `/healthz` and `/readyz` return 200.
5. Real template approvals, campaign persistence, automation audit and historical reporting.
6. Mandatory CI and independent code reviews for all PRs; promotion and explicit release authorization.

Do not advertise full production certification while these remain incomplete.

## Rollback

`sudo docker compose -f frontend/deploy/compose.staging.yml down` stops only this staging project. Do not prune shared Docker resources or named volumes. Restore the Caddyfile backup `/etc/caddy/Caddyfile.backup-whatsapp-20261008` only after comparing it against current unrelated Caddy changes. Preserve existing GoDaddy records unrelated to the WhatsApp hostname.
