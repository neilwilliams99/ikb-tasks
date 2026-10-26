import { useState, useEffect, useMemo } from "react";
import { supabase } from "../lib/supabase.js";
import { acct, num } from "../lib/format.js";
import { PageHead, Modal } from "../components/ui.jsx";
import { TimeChart, BarChart, seriesColor, SERIES } from "../components/charts.jsx";
import { FREQS, EVENT_TYPES, perMonth, pmt, schedule, sumMonths, yearly, taxSaving, monthKey, monthLabel, monthsUntil } from "../lib/loans.js";

// Everything looks forward from the first of this month (month 0).
const START = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })();

const NEW_LOAN = {
  name: "", balance: "", rate: "", term_years: 30, repayment_type: "pi", io_years: "",
  repayment: "", repayment_freq: "monthly", extra: 0, extra_freq: "weekly", offset_balance: 0,
  tax_deductible: false, events: [], notes: "",
};

const years = (months) => {
  const y = Math.floor(months / 12), m = months % 12;
  return [y && `${y}y`, m && `${m}m`].filter(Boolean).join(" ") || "0m";
};
const pct = (v) => `${(Number(v) || 0).toFixed(2)}%`;
const blankToNull = (v) => (v === "" || v === null || v === undefined ? null : num(v));

// Payoff text for a schedule: the month it clears, or what is still owed when the term ends
const payoffText = (s) => (s.paidOff ? `${monthLabel(s.payoffMonth)} · ${years(s.months)}` : `${monthLabel(monthKey(START, s.months))} · ${acct(s.endBalance)} due`);

const belowMinText = (s) => `⚠ From ${monthLabel(s.belowMinFrom)} your fixed repayment is below the minimum, so the minimum is used. Add a repayment change to set a new amount.`;

