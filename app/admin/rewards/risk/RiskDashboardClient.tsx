"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, ChevronLeft, ChevronRight, Eye, Flag, Save, Search, Settings2, ShieldAlert, ShieldCheck, Users, WalletCards, X } from "lucide-react";
import { useToast } from "@/components/admin/Toast";

interface RiskUser { _id: string; name: string; email: string; rewardDebt?: number }
interface RiskOrder { _id: string; orderId: string; total: number; status: string; paymentStatus: string }
interface RiskEvent {
  _id: string; userId: RiskUser; orderId?: RiskOrder; eventType: string; severity: string; score: number; status: string;
  reasons: string[]; relatedAmount: number; detectedAt: string; lastDetectedAt: string; occurrenceCount: number;
  reviewDecision?: string; reviewNote?: string; reviewedAt?: string; reviewedBy?: { name?: string; email?: string };
}
interface Analytics {
  openEvents: number; criticalAlerts: number; highCriticalEvents: number; highRiskUsers: number; damruAssociatedWithRisk: number;
  reversedDamruAssociatedWithRisk: number; rewardDebtAtRisk: number; refundAbuseAlerts: number; referralAlerts: number; campaignAlerts: number;
}
interface QueueResponse { events: RiskEvent[]; total: number; page: number; totalPages: number; analytics: Analytics }
interface TimelineRow { kind: string; at: string; title: string; detail: string }
interface DetailResponse { event: RiskEvent; summary: { score: number; severity: string; openAlerts: number; rewardDebt: number; reversalCount: number; refundRatio: number }; timeline: TimelineRow[] }
type RiskConfig = Record<string, Record<string, number>>;

