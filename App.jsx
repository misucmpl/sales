/**
 * UCMPL Sales Dashboard — Full App
 * 
 * SETUP:
 * 1. Set APPS_SCRIPT_URL to your deployed Google Apps Script Web App URL
 * 2. Set ADMIN_PASSWORD to whatever you want (share only with data-entry users)
 * 3. VIEW_PASSWORD is optional — remove the login screen entirely if you want public view
 * 
 * Deploy to Vercel/Netlify as a React app (Vite or CRA)
 */

import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";

// ─────────────────────────────────────────────────────────────
// ★ CONFIGURE THESE THREE VALUES BEFORE DEPLOYING
// ─────────────────────────────────────────────────────────────
const APPS_SCRIPT_URL = "https://script.google.com/a/macros/ucmpl.com/s/AKfycbwFlDjuIrUUFDs_cx57CNtHYrPED5mQ9WJ5NtzLxPt4_vE7Eb6Roqp7J0jOQrom6mv8/exec";
const ADMIN_PASSWORD  = "ucm@admin";   // data entry users
const VIEW_PASSWORD   = "ucm@view";    // view-only users (set "" to skip login)
// ─────────────────────────────────────────────────────────────

const SEGMENTS = [
  { id: "caps",      name: "Caps & Closures",  color: "#E8533A", light: "#FDF1EF" },
  { id: "bottles",   name: "Bottles",           color: "#2E86AB", light: "#EAF4F9" },
  { id: "furniture", name: "Furniture",         color: "#7B5EA7", light: "#F3EEFA" },
  { id: "material",  name: "Material Handling", color: "#F0A500", light: "#FEF7E6" },
  { id: "eco",       name: "Eco Base",          color: "#3DAA6E", light: "#EAF7EF" },
  { id: "flc",       name: "FLC Boxes",         color: "#D45D8A", light: "#FCEEF4" },
  { id: "road",      name: "Road Safety",       color: "#546E7A", light: "#EDF2F4" },
];

const SALESPEOPLE = [
  { id: "rk", name: "Rajesh Kumar",  initials: "RK" },
  { id: "pm", name: "Priya Mehra",   initials: "PM" },
  { id: "as", name: "Amit Sharma",   initials: "AS" },
  { id: "nd", name: "Neha Dubey",    initials: "ND" },
  { id: "vt", name: "Vikram Tiwari", initials: "VT" },
];