// The loans and the settings row are held by App and loaded once per session,
// so this page writes its changes back through the setters rather than
// reloading them when the tab is opened.
export default function Loans({ loans, setLoans, loading, settings, setSettings, settingsLoading }) {
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  // Blank while the stored rate is still on its way, so the field does not
  // flash a default; 39 only once we know there is nothing stored.
  const storedRate = settings[0] ? String(settings[0].tax_rate) : settingsLoading ? "" : "39";
  const [taxRate, setTaxRate] = useState(storedRate);

  // Follow the stored rate as it arrives, and again after a save. On a return
  // to the tab it is already here, so the field starts out right.
  useEffect(() => { setTaxRate(storedRate); }, [storedRate]);

  // Keeping the saved row means the rate survives a tab switch without being
  // read back from the database.
  const saveTaxRate = () => supabase.from("loan_settings").update({ tax_rate: num(taxRate) }, 1)
    .then(([s]) => { if (s) setSettings([s]); }).catch(() => {});

  // Colour follows the loan (its place among all loans), not its rank on screen
  const colorOf = (l) => seriesColor(loans.findIndex((x) => x.id === l.id));
  const active = loans.filter((l) => !l.archived_at);
  const archived = loans.filter((l) => l.archived_at);

  const calc = useMemo(() => Object.fromEntries(active.map((l) => [l.id, {
    s: schedule(l, START),
    min: schedule(l, START, { baseline: true }),
  }])), [loans]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = active.find((l) => l.id === selectedId) || active[0];

  const save = async (draft) => {
    const body = {
      name: draft.name.trim(), balance: num(draft.balance), rate: num(draft.rate), term_years: num(draft.term_years),
      repayment_type: draft.repayment_type, io_years: draft.repayment_type === "io" ? blankToNull(draft.io_years) : null,
      repayment: blankToNull(draft.repayment), repayment_freq: draft.repayment_freq,
      extra: num(draft.extra), extra_freq: draft.extra_freq, offset_balance: num(draft.offset_balance),
      tax_deductible: !!draft.tax_deductible, notes: draft.notes || null,
      events: (draft.events || []).filter((e) => e.month && e.type).map((e) => ({ month: e.month, type: e.type, value: e.type === "repayment" ? blankToNull(e.value) : num(e.value) })),
    };
    if (draft.id) {
      const [u] = await supabase.from("loans").update(body, draft.id).catch(() => []);
      if (u) setLoans((prev) => prev.map((l) => (l.id === u.id ? u : l)));
      return !!u;
    }
    const [c] = await supabase.from("loans").insert({ ...body, sort_order: loans.length + 1 }).catch(() => []);
    if (c) { setLoans((prev) => [...prev, c]); setSelectedId(c.id); }
    return !!c;
  };

  const patch = async (loan, fields) => {
    const [u] = await supabase.from("loans").update(fields, loan.id).catch(() => []);
    if (u) setLoans((prev) => prev.map((l) => (l.id === u.id ? u : l)));
  };
  const destroy = async (loan) => {
    if (!window.confirm(`Permanently delete the loan "${loan.name}"?\n\nThis cannot be undone.`)) return;
    await supabase.from("loans").delete(loan.id).then(() => setLoans((prev) => prev.filter((l) => l.id !== loan.id))).catch(() => {});
  };

  // ── Portfolio figures
  const tot = active.reduce((t, l) => {
    const { s, min } = calc[l.id];
    const r0 = s.rows[0] || { repayment: 0, extra: 0 };
    const int12 = sumMonths(s.rows, "interest", 12);
    t.balance += num(l.balance); t.offset += num(l.offset_balance);
    t.repayment += r0.repayment; t.extra += r0.extra;
    t.int12 += int12; t.tax12 += taxSaving(l, int12, taxRate);
    t.interest += s.totalInterest; t.saved += min.totalInterest - s.totalInterest;
    t.months = Math.max(t.months, s.months);
    if (!s.paidOff) t.owedAtEnd += s.endBalance;
    return t;
  }, { balance: 0, offset: 0, repayment: 0, extra: 0, int12: 0, tax12: 0, interest: 0, saved: 0, months: 0, owedAtEnd: 0 });

  const horizon = tot.months;
  const monthLabels = Array.from({ length: horizon }, (_, i) => monthLabel(monthKey(START, i)));
  const balanceSeries = active.map((l) => ({
    name: l.name, color: colorOf(l), values: monthLabels.map((_, i) => calc[l.id].s.rows[i]?.opening ?? 0),
  }));
  const yearCount = Math.ceil(horizon / 12);
  const portYears = Array.from({ length: yearCount }, (_, y) => {
    const o = { principal: 0, extra: 0, interest: 0, tax: 0, repayment: 0, closing: 0 };
    active.forEach((l) => {
      const yr = yearly(calc[l.id].s.rows)[y];
      if (!yr) return;
      o.principal += Math.max(0, yr.principal); o.extra += yr.extra; o.interest += yr.interest; o.repayment += yr.repayment;
      o.tax += taxSaving(l, yr.interest, taxRate); o.closing += yr.closing;
    });
    return o;
  });
  const yearLabels = portYears.map((_, y) => `Y${y + 1}`);

  return (
    <>
      <PageHead eyebrow="loans" title="Loans">
        <div className="field inline">
          <label>Tax rate</label>
          <input type="number" step="0.5" min="0" max="100" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} onBlur={saveTaxRate}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} className="input num" style={{ width: 80 }} />
          <span className="mono" style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>%</span>
        </div>
        <label className={`toggle view${showArchived ? " on" : ""}`}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Show archived{archived.length ? ` (${archived.length})` : ""}
        </label>
        <button onClick={() => setEditing({ ...NEW_LOAN })} className="btn btn-primary">Add loan</button>
      </PageHead>
      <p className="hint-line">// looking forward from {monthLabel(monthKey(START, 0))} · amounts per month unless stated · reductions shown in (brackets)</p>

      {/* KPI tiles */}
      <div className="kpis">
        <Kpi label="Owed today" value={acct(tot.balance)} sub={`${acct(tot.balance - tot.offset)} net of ${acct(tot.offset)} offset`} />
        <Kpi label="Paid this month" value={acct(tot.repayment + tot.extra)} sub={`${acct(tot.repayment)} repayments + ${acct(tot.extra)} extra`} />
        <Kpi label="Interest next 12 months" value={acct(tot.int12)} sub={`about ${acct(tot.int12 / 12)} a month`} />
        <Kpi label="Tax saving next 12 months" value={acct(-tot.tax12)} sub={`indicative · interest × ${pct(taxRate)} on deductible loans`} accent="ok" />
        <Kpi label="Interest saved" value={acct(tot.saved)} sub="by extra repayments, offsets & lump sums" accent="ok" />
        <Kpi label={tot.owedAtEnd ? "Last loan ends" : "Debt free"} value={horizon ? monthLabel(monthKey(START, horizon - 1)) : "—"}
          sub={tot.owedAtEnd ? `${acct(tot.owedAtEnd)} still owed on interest-only loans at term end` : `in ${years(horizon)}`} accent={tot.owedAtEnd ? "warn" : undefined} />
      </div>

      {/* Summary table */}
      <div className="table wide" style={{ "--row-min": "1180px" }}>
        <div className="row head">
          <div className="col-head" style={{ flex: 1.4 }}>Loan</div>
          <div className="col-head" style={{ width: 40, flex: "none" }}>Type</div>
          <div className="col-head" style={{ width: 64, flex: "none", textAlign: "right" }}>Rate</div>
          <div className="col-head" style={{ flex: 1, textAlign: "right" }}>Balance</div>
          <div className="col-head" style={{ flex: 1, textAlign: "right" }}>Offset</div>
          <div className="col-head" style={{ flex: 0.9, textAlign: "right" }}>Repayment</div>
          <div className="col-head" style={{ flex: 0.8, textAlign: "right" }}>Extra</div>
          <div className="col-head" style={{ flex: 0.9, textAlign: "right" }}>Interest 12m</div>
          <div className="col-head" style={{ flex: 0.9, textAlign: "right" }}>Tax saving 12m</div>
          <div className="col-head" style={{ flex: 1, textAlign: "right" }}>Interest to end</div>
          <div className="col-head" style={{ flex: 1.8, textAlign: "right" }}>Paid off / term end</div>
          <div style={{ width: 128, flex: "none" }} />
        </div>
        {active.map((l) => {
          const { s } = calc[l.id];
          const r0 = s.rows[0] || { repayment: 0, extra: 0 };
          const int12 = sumMonths(s.rows, "interest", 12);
          const tax = taxSaving(l, int12, taxRate);
          return (
            <div key={l.id} className={`row data clickable-row${selected?.id === l.id ? " selected" : ""}`} onClick={() => setSelectedId(l.id)}>
              <div className="cell strong" style={{ flex: 1.4, display: "flex", alignItems: "center", gap: 8 }}>
                <i className="dot" style={{ background: colorOf(l) }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{l.name}</span>
                {l.tax_deductible && <span className="badge" title="Tax deductible">tax</span>}
                {s.belowMinFrom && <span className="badge warn" title={belowMinText(s)}>min</span>}
              </div>
              <div className="cell fixed mono" style={{ width: 40 }}>{l.repayment_type === "io" ? "I/O" : "P&I"}</div>
              <div className="cell fixed num" style={{ width: 64 }}>{pct(l.rate)}</div>
              <div className="cell num" style={{ flex: 1 }}>{acct(l.balance)}</div>
              <div className="cell num muted" style={{ flex: 1 }}>{acct(l.offset_balance)}</div>
              <div className="cell num" style={{ flex: 0.9 }}>{acct(r0.repayment)}</div>
              <div className="cell num" style={{ flex: 0.8 }}>{acct(r0.extra)}</div>
              <div className="cell num" style={{ flex: 0.9 }}>{acct(int12)}</div>
              <div className="cell num ok" style={{ flex: 0.9 }}>{tax ? acct(-tax) : "—"}</div>
              <div className="cell num" style={{ flex: 1 }}>{acct(s.totalInterest)}</div>
              <div className={`cell num${s.paidOff ? "" : " warn"}`} style={{ flex: 1.8 }} title={payoffText(s)}>{payoffText(s)}</div>
              <div className="cell actions" style={{ width: 128 }} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setEditing({ ...l, repayment: l.repayment ?? "", io_years: l.io_years ?? "", events: l.events || [] })} className="btn btn-sm btn-outline">Edit</button>
                <button onClick={() => patch(l, { archived_at: new Date().toISOString() })} className="btn btn-sm btn-ghost" title="Hide from the totals">Archive</button>
              </div>
            </div>
          );
        })}
        {showArchived && archived.map((l) => (
          <div key={l.id} className="row data done">
            <div className="cell strong" style={{ flex: 1 }}>{l.name}</div>
            <div className="cell num" style={{ width: 140, flex: "none" }}>{acct(l.balance)}</div>
            <div className="cell actions" style={{ width: 128 }}>
              <button onClick={() => patch(l, { archived_at: null })} className="btn btn-sm btn-outline">Restore</button>
              <button onClick={() => destroy(l)} className="btn btn-danger btn-icon" aria-label="Delete permanently" title="Delete permanently">{"✕"}</button>
            </div>
          </div>
        ))}
        {active.length === 0 && <div className="empty">{loading ? "loading…" : "no loans yet — Add loan"}</div>}
        {active.length > 0 && (
          <div className="row total">
            <div className="cell" style={{ flex: 1.4 }}>Total <span className="mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 400 }}>// {active.length} loan{active.length === 1 ? "" : "s"}</span></div>
            <div style={{ width: 40 + 64 + 10, flex: "none" }} />
            <div className="cell num" style={{ flex: 1 }}>{acct(tot.balance)}</div>
            <div className="cell num muted" style={{ flex: 1 }}>{acct(tot.offset)}</div>
            <div className="cell num" style={{ flex: 0.9 }}>{acct(tot.repayment)}</div>
            <div className="cell num" style={{ flex: 0.8 }}>{acct(tot.extra)}</div>
            <div className="cell num" style={{ flex: 0.9 }}>{acct(tot.int12)}</div>
            <div className="cell num ok" style={{ flex: 0.9 }}>{tot.tax12 ? acct(-tot.tax12) : "—"}</div>
            <div className="cell num accent" style={{ flex: 1 }}>{acct(tot.interest)}</div>
            <div style={{ flex: 1.8 }} />
            <div style={{ width: 128, flex: "none" }} />
          </div>
        )}
      </div>

      {active.length > 0 && (
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="section-title">Balance owed</div>
            <TimeChart labels={monthLabels} series={balanceSeries} stack tickEvery={horizon > 180 ? 60 : 24}
              tickLabel={(i) => `Y${i / 12}`} />
          </div>
          <div className="card">
            <div className="section-title">Paid each year <span className="mono" style={{ textTransform: "none", color: "var(--text-muted)" }}>all loans</span></div>
            <BarChart labels={yearLabels} series={[
              { name: "Principal", color: SERIES[0], values: portYears.map((y) => y.principal) },
              { name: "Extra", color: SERIES[2], values: portYears.map((y) => y.extra) },
              { name: "Interest", color: SERIES[1], values: portYears.map((y) => y.interest) },
            ]} />
          </div>
        </div>
      )}

      {active.length > 0 && <Cashflow loans={active} calc={calc} colorOf={colorOf} taxRate={taxRate} horizon={horizon} />}

      {active.length > 0 && <PortfolioYears years={portYears} taxRate={taxRate} />}

      {selected && <LoanDetail key={selected.id} loan={selected} color={colorOf(selected)} taxRate={taxRate}
        onSave={save} onEdit={() => setEditing({ ...selected, repayment: selected.repayment ?? "", io_years: selected.io_years ?? "", events: selected.events || [] })} />}

      {editing && <LoanForm draft={editing} onClose={() => setEditing(null)} onSave={async (d) => { if (await save(d)) setEditing(null); }} />}
    </>
  );
}

