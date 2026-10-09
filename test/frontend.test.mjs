import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");

test("all ten dashboard sections have navigable accessible views",()=>{
 const h=read("index.html");
 for(const section of ["overview","inbox","contacts","campaigns","templates","automations","channels","activity","diagnostics","settings"]){
   assert.match(h,new RegExp('data-page="'+section+'"'));
   assert.match(h,new RegExp('id="view-'+section+'"'));
 }
 assert.match(h,/STAGING · SEND DISABLED/);
 assert.match(h,/not a live inbox/);
 assert.doesNotMatch(h,/<script(?![^>]*src=)/);
});
test("status samples come from live endpoints, never fabricated analytics",()=>{
 const js=read("app.js");
 for(const path of ["/api/healthz","/api/readyz","/adapter/healthz","/adapter/readyz"]){
   assert.ok(js.includes(path),path);
 }
 assert.match(js,/Promise\.allSettled/);
 assert.match(js,/state\.samples\.push/);
 assert.doesNotMatch(js,/localStorage|sessionStorage|indexedDB|innerHTML|eval\(/);
 assert.match(read("index.html"),/No conversations connected/);
});
test("forms use only non-persistent business-policy validation APIs",()=>{
 const js=read("app.js");
 const nginx=read("nginx.conf");
 for(const path of ["/api/contacts/eligibility","/api/campaigns/validate"]){
   assert.ok(js.includes(path));
   assert.ok(nginx.includes("location = "+path));
 }
 assert.match(nginx,/limit_req zone=policy_validation/);
 assert.match(nginx,/if \(\$request_method != POST\)/);
 assert.match(nginx,/client_max_body_size 8k/);
 assert.match(nginx,/proxy_set_header Authorization ""/);
 assert.doesNotMatch(nginx,/proxy_pass[^\n]*\/messages/);
 assert.match(nginx,/proxy_pass http:\/\/\$whatsapp_backend\/internal\/v1\/whatsapp\/phone-accounts/);
 assert.doesNotMatch(nginx,/proxy_pass[^\n]*\/internal\/v1\/whatsapp\/transport/);
});
test("gateway denies every unlisted API or adapter route",()=>{
 const nginx=read("nginx.conf");
 assert.match(nginx,/location \^~ \/api\/ \{ return 404;/);
 assert.match(nginx,/location \^~ \/adapter\/ \{ return 404;/);
 assert.match(nginx,/location = \/adapter\/readyz/);
 assert.match(nginx,/frame-ancestors 'none'/);
 assert.match(nginx,/Permissions-Policy/);
});
test("dashboard does not persist recipient or campaign forms",()=>{
 const js=read("app.js");
 assert.match(js,/const body=\{recipient:/);
 assert.match(js,/const body=\{owner_id:/);
 assert.match(js,/replaceChildren\(/);
 assert.match(js,/document\.createTextNode|textContent=/);
 assert.doesNotMatch(js,/document\.cookie|localStorage|innerHTML/);
});

test("public authentication is reused only for same-origin API requests",()=>{
 const js=read("app.js");
 assert.ok(js.includes('credentials:"same-origin"'));
 assert.ok(!js.includes('credentials:"omit"'));
 assert.ok(js.includes('middleware:"/api/integrations/middleware"'));
 assert.match(js,/middlewareUp=middleware.status==="fulfilled"/);
 const html=read("index.html");
 assert.match(html,/id="connection-middleware"/);
 assert.match(html,/id="diagnostic-middleware"/);
 assert.ok(!js.includes("/platform/v1/commands"));
});

test("Docker backend routing dynamically re-resolves service addresses",()=>{
 const nginx=read("nginx.conf");
 assert.match(nginx,/resolver 127\.0\.0\.11 valid=5s ipv6=off/);
 assert.match(nginx,/set \$whatsapp_backend "whatsapp-api:8782"/);
 assert.match(nginx,/set \$provider_backend "evolution-adapter:8781"/);
 assert.doesNotMatch(nginx,/proxy_pass http:\/\/whatsapp-api:8782/);
 assert.doesNotMatch(nginx,/proxy_pass http:\/\/evolution-adapter:8781/);
});
