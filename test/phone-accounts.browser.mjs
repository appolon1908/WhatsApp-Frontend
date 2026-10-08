import assert from "node:assert/strict";
if (!process.env.DASHBOARD_URL) {
 console.log("SKIP phone account browser test without DASHBOARD_URL");
} else {
 const { chromium } = await import("playwright");
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:1366,height:900}});
 const errors=[];let sendRequests=0;
 page.on("pageerror",e=>errors.push(e.message));
 page.on("request",req=>{if(req.method()==="POST"&&/\/transport\/messages|\/enrollment\/execute|\/platform\/v1\/whatsapp\/messages/.test(req.url()))sendRequests++;});
 try {
  await page.goto(process.env.DASHBOARD_URL,{waitUntil:"networkidle",timeout:25000});
  await page.locator('[data-page="phone-accounts"].nav-item').click();
  await page.locator("#phone-accounts-title").waitFor({state:"visible"});
  assert.match(await page.locator("#phone-feedback").innerText(),/Waiting for admin access/);
  await page.locator("#phone-provider").selectOption("evolution");
  assert.equal(await page.locator("#phone-evolution-fields").isVisible(),true);
  assert.equal(await page.locator("#phone-meta-fields").isVisible(),false);
  await page.locator("#phone-provider").selectOption("meta");
  assert.equal(await page.locator("#phone-meta-fields").isVisible(),true);
  assert.equal(await page.locator("#phone-evolution-fields").isVisible(),false);
  await page.locator("#phone-access-form button").click();
  assert.match(await page.locator("#phone-feedback").innerText(),/valid tenant and private admin key/);
  assert.equal(await page.locator("#phone-token").inputValue(),"");
  assert.equal(sendRequests,0);
  assert.deepEqual(errors,[]);
  console.log("PHONE_ENROLLMENT_BROWSER=PASS: navigation, both providers, auth gate and no effects");
 }finally{await browser.close();}
}
