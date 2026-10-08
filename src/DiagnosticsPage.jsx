import { useCallback, useEffect, useState } from "react";
import { Activity, BadgeCheck, CircleAlert, RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "./api.js";
import { currentBackendApi, internalBackendApi } from "./endpoints.js";

function Result({ value }) {
  if (!value) return null;
  return <pre className="diagnostic-result">{JSON.stringify(value, null, 2)}</pre>;
}

function StateBadge({ ok, children }) {
  return <span className={ok ? "api-state api-state-ok" : "api-state api-state-warn"}>{children}</span>;
}

export default function DiagnosticsPage() {
  const [health, setHealth] = useState(null);
  const [ready, setReady] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [eligibility, setEligibility] = useState(null);
  const [campaignResult, setCampaignResult] = useState(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [healthData, readyData] = await Promise.all([api.health(), api.ready()]);
      setHealth(healthData);
      setReady(readyData);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function checkEligibility(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setEligibility(await api.eligibility({
        recipient: form.get("recipient"),
        consent_status: form.get("consent_status"),
        suppressed: form.get("suppressed") === "on",
        opted_out: form.get("opted_out") === "on"
      }));
      setError(null);
    } catch (e) { setError(e); }
  }

  async function validateCampaign(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      setCampaignResult(await api.validateCampaign({
        owner_id: form.get("owner_id"),
        template_id: form.get("template_id"),
        audience_count: Number(form.get("audience_count")),
        bulk_approved: form.get("bulk_approved") === "on"
      }));
      setError(null);
    } catch (e) {
      setCampaignResult({ valid: false, error: { code: e.code, message: e.message, details: e.details } });
    }
  }

  return (
    <div className="page-stack">
      {error && (
        <div className="error-banner">
          <CircleAlert size={18} />
          <div><strong>{error.code || "API error"}</strong><span>{error.message}</span></div>
        </div>
      )}

      <section className="diagnostic-grid">
        <article className="panel diagnostic-card">
          <div className="diagnostic-card-title"><Activity size={18} /><strong>Application health</strong></div>
          <StateBadge ok={health?.status === "ok"}>{health?.status || "unknown"}</StateBadge>
          <p>{health?.service || "Waiting for /healthz"}</p>
        </article>
        <article className="panel diagnostic-card">
          <div className="diagnostic-card-title"><ShieldCheck size={18} /><strong>Readiness</strong></div>
          <StateBadge ok={ready?.status === "ready"}>{ready?.status || "unknown"}</StateBadge>
          <p>{ready?.safe_mode ? "Safe mode — provider effects locked" : "Provider effect mode reported enabled"}</p>
        </article>
        <article className="panel diagnostic-card">
          <div className="diagnostic-card-title"><BadgeCheck size={18} /><strong>Middleware registry</strong></div>
          <StateBadge ok={Boolean(ready?.middleware_command_type_configured)}>
            {ready?.middleware_command_type_configured ? "configured" : "not configured"}
          </StateBadge>
          <p>{ready?.registry_dependency || "WhatsApp command family is registered."}</p>
        </article>
        <article className="panel diagnostic-card diagnostic-refresh">
          <strong>Live API readback</strong>
          <button className="button button-ghost" onClick={refresh}>
            <RefreshCw size={15} className={refreshing ? "spin" : ""} /> Refresh
          </button>
        </article>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h3>Browser API coverage</h3><p>Every browser-facing operation in the current WhatsApp PR #11 OpenAPI contract has a frontend client binding.</p></div></div>
        <div className="api-table">
          {currentBackendApi.map((entry) => (
            <div className="api-row" key={entry.method + entry.path}>
              <code>{entry.method}</code><code>{entry.path}</code><span>{entry.purpose}</span><StateBadge ok>bound</StateBadge>
            </div>
          ))}
        </div>
      </section>

      <div className="two-column">
        <form className="panel diagnostic-form" onSubmit={checkEligibility}>
          <div className="panel-head"><div><h3>Recipient eligibility</h3><p>Run the exact pre-send rule without sending anything.</p></div></div>
          <div className="diagnostic-form-body">
            <div><label>Recipient</label><input name="recipient" placeholder="+18095550100" required /></div>
            <div><label>Consent status</label><select name="consent_status" defaultValue="opted_in"><option value="opted_in">Opted in</option><option value="unknown">Unknown</option><option value="opted_out">Opted out</option></select></div>
            <label className="checkbox"><input name="suppressed" type="checkbox" /> Suppressed</label>
            <label className="checkbox"><input name="opted_out" type="checkbox" /> Explicitly opted out</label>
            <button className="button button-primary" type="submit">Check eligibility</button>
            <Result value={eligibility} />
          </div>
        </form>

        <form className="panel diagnostic-form" onSubmit={validateCampaign}>
          <div className="panel-head"><div><h3>Campaign validator</h3><p>Validate a draft before any Middleware effect request.</p></div></div>
          <div className="diagnostic-form-body">
            <div><label>Owner ID</label><input name="owner_id" defaultValue="frontend-operator" required /></div>
            <div><label>Template ID</label><input name="template_id" defaultValue="template-demo" required /></div>
            <div><label>Audience count</label><input name="audience_count" type="number" min="1" defaultValue="1" required /></div>
            <label className="checkbox"><input name="bulk_approved" type="checkbox" /> Bulk approved</label>
            <button className="button button-primary" type="submit">Validate campaign</button>
            <Result value={campaignResult} />
          </div>
        </form>
      </div>

      <section className="panel">
        <div className="panel-head"><div><h3>Internal service-only API</h3><p>These operations are intentionally not callable from the browser; Middleware/provider services use them with internal authentication.</p></div></div>
        <div className="api-table">
          {internalBackendApi.map((entry) => (
            <div className="api-row" key={entry.method + entry.path}>
              <code>{entry.method}</code><code>{entry.path}</code><span>{entry.purpose}</span><StateBadge ok={false}>internal</StateBadge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
