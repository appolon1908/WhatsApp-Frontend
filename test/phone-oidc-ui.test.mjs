import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("Keycloak login uses authorization code plus S256 PKCE with a bounded redirect state",()=>{
 const js=read("phone-auth.js");
 assert.match(js,/response_type:"code"/);
 assert.match(js,/code_challenge_method:"S256"/);
 assert.match(js,/grant_type:"authorization_code"/);
 assert.match(js,/transaction.state!==state/);
 assert.match(js,/Date.now\(\)-transaction.issued>300000/);
 assert.match(js,/history.replaceState/);
});
test("access tokens stay only in page memory and never enter local storage",()=>{
 const js=read("phone-auth.js");
 assert.match(js,/let token=null,expiresAt=0/);
 assert.match(js,/function accessToken\(\)/);
 assert.doesNotMatch(js,/localStorage|document\.cookie|indexedDB|eval\(/);
 assert.match(js,/sessionStorage.removeItem\(transactionKey\)/);
 // PKCE verifier/state transaction may be stored only temporarily; never the access token.
 assert.doesNotMatch(js,/sessionStorage.setItem\([^\n]*access_token/);
 const manager=read("phone-accounts.js");
 assert.match(manager,/CodestraPhoneOIDC/);
 assert.match(manager,/authorization:"Bearer "/);
});
test("OIDC UI is optional in staging and phone routes remain individually protected",()=>{
 const html=read("index.html");
 const nginx=read("nginx.conf");
 assert.match(html,/id="phone-oidc-login"/);
 assert.match(html,/id="phone-oidc-access-form"/);
 assert.match(nginx,/location = \/api\/phone-auth-config/);
 assert.match(nginx,/location = \/api\/phone-readiness/);
 assert.match(nginx,/location \^~ \/adapter\/ \{ return 404;/);
 assert.doesNotMatch(nginx,/proxy_pass[^\n]*\/enrollment\/execute/);
});
