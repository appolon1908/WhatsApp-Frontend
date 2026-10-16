// Live staging browser acceptance: npm install --no-save playwright@1.56.1
// Run: DASHBOARD_URL=http://10.0.0.218:3082 node test/browser.e2e.mjs
// Tests NEVER issue provider commands or send customer messages.
import assert from "node:assert/strict";
// Playwright dependency is only required when live browser acceptance is explicitly requested.

if (!process.env.DASHBOARD_URL) {
 console.log("SKIP browser acceptance: DASHBOARD_URL not provided");
} else {
 const { chromium } = await import("playwright");
const base = process.env.DASHBOARD_URL;
assert.ok(base?.startsWith("http"), "DASHBOARD_URL is required");
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const errors = [];
let attemptsAtSending = 0;
try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  page.on("pageerror",e=>errors.push(e.message));
  page.on("request",request=>{
    if(request.method()!=="GET" && (request.url().includes("/messages") || request.url().includes("/internal/")))attemptsAtSending++;
  });
  await page.goto(base, {waitUntil:"networkidle",timeout:30000});
  assert.match(await page.title(),/Codestra.*WhatsApp/);
  await page.locator("#app-health").getByText("Online").waitFor();
  await page.locator("#adapter-health").getByText("Online").waitFor();
  assert.equal(await page.locator("#send-mode").innerText(),"Locked");
  assert.equal(await page.locator("#command-mode").innerText(),"Not registered");
  console.log("PASS overview shows real online services and locked send");

  await page.locator('[data-page="contacts"].nav-item').click();
  await page.locator("#recipient").fill("15550000000");
  await page.locator("#consent").selectOption("unknown");
  await page.locator("#eligibility-form button[type=submit]").click();
  await page.locator("#eligibility-result strong").getByText("Recipient ineligible").waitFor();
  assert.match(await page.locator("#eligibility-result").innerText(),/Explicit opt-in/);
  await page.locator("#consent").selectOption("opted_in");
  await page.locator("#eligibility-form button[type=submit]").click();
  await page.locator("#eligibility-result strong").getByText("Eligible under policy").waitFor();
  console.log("PASS real contact eligibility negative and positive");

  await page.locator('[data-page="campaigns"].nav-item').click();
  await page.locator("#owner").fill("qa-owner");
  await page.locator("#template-id").fill("qa-template");
  await page.locator("#audience").fill("2");
  await page.locator("#campaign-form button[type=submit]").click();
  await page.locator("#campaign-result strong").getByText("Validation incomplete").waitFor();
  assert.match(await page.locator("#campaign-result").innerText(),/bulk delivery/i);
  await page.locator("#bulk-approved").check();
  await page.locator("#campaign-form button[type=submit]").click();
  await page.locator("#campaign-result strong").getByText("Draft passes policy").waitFor();
  console.log("PASS real campaign validation negative and positive");

  await page.locator('[data-page="channels"].nav-item').click();
  await page.locator("#provider-evolution").getByText("Not configured").waitFor();
  console.log("PASS channel configuration truthful");

  await page.locator('[data-page="inbox"].nav-item').click();
  await page.getByText("No conversations connected").waitFor();
  console.log("PASS inbox does not invent messages");

  await page.locator('[data-page="activity"].nav-item').click();
  assert.match(await page.locator("#activity-log").innerText(),/validation completed/i);
  console.log("PASS real session activity");

  await page.locator('[data-page="diagnostics"].nav-item').click();
  await page.locator("#api-json").getByText(/codestra-whatsapp-app/).waitFor();
  console.log("PASS read-only diagnostics");

  await page.setViewportSize({width:390,height:844});
  await page.locator("#menu").click();
  await page.locator('[data-page="settings"].nav-item').click();
  await page.locator("#settings-title").waitFor({state:"visible"});
  console.log("PASS mobile menu navigation");

  assert.equal(attemptsAtSending,0,"browser must not attempt messaging");
  assert.deepEqual(errors,[],"browser JavaScript errors");
  console.log("PASS no sending or browser errors; all acceptance checks complete");
} finally {
  await browser.close();
}

}
