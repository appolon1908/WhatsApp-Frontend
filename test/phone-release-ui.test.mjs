import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("release readiness panel reports actual backend gates rather than invented success",()=>{
 const html=read("index.html"),js=read("phone-accounts.js");
 assert.match(html,/id="phone-release-gates"/);
 assert.match(html,/id="phone-release-status"/);
 assert.match(html,/id="phone-release-refresh"/);
 assert.match(js,/fetch\("\/api\/phone-readiness"/);
 assert.match(js,/data\.production_approved===true/);
 assert.match(js,/Blocked — production GO = NO/);
 assert.doesNotMatch(js,/localStorage|indexedDB|eval\(|innerHTML/);
});
test("release state cannot be enabled through a frontend-only switch",()=>{
 const js=read("phone-accounts.js"),html=read("index.html");
 assert.doesNotMatch(js,/PHONE_ENROLLMENT_EFFECTS_ENABLED\s*=\s*true/);
 assert.doesNotMatch(html,/Enable production|Enable live messaging/);
 assert.match(read("deploy/compose.preview.yml"),/PHONE_ENROLLMENT_EFFECTS_ENABLED: "false"/);
});
