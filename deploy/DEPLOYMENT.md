# Codestra WhatsApp — certified safe-staging layout (2026-10-08)

This implementation is a **read-only operations console**, not a real agent inbox. Customer messaging, provider effects, AI autoreplies and event forwarding stay disabled. The WhatsApp application requires a reviewed Middleware V3 WhatsApp command registration, identity, audited consent authority and service credentials before any production activation.

## Deploy

On Server 3 (CRM, `10.0.0.218`) provision sibling checkouts `whatsapp-app` (appolon1908/WhatsApp), `evolution-adapter` (appolon1908/Evolution-API) and `frontend` (appolon1908/WhatsApp-Frontend). Use code-review-approved branch SHAs; never mount dirty or divergent checkouts. The standalone Node CLI start-up fixes must be included.

From the checkout parent run `sudo STAGING_BIND_IP=10.0.0.218 docker compose -f frontend/deploy/compose.staging.yml config --quiet`, then `sudo STAGING_BIND_IP=10.0.0.218 docker compose -f frontend/deploy/compose.staging.yml up -d --build`. The default bind is loopback unless the private LAN IP is supplied explicitly.

Docker intentionally publishes **only the frontend**; both Node APIs remain on an isolated private network. Nginx exposes only read-only health and readiness endpoints. To verify, fetch `/`, `/api/healthz`, `/api/readyz`, `/adapter/healthz`; all should return 200. Requests to message commands through the frontend must return 404. The app's direct send must return 423 in safe mode, the adapter's unauthenticated direct command must return 503. All three services have resource limits and drop Linux capabilities.

## Domain and private access

GoDaddy DNS record: `whatsapp.codestra.co CNAME codestra.agency.`, TTL 600. Current verified public edge: Caddy on `s1-middleware` (`10.0.0.73`). Caddy forwards to `10.0.0.218:3082` **only when the remote source is on LAN 10.0.0.0/24 or Tailscale 100.64.0.0/10**; other requests receive HTTP 403. Public Let's Encrypt TLS was obtained and verified. The WAN address behind codestra.agency is dynamic; retain DNS synchronization and router forwarding, and do not assume a static public address.

Verified Caddy policy fragment:

```caddyfile
whatsapp.codestra.co {
    @trusted remote_ip 10.0.0.0/24 100.64.0.0/10
    handle @trusted {
        reverse_proxy 10.0.0.218:3082
    }
    handle {
        respond "Forbidden" 403
    }
}
```

The Ubuntu desktop receives a local `/etc/hosts` override mapping `whatsapp.codestra.co` to `10.0.0.73`, enabling private verified HTTPS; a Chrome desktop launcher and login autostart are installed. If the Middleware edge's DHCP address changes, update the private mapping. Do not make the staging console public before identity and access policy are implemented.

## Checks and promotion

- WhatsApp app tests: 4/4 PASS (Node 22)
- Evolution adapter tests: 5/5 PASS (Node 22)
- Frontend tests: 3/3 PASS and Docker build PASS
- Browser-rendered console shows two Online services, Sends Disabled and Middleware Command Not Registered.
- Middleware `/healthz` and `/readyz` are reachable (HTTP 200), but `/platform/v1/commands` is unavailable through the current Kong edge (HTTP 404).
- Production readiness: **NO**. Retain separate development → testing → staging → production controls, protected PR reviews, registry certification, Keycloak access and actual provider credentials before any live effects.

If necessary, `sudo docker compose -f frontend/deploy/compose.staging.yml down` stops only this staging project. It does not alter Odoo, Codestra, or Middleware deployments. Restore the previous Caddyfile from `/etc/caddy/Caddyfile.backup-whatsapp-20261008` only if the hostname route needs rollback; preserve all other virtual hosts.
