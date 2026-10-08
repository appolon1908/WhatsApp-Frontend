# Codestra Phone Accounts Dashboard — staging

The **Phone accounts** section is available under Management in the Codestra WhatsApp workspace. It implements:

1. Tenant-scoped phone-account draft listing, creation, selection and local disable through the authenticated Codestra business API.
2. Official Meta registration preparation: number, WABA ID, Meta phone-number ID; user-directed WhatsApp Manager / Embedded Signup; request SMS or voice code, verify ownership, and register with a six-digit PIN after separate enrollment activation.
3. Existing WhatsApp linking preparation: Evolution instance name, create instance, temporary QR pairing display, status refresh.
4. Masked numbers, campaign mapping, duplicate prevention, optimistic version checking and server-side bounded audit.
5. Provider-effects-off diagnostics and clear per-operation error messages.

The browser never stores the administrator key, verification codes, PINs, QR images, contact records, or credentials in localStorage or cookies. The administrator key is entered in a password field and retained only in JavaScript process memory while the tab is open; it is cleared from the field after a successful or rejected login. The frontend never calls Graph/Evolution directly.

**Access:** Caddy HTTPS Basic Auth protects the public staging hostname. Phone-account management requires a **separate** protected administrator key found at `/opt/codestra-whatsapp-phone-preview/private/phone-admin-token` on Server 3 (read it with sudo on that server); browser users also supply their tenant business code. Do not paste the key into this chat, source code or screenshots. The frontend proxies only allowed methods through Nginx and validates the key again in the backend.

**Operational state:** You can manage durable staging drafts. All external provider enrollment, Meta SMS/voice verification, actual number registration and Evolution QR generation remain disabled by default (HTTP 423). Customer message sending remains disabled. No real phone number has been registered or linked by the staging implementation.

**Certification:** `node --test` validates source, gateway, and locked configurations; `DASHBOARD_URL=http://10.0.0.218:3093 node test/phone-accounts.browser.mjs` validates both wizard views and rejection of incorrect tokens. Backend tests verify state transitions with stubbed provider responses, persistence, duplicates, tenant isolation, versions, and effect-gate denial.
