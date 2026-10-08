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
 assert.doesNotMatch(nginx,/proxy_pass[^\n]*\/internal/);
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