const emptyAnalytics: Analytics = { openEvents: 0, criticalAlerts: 0, highCriticalEvents: 0, highRiskUsers: 0, damruAssociatedWithRisk: 0, reversedDamruAssociatedWithRisk: 0, rewardDebtAtRisk: 0, refundAbuseAlerts: 0, referralAlerts: 0, campaignAlerts: 0 };
const eventLabels: Record<string, string> = {
  REWARD_EARNING_VELOCITY: "Reward velocity", REDEMPTION_VELOCITY: "Rapid redemption", REFUND_ABUSE: "Refund abuse",
  EARN_REDEEM_REFUND_ABUSE: "Earn / redeem / refund", CANCELLATION_ABUSE: "Cancellation abuse", REWARD_REVERSAL_FREQUENCY: "Reward reversals", REWARD_DEBT: "Reward debt", REFERRAL_FARMING: "Referral farming",
  CAMPAIGN_ABUSE: "Campaign abuse", ADMIN_ADJUSTMENT: "Admin adjustments",
  MISSION_VELOCITY: "Mission velocity",
};
const actionLabels: Record<string, string> = { UNDER_REVIEW: "Start review", MONITOR: "Continue monitoring", RESOLVE_LEGITIMATE: "Mark legitimate", RESOLVE_ABUSE: "Confirm abuse", RESOLVE_NO_ACTION: "Resolve — no action", DISMISS: "Dismiss alert" };
const formatDate = (value: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

const thresholdGroups = [
  { title: "Score bands", section: "scoring", fields: [["medium", "Medium begins"], ["high", "High begins"], ["critical", "Critical begins"]] },
  { title: "Earning velocity", section: "earningVelocity", fields: [["windowHours", "Window (hours)"], ["minimumTotalDamru", "Damru threshold"], ["minimumTransactionCount", "Transaction count"], ["promotionalDamru", "Promotional Damru"]] },
  { title: "Redemption velocity", section: "redemptionVelocity", fields: [["windowHours", "Window (hours)"], ["minimumTotalDamru", "Damru threshold"], ["minimumTransactionCount", "Transaction count"], ["recentPromotionalWindowHours", "Recent promotion window"]] },
  { title: "Refund abuse", section: "refunds", fields: [["windowDays", "Window (days)"], ["minimumOrderCount", "Minimum orders"], ["ratio", "Refund ratio (0–1)"], ["minimumRefundedAmount", "Refunded value"]] },
  { title: "Earn / redeem / refund", section: "earnRedeemRefund", fields: [["windowDays", "Window (days)"], ["minimumRefundCount", "Refund count"], ["minimumReversalCount", "Reversal count"], ["minimumRedemptionAmount", "Redeemed Damru"]] },
  { title: "Cancellation abuse", section: "cancellations", fields: [["windowDays", "Window (days)"], ["minimumOrderCount", "Minimum orders"], ["ratio", "Cancellation ratio (0–1)"]] },
  { title: "Reversal frequency", section: "reversals", fields: [["windowDays", "Window (days)"], ["minimumCount", "Reversal count"], ["minimumAmount", "Reversed Damru"], ["minimumIssuedAmount", "Minimum issued"], ["issuedRatio", "Issued ratio (0–1)"]] },
  { title: "Reward debt", section: "rewardDebt", fields: [["amount", "Debt threshold"], ["reversalCount30Days", "30-day reversals"]] },
  { title: "Referral farming", section: "referrals", fields: [["windowDays", "Window (days)"], ["createdCount", "Created referrals"], ["qualifiedCount", "Qualified referrals"]] },
  { title: "Campaign abuse", section: "campaigns", fields: [["windowHours", "Window (hours)"], ["usageCount", "Usage count"], ["rewardAmount", "Reward amount"], ["reversalCount", "Reversal count"]] },
  { title: "Mission velocity", section: "missions", fields: [["windowHours", "Window (hours)"], ["completionCount", "Completion count"], ["rewardAmount", "Reward amount"]] },
  { title: "Admin adjustments", section: "adminAdjustments", fields: [["windowHours", "Window (hours)"], ["perUserCount", "Per-user count"], ["perUserAmount", "Per-user Damru"], ["perAdminCount", "Per-admin count"]] },
] as const;

export default function RiskDashboardClient({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [events, setEvents] = useState<RiskEvent[]>([]);
  const [analytics, setAnalytics] = useState(emptyAnalytics);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [eventType, setEventType] = useState("");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewAction, setReviewAction] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<RiskConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search.trim()) params.set("search", search.trim());
    if (severity) params.set("severity", severity);
    if (status) params.set("status", status);
    if (eventType) params.set("eventType", eventType);
    if (minScore) params.set("minScore", minScore);
    if (maxScore) params.set("maxScore", maxScore);
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    return params.toString();
  }, [page, search, severity, status, eventType, minScore, maxScore, start, end]);

  const loadQueue = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/rewards/risk?${query}`, { cache: "no-store" });
      const data = await response.json() as QueueResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to load risk alerts.");
      setEvents(data.events || []); setAnalytics(data.analytics || emptyAnalytics); setTotalPages(data.totalPages || 1);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load risk alerts."); }
    finally { setLoading(false); }
  }, [query]);

  useEffect(() => { const timer = window.setTimeout(() => void loadQueue(), 0); return () => window.clearTimeout(timer); }, [loadQueue]);

  async function openDetail(id: string) {
    setDetailLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/rewards/risk/${id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load risk details.");
      setDetail(data); setReviewAction(""); setReviewNote("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load risk details."); }
    finally { setDetailLoading(false); }
  }

  async function submitReview() {
    const noteOptional = ["UNDER_REVIEW", "MONITOR"].includes(reviewAction);
    if (!detail || !reviewAction || (!noteOptional && reviewNote.trim().length < 5)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/admin/rewards/risk/${detail.event._id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: reviewAction, note: reviewNote.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save the review decision.");
      toast.success(reviewAction === "RESOLVE_LEGITIMATE" ? "Risk event marked as legitimate" : reviewAction === "RESOLVE_ABUSE" ? "Abuse decision recorded" : "Review status updated");
      setDetail(null); await loadQueue();
    } catch (caught) { const message = caught instanceof Error ? caught.message : "Unable to save the review decision."; setError(message); toast.error("Unable to update risk event", message); }
    finally { setSaving(false); }
  }

  async function openConfig() {
    setShowConfig(true);
    if (config) return;
    setConfigLoading(true);
    try {
      const response = await fetch("/api/admin/rewards/risk/config", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load risk thresholds.");
      setConfig(data.config);
    } catch (caught) { toast.error("Unable to load risk thresholds", caught instanceof Error ? caught.message : undefined); }
    finally { setConfigLoading(false); }
  }

  function updateThreshold(section: string, field: string, raw: string) {
    setConfig(current => current ? { ...current, [section]: { ...current[section], [field]: Number(raw) } } : current);
  }

  async function saveConfig() {
    if (!config) return;
    setConfigSaving(true);
    try {
      const response = await fetch("/api/admin/rewards/risk/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update risk thresholds.");
      setConfig(data.config); toast.success("Risk thresholds updated");
    } catch (caught) { toast.error("Unable to update risk thresholds", caught instanceof Error ? caught.message : undefined); }
    finally { setConfigSaving(false); }
  }

  const cards = [
    { label: "Open alerts", value: analytics.openEvents, icon: ShieldAlert, tone: "orange" },
    { label: "Critical alerts", value: analytics.criticalAlerts, icon: AlertTriangle, tone: "red" },
    { label: "High-risk users", value: analytics.highRiskUsers, icon: Users, tone: "purple" },
    { label: "Reward debt at risk", value: `${analytics.rewardDebtAtRisk.toLocaleString("en-IN")} D`, icon: WalletCards, tone: "gold" },
    { label: "Refund abuse", value: analytics.refundAbuseAlerts, icon: Flag, tone: "blue" },
    { label: "Referral alerts", value: analytics.referralAlerts, icon: Users, tone: "purple" },
    { label: "Campaign alerts", value: analytics.campaignAlerts, icon: Flag, tone: "orange" },
  ];

  return <main className="risk-page">
    <section className="risk-hero"><div><span className="risk-eyebrow"><ShieldCheck size={15} /> Financial monitoring</span><h1>Rewards Risk & Abuse</h1><p>Deterministic signals for admin review. Alerts never ban customers or change balances automatically.</p>{canEdit && <button className="risk-config-open" onClick={() => void openConfig()}><Settings2 size={16} /> Risk thresholds</button>}</div><div className="risk-hero-score"><b>{analytics.highCriticalEvents}</b><span>high-priority reviews</span></div></section>
    <section className="risk-kpis">{cards.map(({ label, value, icon: Icon, tone }) => <article key={label} className={`risk-kpi ${tone}`}><span><Icon size={18} /></span><div><p>{label}</p><strong>{value}</strong></div></article>)}</section>
    <section className="risk-panel">
      <div className="risk-toolbar"><label className="risk-search"><Search size={17} /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search customer, email or order" /></label>
        <select value={severity} onChange={event => { setSeverity(event.target.value); setPage(1); }}><option value="">All severity</option>{["LOW","MEDIUM","HIGH","CRITICAL"].map(value => <option key={value}>{value}</option>)}</select>
        <select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All status</option>{["OPEN","UNDER_REVIEW","RESOLVED","DISMISSED"].map(value => <option key={value}>{value}</option>)}</select>
        <select value={eventType} onChange={event => { setEventType(event.target.value); setPage(1); }}><option value="">All event types</option>{Object.entries(eventLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
        <input type="number" min="0" max="100" value={minScore} onChange={event => { setMinScore(event.target.value); setPage(1); }} placeholder="Min score" aria-label="Minimum risk score" />
        <input type="number" min="0" max="100" value={maxScore} onChange={event => { setMaxScore(event.target.value); setPage(1); }} placeholder="Max score" aria-label="Maximum risk score" />
        <input type="date" value={start} onChange={event => { setStart(event.target.value); setPage(1); }} aria-label="Detected from date" />
        <input type="date" value={end} onChange={event => { setEnd(event.target.value); setPage(1); }} aria-label="Detected through date" />
      </div>
      {error && <div className="risk-error"><AlertTriangle size={17} />{error}</div>}
      <div className="risk-table-wrap"><table className="risk-table"><thead><tr><th>User</th><th>Risk</th><th>Main reason</th><th>Amount</th><th>Event</th><th>Detected</th><th>Status</th><th>Action</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={8} className="risk-empty">Loading risk queue…</td></tr> : events.length === 0 ? <tr><td colSpan={8} className="risk-empty"><BadgeCheck size={30} /><b>No alerts match these filters</b><span>Normal activity continues without interruption.</span></td></tr> : events.map(event => <tr key={event._id}>
          <td><div className="risk-user"><span>{event.userId?.name?.slice(0,1).toUpperCase() || "?"}</span><div><b>{event.userId?.name || "Unknown user"}</b><small>{event.userId?.email || ""}</small></div></div></td>
          <td><span className={`risk-severity ${event.severity.toLowerCase()}`}>{event.severity}</span><small className="risk-score">{event.score}/100</small></td>
          <td className="risk-reason">{event.reasons?.[0] || "Review required"}</td><td>{event.relatedAmount ? `${event.relatedAmount.toLocaleString("en-IN")} D` : "—"}</td>
          <td>{eventLabels[event.eventType] || event.eventType}</td><td>{formatDate(event.detectedAt)}</td><td><span className={`risk-status ${event.status.toLowerCase()}`}>{event.status.replaceAll("_", " ")}</span></td>
          <td><button className="risk-view" onClick={() => void openDetail(event._id)} disabled={detailLoading}><Eye size={16} /> Review</button></td>
        </tr>)}</tbody></table></div>
      <footer className="risk-pagination"><span>Page {page} of {totalPages}</span><div><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={17} /></button><button disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}><ChevronRight size={17} /></button></div></footer>
    </section>
    {detail && <div className="risk-overlay" role="dialog" aria-modal="true" aria-label="Risk event review"><section className="risk-drawer">
      <header><div><span className={`risk-severity ${detail.event.severity.toLowerCase()}`}>{detail.event.severity}</span><h2>{eventLabels[detail.event.eventType] || detail.event.eventType}</h2><p>{detail.event.userId.name} · score {detail.event.score}/100</p></div><button aria-label="Close" onClick={() => setDetail(null)}><X /></button></header>
      <div className="risk-drawer-body"><div className="risk-summary-grid"><article><span>Open alerts</span><b>{detail.summary.openAlerts}</b></article><article><span>Reward debt</span><b>{detail.summary.rewardDebt} D</b></article><article><span>Reversals</span><b>{detail.summary.reversalCount}</b></article><article><span>Refund ratio</span><b>{Math.round(detail.summary.refundRatio * 100)}%</b></article></div>
        <section className="risk-detail-section"><h3>Why this was flagged</h3><ul>{detail.event.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></section>
        <section className="risk-detail-section"><h3>Financial timeline</h3><div className="risk-timeline">{detail.timeline.slice(0,12).map((row,index) => <div key={`${row.kind}-${row.at}-${index}`}><i /><span><b>{row.title}</b><small>{row.kind} · {formatDate(row.at)} · {row.detail}</small></span></div>)}</div></section>
        {canEdit && !["RESOLVED","DISMISSED"].includes(detail.event.status) && <section className="risk-review"><h3>Admin review</h3><select value={reviewAction} onChange={event => setReviewAction(event.target.value)}><option value="">Choose a decision</option>{Object.entries(actionLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><textarea value={reviewNote} maxLength={1000} onChange={event => setReviewNote(event.target.value)} placeholder="Document the evidence and decision. Required when closing an alert." /><button onClick={() => void submitReview()} disabled={saving || !reviewAction || (!["UNDER_REVIEW","MONITOR"].includes(reviewAction) && reviewNote.trim().length < 5)}>{saving ? "Saving review…" : "Save review decision"}</button><p>No financial action or account restriction is performed here.</p></section>}
        {detail.event.reviewNote && <section className="risk-detail-section"><h3>Review record</h3><p><b>{detail.event.reviewDecision?.replaceAll("_", " ")}</b>{detail.event.reviewedBy?.name ? ` · ${detail.event.reviewedBy.name}` : ""}{detail.event.reviewedAt ? ` · ${formatDate(detail.event.reviewedAt)}` : ""}</p><p>{detail.event.reviewNote}</p></section>}
      </div>
    </section></div>}
    {showConfig && <div className="risk-overlay" role="dialog" aria-modal="true" aria-label="Risk threshold configuration"><section className="risk-config-drawer"><header><div><span className="risk-eyebrow"><Settings2 size={14} /> Authorized configuration</span><h2>Risk thresholds</h2><p>Changes affect future evaluations only and are recorded in the admin audit log.</p></div><button aria-label="Close" onClick={() => setShowConfig(false)}><X /></button></header><div className="risk-config-body">{configLoading ? <div className="risk-empty">Loading thresholds…</div> : config ? thresholdGroups.map(group => <fieldset key={group.section}><legend>{group.title}</legend><div>{group.fields.map(([field,label]) => <label key={field}><span>{label}</span><input type="number" min="0" step={field === "ratio" || field === "issuedRatio" ? "0.01" : "1"} value={config[group.section]?.[field] ?? ""} onChange={event => updateThreshold(group.section, field, event.target.value)} /></label>)}</div></fieldset>) : <div className="risk-error"><AlertTriangle size={17} /> Thresholds could not be loaded.</div>}</div>{canEdit && config && <footer><button onClick={() => void saveConfig()} disabled={configSaving}><Save size={16} />{configSaving ? "Saving…" : "Save thresholds"}</button></footer>}</section></div>}
  </main>;
}