function Kpi({ label, value, sub, accent }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className={`kpi-value${accent ? " " + accent : ""}`}>{value}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

// ── Cashflow: what leaves the account each month, across all loans
// "Regular" leaves out lump sums, so the chart and the before/after figures
// show the ongoing monthly commitment; lump sums are listed as one-offs.
const eventText = (e, loan) => ({
  rate: () => `Rate changes to ${pct(e.value)}`,
  offset: () => `Offset changes to ${acct(e.value)}`,
  lump: () => `Lump sum of ${acct(e.value)} (one-off)`,
  repayment: () => (e.value == null || e.value === "" ? "Repayment changes to the minimum"
    : `Repayment changes to ${acct(e.value)} ${(FREQS.find(([k]) => k === loan.repayment_freq)?.[1] || "").toLowerCase()}`),
}[e.type] || (() => e.type))();

function Cashflow({ loans, calc, colorOf, taxRate, horizon }) {
  const row = (l, i) => calc[l.id].s.rows[i];
  const regular = (r) => (r ? r.repayment + r.extra - r.lump : 0);
  const months = Array.from({ length: horizon }, (_, i) => loans.reduce((t, l) => {
    const r = row(l, i);
    if (!r) return t;
    t.out += r.repayment + r.extra; t.regular += regular(r); t.tax += taxSaving(l, r.interest, taxRate);
    return t;
  }, { out: 0, regular: 0, tax: 0 }));
  // Cash out only. The tax saving is indicative and never nets off a cashflow figure.
  const netAt = (i) => (i >= 0 && i < horizon ? months[i].regular : 0);
  // One loan's regular cash out in month i (0 once it is paid off or its term ends)
  const loanNet = (l, i) => { const r = row(l, i); return r ? regular(r) : 0; };
  const next12 = months.slice(0, 12).reduce((s, m) => s + m.out, 0);
  const peak = months.reduce((p, m, i) => (m.regular > p.v + 0.5 ? { v: m.regular, i } : p), { v: 0, i: 0 });

  // Months where the regular cash out steps up or down, and why
  const changes = [];
  loans.forEach((l) => {
    const s = calc[l.id].s;
    (l.events || []).forEach((e) => {
      const i = monthsUntil(START, e.month);
      if (i >= 0 && i < s.months) changes.push({ i, loan: l, what: eventText(e, l), oneOff: e.type === "lump" ? num(e.value) : 0 });
    });
    const ioMonths = l.repayment_type === "io" && l.io_years !== null && l.io_years !== "" ? Math.round(num(l.io_years) * 12) : 0;
    if (ioMonths > 0 && ioMonths < s.months) changes.push({ i: ioMonths, loan: l, what: "Interest only ends; principal & interest repayments start" });
    if (s.belowMinFrom) changes.push({ i: monthsUntil(START, s.belowMinFrom), loan: l, what: "Minimum repayment overrides your fixed amount", warn: true });
    // The last payment is usually only what's left, so "before" is the last full month
    const last = s.rows[s.months - 1];
    changes.push(s.paidOff
      ? { i: s.months, loan: l, beforeAt: Math.max(0, s.months - 2), what: `Paid off; repayments stop${last ? ` (final payment ${acct(last.repayment + last.extra)} in ${monthLabel(last.month)})` : ""}` }
      : { i: s.months, loan: l, what: `Term ends; ${acct(s.endBalance)} balance due (refinance or repay)`, warn: true });
  });
  changes.sort((a, b) => a.i - b.i);

  const series = loans.map((l) => ({ name: l.name, color: colorOf(l), values: months.map((_, i) => regular(row(l, i))) }));
  const labels = months.map((_, i) => monthLabel(monthKey(START, i)));

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-title">Cashflow <span className="mono" style={{ textTransform: "none", color: "var(--text-muted)" }}>all loans · cash out of your account</span></div>
      <div className="kpis">
        <Kpi label="Cash out this month" value={acct(months[0]?.out)} sub={`${acct(-(months[0]?.tax || 0))} tax saving, indicative only`} />
        <Kpi label="Cash out next 12 months" value={acct(next12)} sub={`about ${acct(next12 / 12)} a month`} />
        <Kpi label="Highest regular month" value={acct(peak.v)} sub={`${labels[peak.i] || "—"}${peak.i ? "" : " (now)"}`} />
      </div>
      <div className="hint-line" style={{ margin: "0 0 8px" }}>// regular cash out per month by loan (repayments + extra; lump sums listed as one-offs)</div>
      <TimeChart labels={labels} series={series} stack height={220} tickEvery={horizon > 180 ? 60 : 24} tickLabel={(i) => `Y${i / 12}`} />
      <div className="section-title" style={{ marginTop: 16 }}>When it changes <span className="mono" style={{ textTransform: "none", color: "var(--text-muted)" }}>cash out per month</span></div>
      <div>
        <div className="table wide" style={{ marginBottom: 0, "--row-min": "780px" }}>
          <div className="row head">
            <div className="col-head" style={{ width: 96, flex: "none" }}>Month</div>
            <div className="col-head" style={{ flex: 4 }}>What changes</div>
            <div className="col-head" style={{ flex: 1, textAlign: "right" }} title="This loan's cash out per month before the change">Before</div>
            <div className="col-head" style={{ flex: 1, textAlign: "right" }} title="This loan's cash out per month from this month">After</div>
            <div className="col-head" style={{ flex: 0.9, textAlign: "right" }}>Change</div>
            <div className="col-head" style={{ flex: 1.1, textAlign: "right" }} title="Cash out per month across all loans from this month">All loans after</div>
          </div>
          <div className="row data">
            <div className="cell fixed mono" style={{ width: 96 }}>{labels[0] || monthLabel(monthKey(START, 0))}</div>
            <div className="cell muted" style={{ flex: 4, display: "flex", alignItems: "center", gap: 6 }} title="What you pay now, before any of the changes below">
              <i className="dot" style={{ background: "transparent" }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}><b style={{ fontWeight: 500 }}>Today</b> · starting point, {loans.length} loan{loans.length === 1 ? "" : "s"} as they stand</span>
            </div>
            <div className="cell num muted" style={{ flex: 1 }}>—</div>
            <div className="cell num muted" style={{ flex: 1 }}>—</div>
            <div className="cell num muted" style={{ flex: 0.9 }}>—</div>
            <div className="cell num accent" style={{ flex: 1.1 }}>{acct(netAt(0))}</div>
          </div>
          {changes.map((c, k) => {
            const first = k === 0 || changes[k - 1].i !== c.i; // the all-loans total is for the month, shown once
            const before = c.i > 0 ? loanNet(c.loan, c.beforeAt ?? c.i - 1) : null, after = loanNet(c.loan, c.i);
            return (
              <div key={k} className="row data">
                <div className="cell fixed mono" style={{ width: 96 }}>{first ? labels[c.i] || monthLabel(monthKey(START, c.i)) : ""}</div>
                <div className={`cell${c.warn ? " warn" : ""}`} style={{ flex: 4, display: "flex", alignItems: "center", gap: 6 }} title={`${c.loan.name}: ${c.what}`}>
                  <i className="dot" style={{ background: colorOf(c.loan) }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}><b style={{ fontWeight: 500 }}>{c.loan.name}</b> · {c.what}</span>
                </div>
                <div className="cell num muted" style={{ flex: 1 }}>{before != null ? acct(before) : "—"}</div>
                <div className="cell num" style={{ flex: 1 }}>{acct(after)}</div>
                <div className={`cell num${before != null && after < before - 0.5 ? " ok" : ""}`} style={{ flex: 0.9 }}>
                  {before != null && Math.abs(after - before) >= 0.5 ? acct(after - before) : "—"}
                </div>
                <div className="cell num accent" style={{ flex: 1.1 }}>{first ? acct(netAt(c.i)) : ""}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Year-by-year for all loans together — the spreadsheet's Summary, annual not cumulative
function PortfolioYears({ years: ys, taxRate }) {
  const [open, setOpen] = useState(false);
  const shown = open ? ys : ys.slice(0, 10);
  const cols = ["Repayments", "Extra", "Cash out", "Cash out / month", "Tax saving", "Interest", "Closing balance"];
  return (
    <div className="table wide" style={{ "--row-min": "1020px" }}>
      <div className="row head">
        <div className="col-head" style={{ width: 90, flex: "none" }}>All loans</div>
        <div className="col-head" style={{ flex: 1.4 }}>Period</div>
        {cols.map((l) => <div key={l} className="col-head" style={{ flex: 1, textAlign: "right" }}>{l}</div>)}
      </div>
      {shown.map((y, i) => {
        const out = y.repayment + y.extra;
        return (
          <div key={i} className="row data">
            <div className="cell fixed mono" style={{ width: 90 }}>Year {i + 1}</div>
            <div className="cell muted" style={{ flex: 1.4 }}>{monthLabel(monthKey(START, i * 12))} – {monthLabel(monthKey(START, i * 12 + 11))}</div>
            <div className="cell num" style={{ flex: 1 }}>{acct(y.repayment)}</div>
            <div className="cell num" style={{ flex: 1 }}>{acct(y.extra)}</div>
            <div className="cell num strong" style={{ flex: 1 }}>{acct(out)}</div>
            <div className="cell num" style={{ flex: 1 }}>{acct(out / 12)}</div>
            <div className="cell num ok" style={{ flex: 1 }}>{y.tax ? acct(-y.tax) : "—"}</div>
            <div className="cell num muted" style={{ flex: 1 }}>{acct(y.interest)}</div>
            <div className="cell num accent" style={{ flex: 1 }}>{acct(y.closing)}</div>
          </div>
        );
      })}
      {ys.length > 10 && (
        <div className="row"><button className="btn-link" onClick={() => setOpen(!open)}>{open ? "show first 10 years" : `show all ${ys.length} years`}</button>
          <span className="mono" style={{ marginLeft: "auto", fontSize: "0.68rem", color: "var(--text-muted)" }}>// tax saving = interest × {pct(taxRate)} on deductible loans, indicative only</span></div>
      )}
    </div>
  );
}

// ── One loan: what-if, comparison, chart and schedule
function LoanDetail({ loan, color, taxRate, onSave, onEdit }) {
  const fromLoan = () => ({ rate: loan.rate, extra: loan.extra, extra_freq: loan.extra_freq, offset_balance: loan.offset_balance, lump: 0 });
  const [w, setW] = useState(fromLoan);
  const [monthly, setMonthly] = useState(false);
  const set = (k) => (e) => setW({ ...w, [k]: e.target.value });

  const whatIf = {
    ...loan, rate: num(w.rate), extra: num(w.extra), extra_freq: w.extra_freq, offset_balance: num(w.offset_balance),
    events: [...(loan.events || []), ...(num(w.lump) ? [{ month: monthKey(START, 0), type: "lump", value: num(w.lump) }] : [])],
  };
  const changed = ["rate", "extra", "offset_balance"].some((k) => num(w[k]) !== num(loan[k])) || w.extra_freq !== loan.extra_freq || num(w.lump) > 0;

  const plan = schedule(loan, START);
  const wi = schedule(whatIf, START);
  const min = schedule(loan, START, { baseline: true });
  const n = Math.max(plan.months, wi.months, min.months);
  const labels = Array.from({ length: n }, (_, i) => monthLabel(monthKey(START, i)));
  const line = (s) => labels.map((_, i) => s.rows[i]?.opening ?? 0);
  const series = [
    ...(changed ? [{ name: "What-if", color: SERIES[2], values: line(wi) }] : []),
    { name: changed ? "Current plan" : loan.name, color, values: line(plan) },
    { name: "Minimum only", color: "#8ba3b8", dash: true, values: line(min) },
  ];
  const yrs = yearly((changed ? wi : plan).rows);

  const compare = [
    ["Paid off", (s) => payoffText(s)],
    ["Repayment / month", (s) => acct(s.rows[0]?.repayment)],
    ["Extra / month", (s) => acct(s.rows[0]?.extra)],
    ["Interest next 12 months", (s) => acct(sumMonths(s.rows, "interest", 12))],
    ["Total interest", (s) => acct(s.totalInterest)],
    ["Tax saving (life)", (s) => (loan.tax_deductible ? acct(-taxSaving(loan, s.totalInterest, taxRate)) : "—")],
    ["Interest saved vs minimum", (s) => acct(min.totalInterest - s.totalInterest)],
  ];

  const csv = () => {
    const head = ["Month", "Opening balance", "Rate %", "Offset", "Repayment", "Interest", "Principal", "Extra", "Closing balance"];
    const rows = (changed ? wi : plan).rows.map((r) => [monthLabel(r.month), r.opening, r.rate, r.offset, r.repayment, r.interest, r.principal, r.extra, r.closing].map((v) => (typeof v === "number" ? v.toFixed(2) : v)));
    const blob = new Blob([[head, ...rows].map((r) => r.join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `${loan.name} schedule.csv`; a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="section-title">
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}><i className="dot" style={{ background: color }} />{loan.name}</span>
        <span style={{ display: "flex", gap: 8 }}>
          <button onClick={csv} className="btn btn-sm btn-ghost">Export CSV</button>
          <button onClick={onEdit} className="btn btn-sm btn-outline">Edit loan</button>
        </span>
      </div>
      {loan.notes && <p className="hint-line" style={{ margin: "0 0 12px" }}>// {loan.notes}</p>}
      {(changed ? wi : plan).belowMinFrom && <p className="warn-line">{belowMinText(changed ? wi : plan)}</p>}

      <div className="whatif">
        <span className="eyebrow" style={{ margin: 0 }}>// what if</span>
        <div className="field"><label>Rate <span className="hint">%</span></label><input type="number" step="0.05" value={w.rate} onChange={set("rate")} className="input num" /></div>
        <div className="field"><label>Extra repayment</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input type="number" step="50" min="0" value={w.extra} onChange={set("extra")} className="input num" />
            <select value={w.extra_freq} onChange={set("extra_freq")} className="input" style={{ width: 120 }}>{FREQS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
        </div>
        <div className="field"><label>Offset balance</label><input type="number" step="1000" min="0" value={w.offset_balance} onChange={set("offset_balance")} className="input num" /></div>
        <div className="field"><label>Lump sum now</label><input type="number" step="1000" min="0" value={w.lump} onChange={set("lump")} className="input num" /></div>
        <div style={{ display: "flex", gap: 6, alignSelf: "flex-end" }}>
          <button onClick={() => setW(fromLoan())} className="btn btn-sm btn-ghost" disabled={!changed}>Reset</button>
          <button className="btn btn-sm btn-primary" disabled={!changed} title="Keep these figures (a lump sum is saved as this month's event)"
            onClick={() => onSave({ ...loan, ...whatIf, repayment: loan.repayment ?? "", io_years: loan.io_years ?? "" }).then((ok) => ok && setW({ ...fromLoan(), ...w, lump: 0 }))}>Save to loan</button>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="table" style={{ marginBottom: 0 }}>
          <div className="row head">
            <div className="col-head" style={{ flex: 1.3 }} />
            {changed && <div className="col-head" style={{ flex: 1, textAlign: "right" }}>What-if</div>}
            <div className="col-head" style={{ flex: 1, textAlign: "right" }}>Current plan</div>
            <div className="col-head" style={{ flex: 1, textAlign: "right" }}>Minimum only</div>
          </div>
          {compare.map(([label, f]) => (
            <div key={label} className="row">
              <div className="cell muted" style={{ flex: 1.3 }}>{label}</div>
              {changed && <div className="cell num accent" style={{ flex: 1 }} title={f(wi)}>{f(wi)}</div>}
              <div className="cell num" style={{ flex: 1 }} title={f(plan)}>{f(plan)}</div>
              <div className="cell num muted" style={{ flex: 1 }} title={f(min)}>{f(min)}</div>
            </div>
          ))}
        </div>
        <TimeChart labels={labels} series={series} height={260} tickEvery={n > 180 ? 60 : n > 60 ? 24 : 12} tickLabel={(i) => `Y${i / 12}`} />
      </div>

      <div className="section-title" style={{ marginTop: 18 }}>
        <span>{monthly ? "Monthly schedule" : "Year by year"}{changed ? " · what-if" : ""}</span>
        <button className="btn-link" onClick={() => setMonthly(!monthly)}>{monthly ? "show years" : "show months"}</button>
      </div>
      <Schedule rows={monthly ? (changed ? wi : plan).rows.map((r) => ({ ...r, label: monthLabel(r.month) }))
        : yrs.map((y) => ({ ...y, label: `Year ${y.year}`, sub: `${monthLabel(y.from)} – ${monthLabel(y.to)}` }))}
        loan={loan} taxRate={taxRate} />
    </div>
  );
}

function Schedule({ rows, loan, taxRate }) {
  const cols = [["Opening", "opening"], ["Repayment", "repayment"], ["Interest", "interest"], ["Principal", "principal"], ["Extra", "extra"], ["Closing", "closing"]];
  const total = (k) => rows.reduce((s, r) => s + r[k], 0);
  return (
    <div className="table wide" style={{ maxHeight: 420, overflowY: "auto", marginBottom: 0, "--row-min": "860px" }}>
      <div className="row head" style={{ position: "sticky", top: 0, zIndex: 1 }}>
        <div className="col-head" style={{ flex: 1.4 }}>Period</div>
        {cols.map(([l]) => <div key={l} className="col-head" style={{ flex: 1, textAlign: "right" }}>{l}</div>)}
        {loan.tax_deductible && <div className="col-head" style={{ flex: 1, textAlign: "right" }}>Tax saving</div>}
      </div>
      {rows.map((r) => (
        <div key={r.label} className="row data">
          <div className="cell" style={{ flex: 1.4 }}>{r.label}{r.sub && <span className="mono" style={{ marginLeft: 8, fontSize: "0.68rem", color: "var(--text-muted)" }}>{r.sub}</span>}</div>
          {cols.map(([l, k]) => (
            <div key={l} className={`cell num${k === "closing" ? " accent" : k === "repayment" && r.belowMin ? " warn" : ""}`} style={{ flex: 1 }}
              title={k === "repayment" && r.belowMin ? "Minimum repayment paid: your fixed amount is below it" : undefined}>{acct(r[k])}</div>
          ))}
          {loan.tax_deductible && <div className="cell num ok" style={{ flex: 1 }}>{acct(-taxSaving(loan, r.interest, taxRate))}</div>}
        </div>
      ))}
      <div className="row total" style={{ position: "sticky", bottom: 0 }}>
        <div className="cell" style={{ flex: 1.4 }}>Total</div>
        <div style={{ flex: 1 }} />
        {["repayment", "interest", "principal", "extra"].map((k) => <div key={k} className="cell num" style={{ flex: 1 }}>{acct(total(k))}</div>)}
        <div style={{ flex: 1 }} />
        {loan.tax_deductible && <div className="cell num ok" style={{ flex: 1 }}>{acct(-taxSaving(loan, total("interest"), taxRate))}</div>}
      </div>
    </div>
  );
}

// ── Add / edit
function LoanForm({ draft, onClose, onSave }) {
  const [d, setD] = useState(draft);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const s = schedule({ ...d, repayment: d.repayment === "" ? null : d.repayment }, START);
  const io = d.repayment_type === "io";
  const ioMonths = io ? (d.io_years === "" ? Infinity : Math.round(num(d.io_years) * 12)) : 0;
  const calcRepay = io && ioMonths > 0 ? s.rows[0]?.interest ?? 0 : pmt(num(d.rate), Math.round(num(d.term_years) * 12), num(d.balance));
  const freqDiv = (FREQS.find(([k]) => k === d.repayment_freq)?.[2] ?? 12) / 12;
  const setEvent = (i, k, v) => setD({ ...d, events: d.events.map((e, j) => (j === i ? { ...e, [k]: v } : e)) });
  const valid = d.name.trim() && num(d.balance) > 0 && num(d.term_years) > 0;

  return (
    <Modal title={d.id ? `Edit ${draft.name}` : "Add loan"} eyebrow={d.id ? "edit_loan" : "new_loan"} onClose={onClose} width={640}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="field"><label>Name</label><input value={d.name} onChange={set("name")} className="input" autoFocus /></div>
        <div className="grid-3">
          <div className="field"><label>Balance owed today <span className="hint">$</span></label><input type="number" min="0" value={d.balance} onChange={set("balance")} className="input num" /></div>
          <div className="field"><label>Interest rate <span className="hint">%</span></label><input type="number" step="0.01" min="0" value={d.rate} onChange={set("rate")} className="input num" /></div>
          <div className="field"><label>Term remaining <span className="hint">years</span></label><input type="number" step="0.5" min="0" value={d.term_years} onChange={set("term_years")} className="input num" /></div>
        </div>
        <div className="grid-3">
          <div className="field"><label>Repayments</label>
            <select value={d.repayment_type} onChange={set("repayment_type")} className="input">
              <option value="pi">Principal &amp; interest</option><option value="io">Interest only</option>
            </select>
          </div>
          {io ? (
            <div className="field"><label>Interest only for <span className="hint">years</span></label><input type="number" step="0.5" min="0" value={d.io_years} onChange={set("io_years")} placeholder="whole term" className="input num" /></div>
          ) : <div />}
          <div className="field"><label>Offset balance <span className="hint">$</span></label><input type="number" min="0" value={d.offset_balance} onChange={set("offset_balance")} className="input num" /></div>
        </div>
        <div className="grid-2">
          <div className="field"><label>Regular repayment <span className="hint">blank = calculated</span></label>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="number" min="0" value={d.repayment} onChange={set("repayment")} placeholder={acct(calcRepay / freqDiv, true)} className="input num" />
              <select value={d.repayment_freq} onChange={set("repayment_freq")} className="input" style={{ width: 130 }}>{FREQS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </div>
          </div>
          <div className="field"><label>Extra repayment</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="number" min="0" value={d.extra} onChange={set("extra")} className="input num" />
              <select value={d.extra_freq} onChange={set("extra_freq")} className="input" style={{ width: 130 }}>{FREQS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            </div>
          </div>
        </div>
        <label className="toggle view on" style={{ fontSize: "0.75rem" }}>
          <input type="checkbox" checked={!!d.tax_deductible} onChange={set("tax_deductible")} />
          Interest is tax deductible
        </label>

        <div>
          <div className="section-title" style={{ marginBottom: 8 }}>
            <span>Future changes</span>
            <button className="btn-link" onClick={() => setD({ ...d, events: [...d.events, { month: monthKey(START, 12), type: "rate", value: "" }] })}>+ add change</button>
          </div>
          {d.events.length === 0 && <p className="hint-line" style={{ margin: 0 }}>// rate changes, offset changes or lump sums from a given month</p>}
          {d.events.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input type="month" value={e.month} onChange={(ev) => setEvent(i, "month", ev.target.value)} className="input" style={{ width: 160 }} />
              <select value={e.type} onChange={(ev) => setEvent(i, "type", ev.target.value)} className="input">{EVENT_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <input type="number" value={e.value ?? ""} onChange={(ev) => setEvent(i, "value", ev.target.value)} placeholder={EVENT_TYPES.find(([k]) => k === e.type)?.[2]} className="input num" style={{ width: 140 }} />
              <button className="btn btn-danger btn-icon" style={{ flex: "none", alignSelf: "center" }} aria-label="Remove change" onClick={() => setD({ ...d, events: d.events.filter((_, j) => j !== i) })}>{"✕"}</button>
            </div>
          ))}
        </div>

        <div className="field"><label>Notes</label><input value={d.notes || ""} onChange={set("notes")} className="input" /></div>

        {valid && (
          <p className="hint-line" style={{ margin: 0 }}>
            // {acct(perMonth(d.extra, d.extra_freq) + (s.rows[0]?.repayment ?? 0))}/month · total interest {acct(s.totalInterest)} · {s.paidOff ? `paid off ${monthLabel(s.payoffMonth)}` : `${acct(s.endBalance)} owed at term end`}
          </p>
        )}
        {valid && s.belowMinFrom && <p className="warn-line" style={{ margin: 0 }}>{belowMinText(s)}</p>}
      </div>
      <div className="modal-actions">
        <button onClick={onClose} className="btn btn-ghost">Cancel</button>
        <button onClick={() => onSave(d)} className="btn btn-primary" disabled={!valid}>Save</button>
      </div>
    </Modal>
  );
}
