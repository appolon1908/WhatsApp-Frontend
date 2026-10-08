import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, BadgeCheck, BarChart3, Bell, BookOpenText, CheckCircle2, ChevronRight,
  CircleAlert, CircleUserRound, ContactRound, Inbox, LayoutDashboard, LogOut,
  Megaphone, MessageCircleMore, PauseCircle, Plus, RefreshCw, Search, Send,
  Settings, ShieldCheck, Sparkles, UserRoundCheck, UsersRound
} from "lucide-react";
import { api, baseUrl } from "./api.js";
import DiagnosticsPage from "./DiagnosticsPage.jsx";
import {
  authConfigured, completeLoginFromRedirect, isDevBypass, logout, sessionIdentity, startLogin
} from "./auth.js";

const NAV = [
  ["overview", "Overview", LayoutDashboard],
  ["inbox", "Inbox", Inbox],
  ["contacts", "Contacts", ContactRound],
  ["templates", "Templates", BookOpenText],
  ["campaigns", "Campaigns", Megaphone],
  ["diagnostics", "API & Safety", Activity],
  ["settings", "Settings", Settings]
];

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function initials(value) {
  return String(value || "?").split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "—" : new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  }).format(date);
}

function StatusPill({ value }) {
  const key = String(value || "unknown").toLowerCase();
  return <span className={cx("status-pill", "status-" + key)}>{key.replaceAll("_", " ")}</span>;
}

function Button({ children, kind = "primary", className, ...props }) {
  return <button className={cx("button", "button-" + kind, className)} {...props}>{children}</button>;
}

function EmptyState({ icon: Icon = MessageCircleMore, title, body }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon size={24} /></div>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="error-banner">
      <CircleAlert size={18} />
      <div>
        <strong>{error.code || "Request failed"}</strong>
        <span>{error.message}</span>
      </div>
      {onRetry && <Button kind="ghost" onClick={onRetry}><RefreshCw size={15} /> Retry</Button>}
    </div>
  );
}

function LoadingBlock() {
  return <div className="loading-block"><span /><span /><span /></div>;
}

function LoginScreen({ error }) {
  const configured = authConfigured();
  return (
    <main className="login-screen">
      <section className="login-card">
        <div className="brand-mark large"><MessageCircleMore size={27} /></div>
        <div className="eyebrow">CODESTRA COMMUNICATIONS</div>
        <h1>WhatsApp Agent Console</h1>
        <p>Secure tenant-scoped conversations, contacts, campaigns and operator workflows.</p>
        {error && <ErrorBanner error={error} />}
        {!configured ? (
          <div className="setup-warning">
            <CircleAlert size={18} />
            <span>Frontend authentication is not configured. Set the Keycloak environment values before sign-in.</span>
          </div>
        ) : (
          <Button onClick={() => startLogin()}><ShieldCheck size={17} /> Sign in with Codestra</Button>
        )}
        <div className="login-meta">
          <span><BadgeCheck size={15} /> Middleware V3 authority</span>
          <span><ShieldCheck size={15} /> PKCE authentication</span>
        </div>
      </section>
    </main>
  );
}

