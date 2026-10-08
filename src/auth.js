const keycloakUrl = String(import.meta.env.VITE_KEYCLOAK_URL || "").replace(/\/+$/, "");
const realm = String(import.meta.env.VITE_KEYCLOAK_REALM || "codestra");
const clientId = String(import.meta.env.VITE_KEYCLOAK_CLIENT_ID || "codestra-whatsapp-frontend");
const redirectUri = String(import.meta.env.VITE_AUTH_REDIRECT_URI || window.location.origin + "/");
const devBypass = String(import.meta.env.VITE_DEV_BYPASS_AUTH || "false").toLowerCase() === "true";

const TOKEN_KEY = "codestra.whatsapp.auth";
const VERIFIER_KEY = "codestra.whatsapp.pkce.verifier";
const STATE_KEY = "codestra.whatsapp.pkce.state";

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(size = 48) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export function authConfigured() {
  return devBypass || Boolean(keycloakUrl && realm && clientId);
}

export function isDevBypass() {
  return devBypass;
}

export function getStoredAuth() {
  try {
    const value = sessionStorage.getItem(TOKEN_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value);
    if (!parsed.access_token) return null;
    if (parsed.expires_at && Date.now() >= parsed.expires_at) {
      sessionStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getAccessToken() {
  return getStoredAuth()?.access_token || "";
}

export function decodeClaims(token = getAccessToken()) {
  if (!token) return {};
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(decodeURIComponent(Array.from(atob(padded), (c) => {
      return "%" + c.charCodeAt(0).toString(16).padStart(2, "0");
    }).join("")));
  } catch {
    return {};
  }
}

export function sessionIdentity() {
  if (devBypass) {
    return {
      subject: String(import.meta.env.VITE_DEV_ACTOR_ID || "frontend-dev"),
      tenantId: String(import.meta.env.VITE_DEV_TENANT_ID || "TEST_SYN"),
      roles: ["whatsapp_admin"],
      authenticated: true,
      development: true
    };
  }
  const claims = decodeClaims();
  const realmRoles = claims.realm_access?.roles || [];
  const resourceRoles = Object.values(claims.resource_access || {}).flatMap((entry) => entry?.roles || []);
  return {
    subject: claims.sub || null,
    tenantId: claims.tenant_id || claims.tenant || claims.organization_id || claims.tenant_ids?.[0] || null,
    roles: [...new Set([...realmRoles, ...resourceRoles])],
    authenticated: Boolean(claims.sub && getAccessToken()),
    development: false
  };
}

export async function startLogin() {
  if (devBypass) return;
  if (!authConfigured()) throw new Error("Keycloak frontend authentication is not configured");
  const verifier = randomString(64);
  const state = randomString(24);
  const challenge = await challengeFor(verifier);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const url = new URL(keycloakUrl + "/realms/" + encodeURIComponent(realm) + "/protocol/openid-connect/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  window.location.assign(url.toString());
}

export async function completeLoginFromRedirect() {
  if (devBypass) return false;
  const current = new URL(window.location.href);
  const code = current.searchParams.get("code");
  const state = current.searchParams.get("state");
  if (!code) return false;

  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  if (!state || !expectedState || state !== expectedState || !verifier) {
    throw new Error("Authentication callback state is invalid");
  }

  const tokenUrl = keycloakUrl + "/realms/" + encodeURIComponent(realm) + "/protocol/openid-connect/token";
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier
  });
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) throw new Error("Keycloak token exchange failed");
  const token = await response.json();
  token.expires_at = Date.now() + Math.max(0, Number(token.expires_in || 0) - 30) * 1000;
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);

  current.searchParams.delete("code");
  current.searchParams.delete("state");
  current.searchParams.delete("session_state");
  window.history.replaceState({}, "", current.pathname + (current.search ? current.search : ""));
  return true;
}

export function logout() {
  const idToken = getStoredAuth()?.id_token || "";
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  if (devBypass || !keycloakUrl) {
    window.location.reload();
    return;
  }
  const url = new URL(keycloakUrl + "/realms/" + encodeURIComponent(realm) + "/protocol/openid-connect/logout");
  url.searchParams.set("post_logout_redirect_uri", redirectUri);
  url.searchParams.set("client_id", clientId);
  if (idToken) url.searchParams.set("id_token_hint", idToken);
  window.location.assign(url.toString());
}
