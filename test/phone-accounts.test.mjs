import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("phone workspace contains both provider methods, no live activation controls",()=>{
 const html=read("index.html");
 assert.match(html,/id="view-phone-accounts"/);
 assert.match(html,/value="meta"/);
 assert.match(html,/value="evolution"/);
 assert.match(html,/id="phone-access-form"/);
 assert.match(html,/id="phone-qr-image"/);
 assert.match(html,/ENROLLMENT LOCKED/);
 assert.match(read("app.js"),/"phone-accounts":"Phone accounts"/);
});
test("no passwords, PINs, verification codes or QR survive in storage",()=>{
 const js=read("phone-accounts.js");
 assert.doesNotMatch(js,/localStorage|sessionStorage|indexedDB|document\.cookie|innerHTML|eval\(/);
 assert.match(js,/phone-token/);
 assert.match(js,/phone-code/);
 assert.match(js,/phone-pin/);
 assert.match(js,/phone-qr-image/);
 assert.match(js,/credentials:"same-origin"/);
 assert.match(js,/idempotency-key/);
});
test("Nginx only forwards token-guarded phone endpoints, never internal adapter paths",()=>{
 const cfg=read("nginx.conf");
 assert.match(cfg,/location = \/api\/phone-accounts/);
 assert.match(cfg,/location \^~ \/api\/phone-accounts\//);
 assert.match(cfg,/proxy_pass http:\/\/whatsapp-api:8782\/internal\/v1\/whatsapp\/phone-accounts/);
 assert.match(cfg,/location \^~ \/adapter\/ \{ return 404;/);
 assert.doesNotMatch(cfg,/proxy_pass[^\n]*\/enrollment\/execute/);
 assert.match(cfg,/limit_req zone=policy_validation/);
});
test("Compose pins both enrollment effect gates to false and isolated secret files",()=>{
 const yml=read("deploy/compose.staging.yml");
 assert.match(yml,/PHONE_ENROLLMENT_EFFECTS_ENABLED: "false"/);
 assert.match(yml,/PROVIDER_ENROLLMENT_ENABLED: "false"/);
 assert.match(yml,/PHONE_ADMIN_TOKEN_FILE:/);
 assert.match(yml,/ADAPTER_SERVICE_TOKEN_FILE:/);
 assert.match(yml,/PHONE_ACCOUNTS_FILE:/);
});