function Sidebar({ page, setPage, identity }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><MessageCircleMore size={21} /></div>
        <div><strong>Codestra</strong><span>WhatsApp</span></div>
      </div>
      <nav>
        <div className="nav-label">WORKSPACE</div>
        {NAV.map(([id, label, Icon]) => (
          <button key={id} className={cx("nav-item", page === id && "active")} onClick={() => setPage(id)}>
            <Icon size={18} />
            <span>{label}</span>
            {id === "inbox" && <span className="nav-dot" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="tenant-chip">
          <div className="avatar small">{initials(identity.subject)}</div>
          <div><strong>{identity.subject || "Operator"}</strong><span>{identity.tenantId || "No tenant"}</span></div>
        </div>
        <button className="icon-button" onClick={logout} title="Sign out"><LogOut size={17} /></button>
      </div>
    </aside>
  );
}

function Topbar({ title, identity, onRefresh, refreshing, safeMode, unreadCount = 0 }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationCount = Number(unreadCount || 0) + (safeMode ? 1 : 0);
  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">WHATSAPP OPERATIONS</div>
        <h2>{title}</h2>
      </div>
      <div className="topbar-actions">
        <div className="notification-wrap">
          <button
            className="icon-button notification-button"
            title="Notifications"
            aria-label="Notifications"
            aria-expanded={showNotifications}
            onClick={() => setShowNotifications((value) => !value)}
          >
            <Bell size={18} />
            {notificationCount > 0 && <span className="notification-count">{Math.min(notificationCount, 99)}</span>}
          </button>
          {showNotifications && (
            <div className="notification-popover">
              <div className="popover-head"><strong>Workspace status</strong><button onClick={() => setShowNotifications(false)}>×</button></div>
              {safeMode && <div className="notification-item warning"><ShieldCheck size={16} /><div><strong>Safe mode active</strong><span>Outbound provider effects are locked.</span></div></div>}
              {unreadCount > 0
                ? <div className="notification-item"><MessageCircleMore size={16} /><div><strong>{unreadCount} unread messages</strong><span>Open Inbox to review customer activity.</span></div></div>
                : <div className="notification-item"><CheckCircle2 size={16} /><div><strong>Inbox caught up</strong><span>No unread customer messages.</span></div></div>}
            </div>
          )}
        </div>
        <button className="icon-button" onClick={onRefresh} title="Refresh" aria-label="Refresh workspace">
          <RefreshCw size={18} className={refreshing ? "spin" : ""} />
        </button>
        <div className="profile-badge">
          <div className="avatar">{initials(identity.subject)}</div>
          <div><strong>{identity.subject || "Operator"}</strong><span>{identity.roles?.[0] || "agent"}</span></div>
        </div>
      </div>
    </header>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = "green" }) {
  return (
    <article className="metric-card">
      <div className={cx("metric-icon", tone)}><Icon size={19} /></div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value ?? 0}</div>
      <div className="metric-detail">{detail}</div>
    </article>
  );
}

function OverviewPage({ dashboard, conversations, onOpenInbox, safeMode }) {
  if (!dashboard) return <EmptyState icon={BarChart3} title="Dashboard API not published yet" body="The current backend contract is healthy without the planned dashboard read model. Use API & Safety for live endpoint checks." />;
  return (
    <div className="page-stack">
      {safeMode && (
        <div className="safety-banner">
          <ShieldCheck size={19} />
          <div><strong>Safe mode is active</strong><span>External provider effects remain disabled until production gates are explicitly enabled.</span></div>
        </div>
      )}
      <section className="metric-grid">
        <MetricCard icon={MessageCircleMore} label="Conversations" value={dashboard.conversations?.total} detail={String(dashboard.conversations?.unread || 0) + " unread"} />
        <MetricCard icon={UsersRound} label="Opted-in contacts" value={dashboard.business?.contacts?.opted_in} detail={String(dashboard.business?.contacts?.total || 0) + " total contacts"} tone="blue" />
        <MetricCard icon={UserRoundCheck} label="Waiting for agent" value={dashboard.conversations?.waiting_agent} detail={String(dashboard.conversations?.escalated || 0) + " escalated"} tone="amber" />
        <MetricCard icon={Megaphone} label="Ready campaigns" value={dashboard.business?.campaigns?.ready} detail={String(dashboard.business?.campaigns?.draft || 0) + " drafts"} tone="violet" />
      </section>

      <div className="two-column">
        <section className="panel">
          <div className="panel-head">
            <div><h3>Recent conversations</h3><p>Latest customer activity across the tenant.</p></div>
            <Button kind="ghost" onClick={onOpenInbox}>Open inbox <ChevronRight size={15} /></Button>
          </div>
          <div className="conversation-table">
            {(conversations || []).slice(0, 6).map((item) => (
              <div className="conversation-row" key={item.conversation_id}>
                <div className="avatar customer">{initials(item.customer_identity)}</div>
                <div className="grow"><strong>{item.customer_identity}</strong><span>{item.business_identity}</span></div>
                <StatusPill value={item.status} />
                <div className="unread">{item.unread_count || 0}</div>
                <time>{formatTime(item.updated_at)}</time>
              </div>
            ))}
            {!conversations?.length && <EmptyState title="No conversations yet" body="Inbound conversations will appear here after W3 accepts normalized WhatsApp events." />}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><div><h3>Operational readiness</h3><p>Business data and messaging controls.</p></div><Activity size={18} /></div>
          <div className="readiness-list">
            <div><span><CheckCircle2 size={17} /> Contact eligibility</span><strong>{dashboard.business?.contacts?.opted_in || 0} eligible</strong></div>
            <div><span><BookOpenText size={17} /> Templates</span><strong>{dashboard.business?.templates?.approved || 0} approved</strong></div>
            <div><span><Megaphone size={17} /> Campaigns</span><strong>{dashboard.business?.campaigns?.ready || 0} ready</strong></div>
            <div><span><ShieldCheck size={17} /> Provider effects</span><strong>{safeMode ? "Locked" : "Enabled"}</strong></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function InboxPage({ conversations, refreshConversations, safeMode }) {
  const [selectedId, setSelectedId] = useState(conversations?.[0]?.conversation_id || null);
  const [timeline, setTimeline] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [sendText, setSendText] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [aiBusy, setAiBusy] = useState("");
  const [aiPreview, setAiPreview] = useState("");
  const [aiLanguage, setAiLanguage] = useState("Spanish");

  const filteredConversations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (conversations || []).filter((item) => {
      const matchesSearch = !needle || [item.customer_identity, item.business_identity, item.status]
        .some((value) => String(value || "").toLowerCase().includes(needle));
      const matchesFilter =
        filter === "all" ||
        (filter === "unread" && Number(item.unread_count || 0) > 0) ||
        (filter === "waiting" && item.status === "waiting_agent") ||
        (filter === "assigned" && Boolean(item.assigned_to));
      return matchesSearch && matchesFilter;
    });
  }, [conversations, query, filter]);

  const selected = useMemo(
    () => filteredConversations.find((item) => item.conversation_id === selectedId)
      || conversations?.find((item) => item.conversation_id === selectedId)
      || filteredConversations[0]
      || null,
    [filteredConversations, conversations, selectedId]
  );

  const unreadTotal = useMemo(
    () => (conversations || []).reduce((sum, item) => sum + Number(item.unread_count || 0), 0),
    [conversations]
  );

  useEffect(() => {
    if (!selected?.conversation_id) {
      setConversation(null);
      setTimeline([]);
      return;
    }
    setSelectedId(selected.conversation_id);
    setLoading(true);
    setNotice("");
    Promise.all([api.conversation(selected.conversation_id), api.timeline(selected.conversation_id)])
      .then(([detail, line]) => {
        setConversation(detail);
        setTimeline(line.items || []);
        setError(null);
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [selected?.conversation_id]);

  async function mutate(action) {
    if (!conversation || actionBusy) return;
    const confirmation = {
      resolve: "Resolve this conversation? The customer can still be reopened later.",
      reopen: "Reopen this conversation and return it to active handling?",
      escalate: "Escalate this conversation to a supervisor?",
      pause: "Pause automation for this conversation?",
      resume: "Resume automation for this conversation?"
    }[action];
    if (confirmation && !window.confirm(confirmation)) return;

    setActionBusy(action);
    setNotice("");
    try {
      setError(null);
      let updated;
      if (action === "claim") updated = await api.claim(conversation.conversation_id, conversation.version);
      if (action === "resolve") updated = await api.resolve(conversation.conversation_id, conversation.version, "agent_resolved");
      if (action === "reopen") updated = await api.reopen(conversation.conversation_id, conversation.version, "agent_reopened");
      if (action === "escalate") updated = await api.escalate(conversation.conversation_id, conversation.version, "agent_escalated");
      if (action === "pause") updated = await api.setAutomation(conversation.conversation_id, "pause", conversation.version, "agent_paused");
      if (action === "resume") updated = await api.setAutomation(conversation.conversation_id, "resume", conversation.version, "agent_resumed");
      setConversation(updated);
      setNotice({
        claim: "Conversation claimed.",
        resolve: "Conversation resolved.",
        reopen: "Conversation reopened.",
        escalate: "Conversation escalated.",
        pause: "Automation paused.",
        resume: "Automation resumed."
      }[action] || "Conversation updated.");
      await refreshConversations();
    } catch (e) {
      setError(e);
    } finally {
      setActionBusy("");
    }
  }


  async function runAiDraft(action) {
    if (!conversation || aiBusy) return;
    if (["rewrite", "shorter", "professional", "translate"].includes(action) && !sendText.trim()) {
      setError(Object.assign(new Error("Write or generate a draft first, then use this AI action."), { code: "draft_required" }));
      return;
    }
    setAiBusy(action);
    setAiPreview("");
    setNotice("");
    try {
      setError(null);
      const latestInbound = [...timeline].reverse().find((entry) => entry.type === "message" && entry.data?.direction === "inbound");
      const accepted = await api.createAiDraft({
        conversation_id: conversation.conversation_id,
        action,
        draft: sendText.trim() || undefined,
        language: action === "translate" ? aiLanguage : undefined,
        knowledge_query: action === "knowledge_answer"
          ? (latestInbound?.data?.content?.text || "Answer the customer's latest question using only approved company knowledge.")
          : undefined
      });
      const commandId = accepted.command_id;
      if (!commandId) throw Object.assign(new Error("AI draft command was accepted without a command ID."), { code: "ai_command_missing" });

      let result = null;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        try {
          result = await api.aiDraftResult(commandId);
          break;
        } catch (e) {
          if (![409, 425].includes(e.status)) throw e;
        }
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
      if (!result) throw Object.assign(new Error("AI draft is still processing. Try again in a moment."), { code: "ai_draft_pending" });

      const payload = result.middleware || {};
      const proposal =
        payload.output?.proposal ||
        payload.result?.output?.proposal ||
        payload.proposal ||
        payload.result?.proposal ||
        "";
      if (!proposal) throw Object.assign(new Error("AI completed without a usable proposal."), { code: "ai_proposal_missing" });

      setAiPreview(String(proposal));
      setNotice("AI produced a draft for human review. Nothing was sent.");
    } catch (e) {
      setError(e);
    } finally {
      setAiBusy("");
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!conversation || !sendText.trim() || safeMode) return;
    setActionBusy("send");
    setNotice("");
    try {
      setError(null);
      const result = await api.contacts({ q: conversation.customer_identity, limit: 20 });
      const contact = (result.items || []).find((item) => item.phone === conversation.customer_identity);
      if (!contact) {
        const e = new Error("Create a consent-aware contact record before sending to this number.");
        e.code = "contact_record_required";
        throw e;
      }
      await api.sendMessage({
        contact_id: contact.contact_id,
        campaign_id: "agent-console-direct",
        message: { type: "text", text: sendText.trim() }
      });
      setSendText("");
      setNotice("Message accepted by the governed WhatsApp API.");
      const line = await api.timeline(conversation.conversation_id);
      setTimeline(line.items || []);
    } catch (e) {
      setError(e);
    } finally {
      setActionBusy("");
    }
  }

  return (
    <div className="inbox-shell professional-inbox">
      <section className="inbox-list panel">
        <div className="panel-head compact">
          <div><h3>Inbox</h3><p>{conversations?.length || 0} conversations · {unreadTotal} unread</p></div>
        </div>
        <div className="inbox-controls">
          <div className="search-box compact-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer, number or status"
              aria-label="Search conversations"
            />
          </div>
          <div className="filter-chips" role="group" aria-label="Conversation filters">
            {[
              ["all", "All"],
              ["unread", "Unread"],
              ["waiting", "Waiting"],
              ["assigned", "Assigned"]
            ].map(([id, label]) => (
              <button key={id} className={cx("filter-chip", filter === id && "active")} onClick={() => setFilter(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="conversation-list-scroll">
          {filteredConversations.map((item) => (
            <button
              key={item.conversation_id}
              className={cx("conversation-card", selected?.conversation_id === item.conversation_id && "selected")}
              onClick={() => setSelectedId(item.conversation_id)}
              aria-pressed={selected?.conversation_id === item.conversation_id}
            >
              <div className="avatar customer">{initials(item.customer_identity)}</div>
              <div className="grow"><strong>{item.customer_identity}</strong><span>{String(item.status || "unknown").replaceAll("_", " ")}</span></div>
              <div className="conversation-card-meta"><time>{formatTime(item.updated_at)}</time>{item.unread_count > 0 && <b>{item.unread_count}</b>}</div>
            </button>
          ))}
          {!filteredConversations.length && (
            <EmptyState
              title={query || filter !== "all" ? "No matching conversations" : "Inbox is clear"}
              body={query || filter !== "all" ? "Try another search or filter." : "New conversations will appear when inbound events are processed."}
            />
          )}
        </div>
      </section>

      <section className="chat-panel panel">
        {!selected ? (
          <EmptyState title="Select a conversation" body="Choose a conversation from the inbox to inspect its timeline." />
        ) : (
          <>
            <div className="chat-head">
              <div className="avatar customer">{initials(selected.customer_identity)}</div>
              <div className="grow">
                <h3>{selected.customer_identity}</h3>
                <span>{selected.business_identity || "WhatsApp customer"}</span>
              </div>
              <StatusPill value={conversation?.status || selected.status} />
            </div>

            <div className="conversation-actions" role="toolbar" aria-label="Conversation actions">
              <Button kind="secondary" onClick={() => mutate("claim")} disabled={!conversation || conversation.assigned_to || Boolean(actionBusy)}>
                <UserRoundCheck size={15} /> {conversation?.assigned_to ? "Assigned" : "Claim"}
              </Button>
              <Button kind="ghost" onClick={() => mutate(conversation?.automation_paused ? "resume" : "pause")} disabled={!conversation || Boolean(actionBusy)}>
                <PauseCircle size={15} /> {conversation?.automation_paused ? "Resume automation" : "Pause automation"}
              </Button>
              <Button kind="ghost" onClick={() => mutate("escalate")} disabled={!conversation || conversation.status === "escalated" || Boolean(actionBusy)}>
                <CircleAlert size={15} /> Escalate
              </Button>
              {conversation?.status === "resolved"
                ? <Button kind="ghost" onClick={() => mutate("reopen")} disabled={Boolean(actionBusy)}>Reopen</Button>
                : <Button kind="ghost" onClick={() => mutate("resolve")} disabled={!conversation || Boolean(actionBusy)}>Resolve</Button>}
            </div>

            {safeMode && (
              <div className="safety-banner compact-banner">
                <ShieldCheck size={17} />
                <div><strong>Outbound messaging is locked</strong><span>Safe mode is active. You can review and manage conversations without sending provider effects.</span></div>
              </div>
            )}
            {notice && <div className="success-banner"><CheckCircle2 size={17} /><span>{notice}</span></div>}
            <ErrorBanner error={error} />

            <div className="timeline" aria-live="polite">
              {loading ? <LoadingBlock /> : timeline.filter((entry) => entry.type === "message").map((entry, index) => {
                const message = entry.data;
                return (
                  <div key={message.message_id || index} className={cx("bubble-wrap", message.direction === "outbound" && "outbound")}>
                    <div className="message-bubble">
                      <p>{message.content?.text || "[" + (message.content?.type || "message") + "]"}</p>
                      <time>{formatTime(message.created_at)}</time>
                    </div>
                  </div>
                );
              })}
              {!loading && !timeline.some((entry) => entry.type === "message") && <EmptyState title="No messages yet" body="The conversation timeline has no materialized messages." />}
            </div>


            <section className="ai-assistant-panel" aria-label="AI reply assistant">
              <div className="ai-assistant-head">
                <div>
                  <strong><Sparkles size={16} /> AI reply assistant</strong>
                  <span>Draft-only · human review required · never auto-sends</span>
                </div>
                {aiBusy && <span className="ai-working"><RefreshCw size={14} className="spin" /> Working…</span>}
              </div>
              <div className="ai-actions">
                <Button kind="secondary" type="button" onClick={() => runAiDraft("suggest_reply")} disabled={Boolean(aiBusy)}>Suggest reply</Button>
                <Button kind="ghost" type="button" onClick={() => runAiDraft("rewrite")} disabled={Boolean(aiBusy) || !sendText.trim()}>Rewrite</Button>
                <Button kind="ghost" type="button" onClick={() => runAiDraft("shorter")} disabled={Boolean(aiBusy) || !sendText.trim()}>Shorter</Button>
                <Button kind="ghost" type="button" onClick={() => runAiDraft("professional")} disabled={Boolean(aiBusy) || !sendText.trim()}>More professional</Button>
                <div className="ai-translate">
                  <select value={aiLanguage} onChange={(e) => setAiLanguage(e.target.value)} aria-label="Translation language">
                    <option>Spanish</option><option>English</option><option>French</option><option>Haitian Creole</option>
                  </select>
                  <Button kind="ghost" type="button" onClick={() => runAiDraft("translate")} disabled={Boolean(aiBusy) || !sendText.trim()}>Translate</Button>
                </div>
                <Button kind="ghost" type="button" onClick={() => runAiDraft("summarize")} disabled={Boolean(aiBusy)}>Summarize</Button>
                <Button kind="ghost" type="button" onClick={() => runAiDraft("knowledge_answer")} disabled={Boolean(aiBusy)} title="Uses approved knowledge context when configured; otherwise the model must say what needs verification.">Knowledge answer</Button>
              </div>
              {aiPreview && (
                <div className="ai-preview">
                  <div><strong>AI draft</strong><span>Review and edit before sending.</span></div>
                  <p>{aiPreview}</p>
                  <div className="ai-preview-actions">
                    <Button type="button" onClick={() => { setSendText(aiPreview.slice(0, 4096)); setAiPreview(""); }}>Use this draft</Button>
                    <Button kind="ghost" type="button" onClick={() => setAiPreview("")}>Discard</Button>
                  </div>
                </div>
              )}
            </section>

            <form className="composer professional-composer" onSubmit={sendMessage}>
              <div className="composer-field">
                <textarea
                  value={sendText}
                  onChange={(e) => setSendText(e.target.value.slice(0, 4096))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder={safeMode ? "Outbound messaging is locked by safe mode" : "Write a reply…"}
                  disabled={safeMode || actionBusy === "send"}
                  rows="2"
                  aria-label="Message reply"
                />
                <small>{sendText.length}/4096 · Enter to send · Shift+Enter for new line</small>
              </div>
              <Button type="submit" disabled={safeMode || !sendText.trim() || actionBusy === "send"}>
                <Send size={17} /> {actionBusy === "send" ? "Sending…" : "Send"}
              </Button>
            </form>
          </>
        )}
      </section>

      <aside className="context-panel panel">
        {conversation ? (
          <>
            <div className="context-profile">
              <div className="avatar xl">{initials(conversation.customer_identity)}</div>
              <h3>{conversation.customer_identity}</h3>
              <span>{conversation.business_identity || "WhatsApp customer"}</span>
            </div>
            <div className="context-section">
              <label>Conversation status</label><StatusPill value={conversation.status} />
            </div>
            <div className="context-grid">
              <div><span>Unread</span><strong>{conversation.unread_count || 0}</strong></div>
              <div><span>Version</span><strong>{conversation.version}</strong></div>
              <div><span>Assigned to</span><strong>{conversation.assigned_to || "Unassigned"}</strong></div>
              <div><span>Automation</span><strong>{conversation.automation_paused ? "Paused" : "Active"}</strong></div>
            </div>
            <div className="context-help">
              <strong>Agent workflow</strong>
              <p>{conversation.assigned_to
                ? "This conversation is owned. Use escalation, automation controls, resolve/reopen, and the timeline to manage it."
                : "Claim the conversation before working it so ownership is explicit and auditable."}</p>
            </div>
          </>
        ) : <EmptyState title="Conversation context" body="Customer and assignment details will appear here." />}
      </aside>
    </div>
  );
}

function ContactsPage() {
  const [result, setResult] = useState({ items: [], total: 0 });
  const [q, setQ] = useState("");
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    api.contacts({ q, limit: 100 }).then((data) => { setResult(data); setError(null); }).catch(setError);
  }, [q]);

  useEffect(() => { load(); }, [load]);

  async function create(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.createContact({
        name: form.get("name"),
        phone: form.get("phone"),
        consent_status: form.get("consent_status"),
        tags: String(form.get("tags") || "").split(",").map((x) => x.trim()).filter(Boolean)
      });
      setShowForm(false);
      load();
    } catch (e) { setError(e); }
  }

  return (
    <div className="page-stack">
      <div className="toolbar">
        <div className="search-box"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search contacts, phone or tags" /></div>
        <Button onClick={() => setShowForm(!showForm)}><Plus size={16} /> New contact</Button>
      </div>
      <ErrorBanner error={error} onRetry={load} />
      {showForm && (
        <form className="inline-form panel" onSubmit={create}>
          <div><label>Name</label><input name="name" required /></div>
          <div><label>Phone</label><input name="phone" placeholder="+18095550100" required /></div>
          <div><label>Consent</label><select name="consent_status"><option value="unknown">Unknown</option><option value="opted_in">Opted in</option><option value="opted_out">Opted out</option></select></div>
          <div><label>Tags</label><input name="tags" placeholder="vip, transport" /></div>
          <Button type="submit">Save contact</Button>
        </form>
      )}
      <section className="panel data-panel">
        <div className="panel-head"><div><h3>Contacts</h3><p>{result.total} tenant-scoped records</p></div></div>
        <div className="data-table">
          <div className="table-row table-head"><span>Contact</span><span>Phone</span><span>Consent</span><span>Tags</span><span>Updated</span></div>
          {result.items.map((contact) => (
            <div className="table-row" key={contact.contact_id}>
              <span className="contact-cell"><div className="avatar small">{initials(contact.name)}</div><strong>{contact.name}</strong></span>
              <span>{contact.phone}</span>
              <span><StatusPill value={contact.suppressed ? "suppressed" : contact.consent_status} /></span>
              <span>{contact.tags?.join(", ") || "—"}</span>
              <span>{formatTime(contact.updated_at)}</span>
            </div>
          ))}
        </div>
        {!result.items.length && <EmptyState icon={ContactRound} title="No contacts yet" body="Add a consent-aware contact to begin controlled outbound messaging." />}
      </section>
    </div>
  );
}

function TemplatesPage() {
  const [result, setResult] = useState({ items: [], total: 0 });
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const load = useCallback(() => api.templates({ limit: 100 }).then((d) => { setResult(d); setError(null); }).catch(setError), []);
  useEffect(() => { load(); }, [load]);

  async function create(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.createTemplate({
        name: form.get("name"),
        language: form.get("language"),
        category: form.get("category"),
        status: "draft",
        body: form.get("body"),
        variables: []
      });
      setShowForm(false);
      load();
    } catch (e) { setError(e); }
  }

  return (
    <div className="page-stack">
      <div className="toolbar"><div><h3>Message templates</h3><p className="muted">Local business templates. Provider approval remains a separate controlled step.</p></div><Button onClick={() => setShowForm(!showForm)}><Plus size={16} /> New template</Button></div>
      <ErrorBanner error={error} />
      {showForm && (
        <form className="template-form panel" onSubmit={create}>
          <div className="form-grid"><div><label>Name</label><input name="name" required /></div><div><label>Language</label><input name="language" defaultValue="en" required /></div><div><label>Category</label><select name="category"><option>utility</option><option>marketing</option><option>authentication</option></select></div></div>
          <div><label>Body</label><textarea name="body" rows="4" required placeholder="Hello, your appointment is confirmed." /></div>
          <Button type="submit">Save draft</Button>
        </form>
      )}
      <div className="card-grid">
        {result.items.map((item) => (
          <article className="template-card panel" key={item.template_id}>
            <div className="template-card-head"><div className="metric-icon blue"><BookOpenText size={17} /></div><StatusPill value={item.status} /></div>
            <h3>{item.name}</h3>
            <p>{item.body}</p>
            <div className="template-meta"><span>{item.language}</span><span>{item.category}</span><span>v{item.version}</span></div>
          </article>
        ))}
      </div>
      {!result.items.length && <EmptyState icon={BookOpenText} title="No templates yet" body="Create a draft template for campaign and agent workflows." />}
    </div>
  );
}

function CampaignsPage() {
  const [campaigns, setCampaigns] = useState({ items: [], total: 0 });
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const [campaignData, templateData] = await Promise.all([api.campaigns({ limit: 100 }), api.templates({ limit: 100 })]);
      setCampaigns(campaignData);
      setTemplates(templateData.items || []);
      setError(null);
    } catch (e) { setError(e); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.createCampaign({
        name: form.get("name"),
        template_id: form.get("template_id"),
        audience_count: Number(form.get("audience_count")),
        bulk_approved: form.get("bulk_approved") === "on",
        status: "draft"
      });
      setShowForm(false);
      load();
    } catch (e) { setError(e); }
  }

  return (
    <div className="page-stack">
      <div className="toolbar"><div><h3>Campaign workspace</h3><p className="muted">Draft and validate business campaigns before any Middleware effect is allowed.</p></div><Button onClick={() => setShowForm(!showForm)} disabled={!templates.length}><Plus size={16} /> New campaign</Button></div>
      <ErrorBanner error={error} />
      {showForm && (
        <form className="inline-form panel" onSubmit={create}>
          <div><label>Name</label><input name="name" required /></div>
          <div><label>Template</label><select name="template_id" required>{templates.map((t) => <option key={t.template_id} value={t.template_id}>{t.name}</option>)}</select></div>
          <div><label>Audience count</label><input name="audience_count" type="number" min="1" defaultValue="1" required /></div>
          <label className="checkbox"><input name="bulk_approved" type="checkbox" /> Bulk approved</label>
          <Button type="submit">Save draft</Button>
        </form>
      )}
      <section className="panel data-panel">
        <div className="data-table">
          <div className="table-row table-head"><span>Campaign</span><span>Status</span><span>Audience</span><span>Validation</span><span>Updated</span></div>
          {campaigns.items.map((campaign) => (
            <div className="table-row" key={campaign.campaign_id}>
              <span><strong>{campaign.name}</strong><small>{campaign.campaign_id}</small></span>
              <span><StatusPill value={campaign.status} /></span>
              <span>{campaign.audience_count}</span>
              <span className={campaign.validation?.valid ? "good" : "warn"}>{campaign.validation?.valid ? "Ready" : (campaign.validation?.errors || []).join(", ")}</span>
              <span>{formatTime(campaign.updated_at)}</span>
            </div>
          ))}
        </div>
        {!campaigns.items.length && <EmptyState icon={Megaphone} title="No campaigns yet" body={templates.length ? "Create a campaign draft using one of your templates." : "Create a template first, then build a campaign."} />}
      </section>
    </div>
  );
}

function SettingsPage({ identity, profile, dashboard }) {
  return (
    <div className="settings-grid">
      <section className="panel settings-card">
        <div className="panel-head"><div><h3>API connection</h3><p>Frontend-to-business API boundary.</p></div><ShieldCheck size={18} /></div>
        <dl>
          <div><dt>API base</dt><dd>{baseUrl || "Not configured"}</dd></div>
          <div><dt>Authentication</dt><dd>{isDevBypass() ? "Development bypass" : "Keycloak PKCE"}</dd></div>
          <div><dt>Tenant</dt><dd>{profile?.tenant_id || identity.tenantId || "—"}</dd></div>
          <div><dt>Safe mode</dt><dd>{dashboard?.safe_mode ? "Enabled" : "Disabled"}</dd></div>
        </dl>
      </section>
      <section className="panel settings-card">
        <div className="panel-head"><div><h3>Operator access</h3><p>Roles returned by the WhatsApp API.</p></div><CircleUserRound size={18} /></div>
        <div className="role-list">{(profile?.roles || identity.roles || []).map((role) => <span key={role}>{role}</span>)}</div>
      </section>
      <section className="panel settings-card">
        <div className="panel-head"><div><h3>Architecture</h3><p>Provider effects stay behind Middleware V3.</p></div><Sparkles size={18} /></div>
        <div className="architecture-flow">
          <span>Frontend</span><ChevronRight size={15} /><span>WhatsApp API</span><ChevronRight size={15} /><span>Middleware V3</span><ChevronRight size={15} /><span>Evolution</span>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [page, setPage] = useState("overview");
  const [profile, setProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const identity = sessionIdentity();

  useEffect(() => {
    completeLoginFromRedirect().catch(setAuthError).finally(() => setBooting(false));
  }, []);

  const refresh = useCallback(async () => {
    if (!sessionIdentity().authenticated) return;
    setRefreshing(true);
    try {
      const [me, dash, inbox] = await Promise.allSettled([
        api.me(),
        api.dashboard(),
        api.conversations({ limit: 100 })
      ]);

      if (me.status === "fulfilled") setProfile(me.value);
      if (dash.status === "fulfilled") setDashboard(dash.value);
      if (inbox.status === "fulfilled") setConversations(inbox.value.items || []);

      const rejected = [me, dash, inbox].filter((result) => result.status === "rejected");
      const hardFailure = rejected.find((result) => result.reason?.status !== 404);
      setError(hardFailure?.reason || null);
    } catch (e) {
      setError(e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!booting && sessionIdentity().authenticated) refresh();
  }, [booting, refresh]);

  if (booting) return <main className="boot-screen"><div className="brand-mark large"><MessageCircleMore size={27} /></div><LoadingBlock /></main>;
  if (!sessionIdentity().authenticated) return <LoginScreen error={authError} />;

  const title = NAV.find(([id]) => id === page)?.[1] || "WhatsApp";

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} identity={profile ? { ...identity, subject: profile.subject, tenantId: profile.tenant_id, roles: profile.roles } : identity} />
      <div className="main-shell">
        <Topbar title={title} identity={profile ? { ...identity, subject: profile.subject, roles: profile.roles } : identity} onRefresh={refresh} refreshing={refreshing} safeMode={dashboard?.safe_mode} unreadCount={(conversations || []).reduce((sum, item) => sum + Number(item.unread_count || 0), 0)} />
        <main className="content">
          <ErrorBanner error={error} onRetry={refresh} />
          {page === "overview" && <OverviewPage dashboard={dashboard} conversations={conversations} safeMode={dashboard?.safe_mode} onOpenInbox={() => setPage("inbox")} />}
          {page === "inbox" && <InboxPage conversations={conversations} refreshConversations={refresh} safeMode={dashboard?.safe_mode} />}
          {page === "contacts" && <ContactsPage />}
          {page === "templates" && <TemplatesPage />}
          {page === "campaigns" && <CampaignsPage />}
          {page === "diagnostics" && <DiagnosticsPage />}
          {page === "settings" && <SettingsPage identity={identity} profile={profile} dashboard={dashboard} />}
        </main>
      </div>
    </div>
  );
}