const today      = new Date();
const DAY        = today.getDate();
const DAYS_MONTH = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
const MONTH_KEY  = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
const PREV_KEY   = (() => { const d = new Date(today.getFullYear(), today.getMonth() - 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
const MONTH_NAME = today.toLocaleString("default", { month: "long" });
const PREV_MONTH = new Date(today.getFullYear(), today.getMonth() - 1, 1).toLocaleString("default", { month: "long" });
const TODAY_KEY  = today.toISOString().slice(0, 10);

// ── API helpers ──────────────────────────────────────────────
async function apiGet(tab) {
  const res = await fetch(`${APPS_SCRIPT_URL}?tab=${tab}`);
  const json = await res.json();
  return json.data || [];
}
async function apiPost(body) {
  await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Formatters ───────────────────────────────────────────────
const fmt  = v => `₹${parseFloat(v || 0).toFixed(2)}L`;
const pct  = (a, t) => (!t ? 0 : Math.round((a / t) * 100));
const delt = (c, p) => (!p ? 0 : Math.round(((c - p) / p) * 100));

// ── Tiny UI primitives ───────────────────────────────────────
function Card({ children, style = {} }) {
  return <div style={{ background: "#fff", border: "1px solid #E5E9EF", borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.04)", ...style }}>{children}</div>;
}
function GaugeBar({ value, max, color, h = 8 }) {
  const p = Math.min((value / Math.max(max, 0.01)) * 100, 100);
  return (
    <div style={{ background: "#E5E9EF", borderRadius: 99, height: h, overflow: "hidden", width: "100%" }}>
      <div style={{ width: `${p}%`, height: "100%", background: color, borderRadius: 99, transition: "width .7s ease" }} />
    </div>
  );
}
function Badge({ children, color = "#546E7A", bg = "#F0F4F8" }) {
  return <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>{children}</span>;
}
function DeltaChip({ value }) {
  const up = value >= 0;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 2, background: up ? "#EAF7EF" : "#FDEAEA", color: up ? "#2E7D52" : "#C0392B", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 99 }}>{up ? "▲" : "▼"} {Math.abs(value)}%</span>;
}
function SectionTitle({ children, sub }) {
  return <div style={{ marginBottom: 16 }}><div style={{ fontWeight: 800, fontSize: 17, color: "#1A2332" }}>{children}</div>{sub && <div style={{ fontSize: 12, color: "#8A97A8", marginTop: 2 }}>{sub}</div>}</div>;
}
function Input({ label, value, onChange, type = "text", placeholder, prefix, suffix, segColor }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#546E7A", marginBottom: 5 }}>{label}</label>}
      <div style={{ position: "relative" }}>
        {prefix && <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#8A97A8" }}>{prefix}</span>}
        <input
          type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ width: "100%", border: `1.5px solid ${focused ? (segColor || "#2E86AB") : "#E5E9EF"}`, borderRadius: 10, padding: `9px ${suffix ? "36px" : "12px"} 9px ${prefix ? "28px" : "12px"}`, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit", transition: "border-color .15s" }}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        />
        {suffix && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#8A97A8" }}>{suffix}</span>}
      </div>
    </div>
  );
}
function Btn({ children, onClick, variant = "primary", disabled, style = {} }) {
  const styles = {
    primary:   { background: "#1A2332", color: "#fff", border: "none" },
    secondary: { background: "#fff", color: "#1A2332", border: "1.5px solid #E5E9EF" },
    danger:    { background: "#FDEAEA", color: "#C0392B", border: "none" },
    success:   { background: "#EAF7EF", color: "#2E7D52", border: "none" },
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...styles, padding: "10px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, fontFamily: "inherit", ...style }}>
      {children}
    </button>
  );
}

// ── Chart tooltip ─────────────────────────────────────────────
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1A2332", color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.18)" }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Day {label}</div>
      {payload.map((p, i) => p.value !== null && (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
          <span style={{ color: "#8CA9C5" }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>₹{Number(p.value).toFixed(2)}L</span>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ═════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [pw, setPw]     = useState("");
  const [error, setErr] = useState("");
  const [loading, setL] = useState(false);

  function attempt() {
    setL(true); setErr("");
    setTimeout(() => {
      if (pw === ADMIN_PASSWORD)     { onLogin("admin");   return; }
      if (!VIEW_PASSWORD || pw === VIEW_PASSWORD) { onLogin("viewer"); return; }
      setErr("Incorrect password. Try again."); setL(false);
    }, 400);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F4F7FA", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "40px 36px", width: 380, boxShadow: "0 8px 40px rgba(0,0,0,0.10)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "#1A2332", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 15 }}>UC</span>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>UCMPL Sales</div>
            <div style={{ fontSize: 12, color: "#8A97A8" }}>Enter your password to continue</div>
          </div>
        </div>
        <Input label="Password" type="password" value={pw} onChange={setPw} placeholder="Enter password" />
        {error && <div style={{ color: "#C0392B", fontSize: 12, marginTop: -8, marginBottom: 12 }}>{error}</div>}
        <Btn onClick={attempt} disabled={loading || !pw} style={{ width: "100%", padding: "12px 0", fontSize: 14 }}>
          {loading ? "Checking…" : "Sign In →"}
        </Btn>
        <div style={{ marginTop: 20, padding: "14px", background: "#F7F9FC", borderRadius: 10, fontSize: 12, color: "#8A97A8" }}>
          <div style={{ fontWeight: 700, color: "#546E7A", marginBottom: 4 }}>Access Levels</div>
          <div>🔵 <b>Admin:</b> Can enter & edit all data</div>
          <div style={{ marginTop: 4 }}>👁 <b>Viewer:</b> Read-only dashboard access</div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// DATA ENTRY PANEL (Admin only)
// ═════════════════════════════════════════════════════════════
function DataEntryPanel({ onSaved }) {
  const [activeForm, setActiveForm] = useState("daily");
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState("");

  // Daily sales form
  const [dailyDate, setDailyDate]   = useState(TODAY_KEY);
  const [dailyVals, setDailyVals]   = useState(() => Object.fromEntries(SEGMENTS.map(s => [s.id, ""])));
  const [enteredBy, setEnteredBy]   = useState("");

  // Monthly targets form
  const [tgtMonth, setTgtMonth]     = useState(MONTH_KEY);
  const [tgtVals, setTgtVals]       = useState(() => Object.fromEntries(SEGMENTS.map(s => [s.id, ""])));

  // Last month actuals form
  const [lmaMonth, setLmaMonth]     = useState(PREV_KEY);
  const [lmaVals, setLmaVals]       = useState(() => Object.fromEntries(SEGMENTS.map(s => [s.id, ""])));

  // Salesperson targets form
  const [spMonth, setSpMonth]       = useState(MONTH_KEY);
  const [spPerson, setSpPerson]     = useState(SALESPEOPLE[0].id);
  const [spVals, setSpVals]         = useState(() => Object.fromEntries(SEGMENTS.map(s => [s.id, { target: "", actual: "" }])));

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  async function saveDailySales() {
    setSaving(true);
    for (const seg of SEGMENTS) {
      if (!dailyVals[seg.id]) continue;
      await apiPost({ tab: "daily_sales", action: "append", row: [dailyDate, seg.id, parseFloat(dailyVals[seg.id]), enteredBy || "Admin"] });
    }
    setSaving(false); showToast("✓ Daily sales saved!"); onSaved();
    setDailyVals(Object.fromEntries(SEGMENTS.map(s => [s.id, ""])));
  }

  async function saveTargets() {
    setSaving(true);
    for (const seg of SEGMENTS) {
      if (!tgtVals[seg.id]) continue;
      await apiPost({ tab: "targets", action: "upsert", keyCol: "month_segment", keyVal: `${tgtMonth}_${seg.id}`, row: [tgtMonth, seg.id, parseFloat(tgtVals[seg.id]), `${tgtMonth}_${seg.id}`] });
    }
    setSaving(false); showToast("✓ Targets saved!"); onSaved();
  }

  async function saveLastMonthActuals() {
    setSaving(true);
    for (const seg of SEGMENTS) {
      if (!lmaVals[seg.id]) continue;
      await apiPost({ tab: "last_month_actuals", action: "upsert", keyCol: "month_segment", keyVal: `${lmaMonth}_${seg.id}`, row: [lmaMonth, seg.id, parseFloat(lmaVals[seg.id]), `${lmaMonth}_${seg.id}`] });
    }
    setSaving(false); showToast("✓ Last month actuals saved!"); onSaved();
  }

  async function saveSalespersonData() {
    setSaving(true);
    for (const seg of SEGMENTS) {
      const d = spVals[seg.id];
      if (!d.target && !d.actual) continue;
      const sp = SALESPEOPLE.find(p => p.id === spPerson);
      await apiPost({ tab: "salespeople_targets", action: "upsert", keyCol: "month_sp_segment", keyVal: `${spMonth}_${spPerson}_${seg.id}`, row: [spMonth, sp.name, seg.id, parseFloat(d.target) || 0, parseFloat(d.actual) || 0, `${spMonth}_${spPerson}_${seg.id}`] });
    }
    setSaving(false); showToast("✓ Salesperson data saved!"); onSaved();
  }

  const forms = [
    { id: "daily",   label: "📅 Daily Sales" },
    { id: "targets", label: "🎯 Monthly Targets" },
    { id: "lma",     label: "📋 Last Month Actuals" },
    { id: "sp",      label: "👤 Salesperson Data" },
  ];

  return (
    <div style={{ position: "relative" }}>
      {toast && (
        <div style={{ position: "fixed", bottom: 28, right: 28, background: "#1A2332", color: "#fff", padding: "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: 14, zIndex: 999, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          {toast}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {forms.map(f => (
          <button key={f.id} onClick={() => setActiveForm(f.id)} style={{ padding: "9px 18px", borderRadius: 10, border: activeForm === f.id ? "none" : "1.5px solid #E5E9EF", background: activeForm === f.id ? "#1A2332" : "#fff", color: activeForm === f.id ? "#fff" : "#546E7A", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Daily Sales */}
      {activeForm === "daily" && (
        <Card style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Enter Daily Sales</div>
          <div style={{ fontSize: 13, color: "#8A97A8", marginBottom: 20 }}>Enter actual sales for each segment for a given date (₹ Lakhs).</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
            <Input label="Date" type="date" value={dailyDate} onChange={setDailyDate} />
            <Input label="Entered By" value={enteredBy} onChange={setEnteredBy} placeholder="Your name" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {SEGMENTS.map(seg => (
              <div key={seg.id} style={{ background: seg.light, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1A2332" }}>{seg.name}</span>
                </div>
                <Input value={dailyVals[seg.id]} onChange={v => setDailyVals(x => ({ ...x, [seg.id]: v }))} type="number" placeholder="0.00" prefix="₹" suffix="L" segColor={seg.color} />
              </div>
            ))}
          </div>
          <Btn onClick={saveDailySales} disabled={saving} style={{ width: "100%" }}>
            {saving ? "Saving…" : "Save Daily Sales"}
          </Btn>
        </Card>
      )}

      {/* Monthly Targets */}
      {activeForm === "targets" && (
        <Card style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Set Monthly Targets</div>
          <div style={{ fontSize: 13, color: "#8A97A8", marginBottom: 20 }}>Set segment-wise monthly targets for a given month (₹ Lakhs).</div>
          <Input label="Month" type="month" value={tgtMonth} onChange={setTgtMonth} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {SEGMENTS.map(seg => (
              <div key={seg.id} style={{ background: seg.light, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1A2332" }}>{seg.name}</span>
                </div>
                <Input value={tgtVals[seg.id]} onChange={v => setTgtVals(x => ({ ...x, [seg.id]: v }))} type="number" placeholder="0.00" prefix="₹" suffix="L" segColor={seg.color} />
              </div>
            ))}
          </div>
          <Btn onClick={saveTargets} disabled={saving} style={{ width: "100%" }}>
            {saving ? "Saving…" : "Save Targets"}
          </Btn>
        </Card>
      )}

      {/* Last Month Actuals */}
      {activeForm === "lma" && (
        <Card style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Enter Last Month Final Actuals</div>
          <div style={{ fontSize: 13, color: "#8A97A8", marginBottom: 20 }}>Enter the final full-month sales for a previous month. Used as the benchmark line on cumulative charts.</div>
          <Input label="Month" type="month" value={lmaMonth} onChange={setLmaMonth} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {SEGMENTS.map(seg => (
              <div key={seg.id} style={{ background: seg.light, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#1A2332" }}>{seg.name}</span>
                </div>
                <Input value={lmaVals[seg.id]} onChange={v => setLmaVals(x => ({ ...x, [seg.id]: v }))} type="number" placeholder="0.00" prefix="₹" suffix="L" segColor={seg.color} />
              </div>
            ))}
          </div>
          <Btn onClick={saveLastMonthActuals} disabled={saving} style={{ width: "100%" }}>
            {saving ? "Saving…" : "Save Last Month Actuals"}
          </Btn>
        </Card>
      )}

      {/* Salesperson Targets & Actuals */}
      {activeForm === "sp" && (
        <Card style={{ padding: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Salesperson Targets & Actuals</div>
          <div style={{ fontSize: 13, color: "#8A97A8", marginBottom: 20 }}>Set monthly target and update actual achievement per salesperson per segment.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 8 }}>
            <Input label="Month" type="month" value={spMonth} onChange={setSpMonth} />
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#546E7A", marginBottom: 5 }}>Salesperson</label>
              <select value={spPerson} onChange={e => setSpPerson(e.target.value)}
                style={{ width: "100%", border: "1.5px solid #E5E9EF", borderRadius: 10, padding: "10px 12px", fontSize: 14, outline: "none", fontFamily: "inherit", background: "#fff" }}>
                {SALESPEOPLE.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ background: "#F7F9FC", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#8A97A8", textTransform: "uppercase" }}>Segment</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#8A97A8", textTransform: "uppercase" }}>Target (L)</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#8A97A8", textTransform: "uppercase" }}>Actual (L)</span>
            </div>
            {SEGMENTS.map(seg => (
              <div key={seg.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{seg.name}</span>
                </div>
                <input type="number" value={spVals[seg.id].target} onChange={e => setSpVals(x => ({ ...x, [seg.id]: { ...x[seg.id], target: e.target.value } }))}
                  placeholder="0.00" style={{ border: "1.5px solid #E5E9EF", borderRadius: 8, padding: "7px 10px", fontSize: 13, width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none" }} />
                <input type="number" value={spVals[seg.id].actual} onChange={e => setSpVals(x => ({ ...x, [seg.id]: { ...x[seg.id], actual: e.target.value } }))}
                  placeholder="0.00" style={{ border: "1.5px solid #E5E9EF", borderRadius: 8, padding: "7px 10px", fontSize: 13, width: "100%", boxSizing: "border-box", fontFamily: "inherit", outline: "none" }} />
              </div>
            ))}
          </div>
          <Btn onClick={saveSalespersonData} disabled={saving} style={{ width: "100%" }}>
            {saving ? "Saving…" : "Save Salesperson Data"}
          </Btn>
        </Card>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// DASHBOARD (read from Google Sheet data)
// ═════════════════════════════════════════════════════════════
function Dashboard({ rawData, loading }) {
  const [chartMode, setChartMode] = useState("daily");

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, gap: 12 }}>
      <div style={{ width: 36, height: 36, border: "3px solid #E5E9EF", borderTopColor: "#1A2332", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <div style={{ fontSize: 14, color: "#8A97A8" }}>Loading from Google Sheets…</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── Process raw data ──────────────────────────────────────
  const { dailySales, targets, lastMonthActuals, spData } = rawData;

  // Build per-segment daily arrays
  const segmentData = {};
  SEGMENTS.forEach(seg => {
    const monthTarget = targets.find(r => r.month === MONTH_KEY && r.segment === seg.id);
    const monthlyTarget = monthTarget ? parseFloat(monthTarget.target) : 0;

    const dailyCurr = Array(DAYS_MONTH).fill(null);
    const dailyPrev = Array(DAYS_MONTH).fill(0);

    dailySales.forEach(row => {
      if (row.segment !== seg.id) return;
      const d = new Date(row.date);
      const rowMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const day = d.getDate() - 1;
      if (rowMonth === MONTH_KEY && day < DAYS_MONTH) dailyCurr[day] = (dailyCurr[day] || 0) + parseFloat(row.value || 0);
      if (rowMonth === PREV_KEY  && day < DAYS_MONTH) dailyPrev[day] = (dailyPrev[day] || 0) + parseFloat(row.value || 0);
    });

    const lma = lastMonthActuals.find(r => r.month === PREV_KEY && r.segment === seg.id);
    const prevFullActual = lma ? parseFloat(lma.actual) : dailyPrev.reduce((a, b) => a + b, 0);

    segmentData[seg.id] = { monthlyTarget, dailyCurr, dailyPrev, prevFullActual };
  });

  // Totals
  const totalCurrMTD = SEGMENTS.reduce((s, seg) => {
    return s + (segmentData[seg.id].dailyCurr.filter(Boolean).reduce((a, b) => a + b, 0));
  }, 0);
  const totalPrevMTD = SEGMENTS.reduce((s, seg) => {
    return s + segmentData[seg.id].dailyPrev.slice(0, DAY).reduce((a, b) => a + b, 0);
  }, 0);
  const totalTarget  = SEGMENTS.reduce((s, seg) => s + segmentData[seg.id].monthlyTarget, 0);
  const proRata      = (totalTarget / DAYS_MONTH) * DAY;
  const overallAch   = pct(totalCurrMTD, proRata);
  const overallDelta = delt(totalCurrMTD, totalPrevMTD);

  // Process salespeople
  const spProcessed = SALESPEOPLE.map(sp => {
    const segs = {};
    SEGMENTS.forEach(seg => {
      const row = spData.find(r => r.salesperson === sp.name && r.segment === seg.id && r.month === MONTH_KEY);
      segs[seg.id] = { target: row ? parseFloat(row.target) : 0, actual: row ? parseFloat(row.actual) : 0 };
    });
    const totalT = SEGMENTS.reduce((s, seg) => s + segs[seg.id].target, 0);
    const totalA = SEGMENTS.reduce((s, seg) => s + segs[seg.id].actual, 0);
    return { ...sp, segs, totalTarget: totalT, totalActual: totalA, ach: pct(totalA, totalT) };
  }).sort((a, b) => b.totalActual - a.totalActual);

  // Chart data builders
  const days = Array.from({ length: DAYS_MONTH }, (_, i) => i + 1);

  const totalDailyChartData = days.map(d => {
    let curr = 0, prev = 0;
    SEGMENTS.forEach(seg => {
      const v = segmentData[seg.id].dailyCurr[d - 1];
      if (v !== null) curr += v || 0;
      prev += segmentData[seg.id].dailyPrev[d - 1] || 0;
    });
    return { day: d, [MONTH_NAME]: d <= DAY ? parseFloat(curr.toFixed(2)) : null, [PREV_MONTH]: parseFloat(prev.toFixed(2)) };
  });

  const totalPrevFull = SEGMENTS.reduce((s, seg) => s + segmentData[seg.id].prevFullActual, 0);
  const totalCumChartData = (() => {
    let cc = 0, cp = 0;
    return days.map(d => {
      SEGMENTS.forEach(seg => { const v = segmentData[seg.id].dailyCurr[d - 1]; if (v !== null) cc += v || 0; cp += segmentData[seg.id].dailyPrev[d - 1] || 0; });
      return { day: d, [MONTH_NAME]: d <= DAY ? parseFloat(cc.toFixed(2)) : null, [PREV_MONTH]: parseFloat(cp.toFixed(2)), "Last Month Final": parseFloat(((totalPrevFull / DAYS_MONTH) * d).toFixed(2)) };
    });
  })();

  return (
    <div>
      {/* Chart mode toggle */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
        <div style={{ display: "flex", background: "#F4F7FA", borderRadius: 8, padding: 3 }}>
          {["daily", "cumulative"].map(m => (
            <button key={m} onClick={() => setChartMode(m)} style={{ padding: "5px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 12, background: chartMode === m ? "#fff" : "transparent", color: chartMode === m ? "#1A2332" : "#8A97A8", boxShadow: chartMode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none", textTransform: "capitalize", fontFamily: "inherit" }}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total MTD Sales",    value: fmt(totalCurrMTD), sub: `vs ${fmt(totalPrevMTD)} (${PREV_MONTH} MTD)`, chip: <DeltaChip value={overallDelta} /> },
          { label: "Monthly Target",     value: fmt(totalTarget),  sub: `Pro-rata today: ${fmt(proRata)}` },
          { label: "MTD Achievement",    value: `${overallAch}%`,  sub: "vs pro-rata target", chip: <Badge color={overallAch >= 100 ? "#2E7D52" : overallAch >= 75 ? "#8A6200" : "#C0392B"} bg={overallAch >= 100 ? "#EAF7EF" : overallAch >= 75 ? "#FEF7E6" : "#FDEAEA"}>{overallAch >= 100 ? "On Track" : overallAch >= 75 ? "At Risk" : "Behind"}</Badge> },
          { label: "Month-on-Month Gap", value: fmt(Math.abs(totalCurrMTD - totalPrevMTD)), sub: totalCurrMTD >= totalPrevMTD ? "Ahead of last month" : "Behind last month", chip: <DeltaChip value={overallDelta} /> },
        ].map((k, i) => (
          <Card key={i} style={{ padding: "18px 22px" }}>
            <div style={{ fontSize: 11, color: "#8A97A8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontWeight: 900, fontSize: 26, color: "#1A2332", letterSpacing: -0.5 }}>{k.value}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#8A97A8" }}>{k.sub}</span>{k.chip}
            </div>
          </Card>
        ))}
      </div>

      {/* Total chart */}
      <SectionTitle sub={`${MONTH_NAME} vs ${PREV_MONTH} · Day ${DAY} of ${DAYS_MONTH}`}>
        {chartMode === "daily" ? "Daily Sales — Total Business" : "Cumulative Sales — Total Business"}
      </SectionTitle>
      <Card style={{ padding: "24px 28px", marginBottom: 28 }}>
        <ResponsiveContainer width="100%" height={260}>
          {chartMode === "daily" ? (
            <BarChart data={totalDailyChartData} barCategoryGap="30%" margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#8A97A8" }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: "#8A97A8" }} tickLine={false} axisLine={false} tickFormatter={v => `${v}L`} />
              <Tooltip content={<ChartTip />} />
              <ReferenceLine x={DAY} stroke="#1A2332" strokeDasharray="4 2" strokeWidth={1.5} />
              <Bar dataKey={PREV_MONTH} fill="#E5E9EF" radius={[3,3,0,0]} />
              <Bar dataKey={MONTH_NAME} fill="#1A2332" radius={[3,3,0,0]} />
            </BarChart>
          ) : (
            <LineChart data={totalCumChartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#8A97A8" }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize: 11, fill: "#8A97A8" }} tickLine={false} axisLine={false} tickFormatter={v => `${v}L`} />
              <Tooltip content={<ChartTip />} />
              <ReferenceLine x={DAY} stroke="#1A2332" strokeDasharray="4 2" strokeWidth={1.5} />
              <Line dataKey="Last Month Final" stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
              <Line dataKey={PREV_MONTH} stroke="#B0BEC5" strokeWidth={2} dot={false} connectNulls />
              <Line dataKey={MONTH_NAME} stroke="#1A2332" strokeWidth={3} dot={false} connectNulls />
            </LineChart>
          )}
        </ResponsiveContainer>
      </Card>

      {/* Segment summary */}
      <SectionTitle sub="MTD achievement vs pro-rata target · click segment for detail">Segment Breakdown</SectionTitle>
      <Card style={{ marginBottom: 28 }}>
        {SEGMENTS.map((seg, i) => {
          const sd = segmentData[seg.id];
          const currMTD = sd.dailyCurr.filter(Boolean).reduce((a, b) => a + b, 0);
          const prevMTD = sd.dailyPrev.slice(0, DAY).reduce((a, b) => a + b, 0);
          const proR    = (sd.monthlyTarget / DAYS_MONTH) * DAY;
          const a = pct(currMTD, proR);
          const d = delt(currMTD, prevMTD);
          return (
            <div key={seg.id} style={{ display: "grid", gridTemplateColumns: "190px 90px 90px 70px 1fr 50px", alignItems: "center", gap: 16, padding: "14px 24px", borderBottom: i < SEGMENTS.length - 1 ? "1px solid #F7F9FC" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{seg.name}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{fmt(currMTD)}</div>
              <div style={{ fontSize: 12, color: "#8A97A8" }}>{fmt(prevMTD)}</div>
              <DeltaChip value={d} />
              <GaugeBar value={currMTD} max={proR || 1} color={seg.color} h={8} />
              <div style={{ fontWeight: 700, fontSize: 13, color: a >= 100 ? "#2E7D52" : a >= 75 ? "#F0A500" : "#C0392B", textAlign: "right" }}>{a}%</div>
            </div>
          );
        })}
      </Card>

      {/* Leaderboard */}
      <SectionTitle sub={`${MONTH_NAME} · ranked by MTD actual`}>Sales Team Leaderboard</SectionTitle>
      <Card style={{ marginBottom: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 100px 100px 70px 1fr", gap: 12, padding: "12px 20px", borderBottom: "1px solid #F0F4F8", fontSize: 10, fontWeight: 700, color: "#8A97A8", textTransform: "uppercase", letterSpacing: 0.5 }}>
          <span>#</span><span>Name</span><span>Actual</span><span>Target</span><span>Ach %</span><span>Progress</span>
        </div>
        {spProcessed.map((sp, i) => {
          const rankColors = ["#F0A500","#8A97A8","#CD7F32"];
          const rank = i + 1;
          return (
            <div key={sp.id} style={{ display: "grid", gridTemplateColumns: "40px 1fr 100px 100px 70px 1fr", gap: 12, alignItems: "center", padding: "12px 20px", borderBottom: "1px solid #F7F9FC", background: rank === 1 ? "#FFFBEF" : "#fff" }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: rank <= 3 ? rankColors[rank-1]+"22" : "#F0F4F8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 12, color: rank <= 3 ? rankColors[rank-1] : "#8A97A8" }}>{rank}</div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#1A2332" }}>{sp.name}</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{fmt(sp.totalActual)}</div>
              <div style={{ fontSize: 12, color: "#8A97A8" }}>{fmt(sp.totalTarget)}</div>
              <Badge color={sp.ach >= 100 ? "#2E7D52" : sp.ach >= 75 ? "#8A6200" : "#C0392B"} bg={sp.ach >= 100 ? "#EAF7EF" : sp.ach >= 75 ? "#FEF7E6" : "#FDEAEA"}>{sp.ach}%</Badge>
              <GaugeBar value={sp.totalActual} max={sp.totalTarget || 1} color={sp.ach >= 100 ? "#3DAA6E" : sp.ach >= 75 ? "#F0A500" : "#E8533A"} h={7} />
            </div>
          );
        })}
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
// ROOT APP
// ═════════════════════════════════════════════════════════════
export default function App() {
  const [role, setRole]       = useState(VIEW_PASSWORD ? null : "viewer");
  const [activeTab, setTab]   = useState("dashboard");
  const [rawData, setRawData] = useState({ dailySales: [], targets: [], lastMonthActuals: [], spData: [] });
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLR]  = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dailySales, targets, lastMonthActuals, spData] = await Promise.all([
        apiGet("daily_sales"), apiGet("targets"), apiGet("last_month_actuals"), apiGet("salespeople_targets"),
      ]);
      setRawData({ dailySales, targets, lastMonthActuals, spData });
      setLR(new Date());
    } catch (e) {
      console.error("Fetch error", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (role) fetchData(); }, [role, fetchData]);

  if (!role) return <LoginScreen onLogin={r => setRole(r)} />;

  const tabs = [
    { id: "dashboard", label: "📊 Dashboard" },
    ...(role === "admin" ? [{ id: "entry", label: "✏️ Enter Data" }] : []),
  ];

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", background: "#F4F7FA", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E5E9EF", padding: "0 32px", position: "sticky", top: 0, zIndex: 99 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#1A2332", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 13 }}>UC</span>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>UCMPL Sales Dashboard</div>
              <div style={{ fontSize: 11, color: "#8A97A8" }}>
                Day {DAY} · {MONTH_NAME} {today.getFullYear()} ·
                <Badge style={{ marginLeft: 6 }} color={role === "admin" ? "#2E7D52" : "#2E86AB"} bg={role === "admin" ? "#EAF7EF" : "#EAF4F9"}>
                  {role === "admin" ? "Admin" : "Viewer"}
                </Badge>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: activeTab === t.id ? "#1A2332" : "transparent", color: activeTab === t.id ? "#fff" : "#8A97A8", transition: "all .15s", fontFamily: "inherit" }}>{t.label}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {lastRefresh && <span style={{ fontSize: 11, color: "#8A97A8" }}>Updated {lastRefresh.toLocaleTimeString()}</span>}
            <Btn variant="secondary" onClick={fetchData} disabled={loading} style={{ padding: "7px 14px", fontSize: 12 }}>
              {loading ? "…" : "↻ Refresh"}
            </Btn>
            <Btn variant="secondary" onClick={() => setRole(null)} style={{ padding: "7px 14px", fontSize: 12, color: "#C0392B" }}>
              Sign Out
            </Btn>
          </div>
        </div>
      </div>

      <div style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>
        {activeTab === "dashboard" && <Dashboard rawData={rawData} loading={loading} />}
        {activeTab === "entry"     && role === "admin" && <DataEntryPanel onSaved={fetchData} />}
      </div>
    </div>
  );
}
