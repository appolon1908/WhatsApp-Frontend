import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
test("staging console describes disabled effects and no live inbox", () => {
  const page = read("index.html");
  assert.match(page, /STAGING · SEND DISABLED/);
  assert.match(page, /not a live inbox/);
  assert.doesNotMatch(page, /<script(?![^>]*src=)/);
});
test("gateway proxies only safe GET readouts, not commands or adapter internals", () => {
  const nginx = read("nginx.conf");
  assert.match(nginx, /location = \/api\/healthz/);
  assert.match(nginx, /location = \/api\/readyz/);
  assert.match(nginx, /location = \/adapter\/healthz/);
  assert.match(nginx, /location \^~ \/api\/ \{ return 404;/);
  assert.match(nginx, /location \^~ \/adapter\/ \{ return 404;/);
  assert.doesNotMatch(nginx, /proxy_pass.*\/messages/);
});
test("dynamic output uses textContent rather than HTML insertion", () => {
  const js = read("app.js");
  assert.match(js, /textContent = value/);
  assert.doesNotMatch(js, /innerHTML|eval\(/);
});
