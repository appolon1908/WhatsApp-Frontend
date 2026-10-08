"use strict";
const $ = (id) => document.getElementById(id);
function status(id, value, cls = "") {
  const node = $(id);
  node.textContent = value;
  node.className = "state " + cls;
}
async function readJson(path) {
  const response = await fetch(path, { cache: "no-store", headers: { accept: "application/json" }, signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.json();
}
async function refresh() {
  $("refresh").disabled = true;
  const results = await Promise.allSettled([readJson("/api/healthz"), readJson("/adapter/healthz"), readJson("/api/readyz")]);
  const [app, adapter, readiness] = results;
  status("app-health", app.status === "fulfilled" && app.value.status === "ok" ? "Online" : "Unavailable", app.status === "fulfilled" && app.value.status === "ok" ? "ok" : "error");
  status("adapter-health", adapter.status === "fulfilled" && adapter.value.status === "ok" ? "Online" : "Unavailable", adapter.status === "fulfilled" && adapter.value.status === "ok" ? "ok" : "error");
  if (readiness.status === "fulfilled") {
    const r = readiness.value;
    status("send-mode", r.safe_mode === true ? "Disabled" : "⚠ Check configuration", r.safe_mode === true ? "locked" : "error");
    status("command-mode", r.middleware_command_type_configured ? "Configured (unverified)" : "Not registered", r.middleware_command_type_configured ? "warn" : "locked");
  } else {
    status("send-mode", "Unknown — treat as locked", "error");
    status("command-mode", "Unavailable", "error");
  }
  $("last-updated").textContent = "Last checked " + new Date().toLocaleTimeString();
  $("refresh").disabled = false;
}
$("refresh").addEventListener("click", refresh);
refresh();
setInterval(refresh, 30000);
