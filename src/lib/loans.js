// ─── LOAN SCHEDULES ────────────────────────────────────────────────────────
// Month-by-month amortisation, looking forward from the current month: month 0
// is this month and every loan's balance, offset and term are as they stand
// today. Follows Neil's "Loan Calculator" spreadsheet:
//   - repayments and extra repayments are converted to a monthly amount
//     (weekly × 52/12, fortnightly × 26/12)
//   - interest is charged monthly on balance − offset − that month's extra
//   - a P&I repayment left blank is the standard repayment for the balance
//     over the remaining term; interest-only pays the month's interest
// and fixes the sheet's slips: repayments stop once a loan is paid off, the
// last payment is only what is owed, and interest-only loans report the
// balance still owed at the end of the term instead of #N/A.
// Every amount here is a positive figure in its natural sense (balance owed,
// interest charged, repayment made); the page decides how to present them.

export const FREQS = [
  ["weekly", "Weekly", 52],
  ["fortnightly", "Fortnightly", 26],
  ["monthly", "Monthly", 12],
];
export const perMonth = (amount, freq) => ((Number(amount) || 0) * (FREQS.find(([k]) => k === freq)?.[2] ?? 12)) / 12;

export const EVENT_TYPES = [
  ["rate", "Rate change", "new rate %"],
  ["offset", "Offset balance", "new offset $"],
  ["lump", "Lump sum payment", "amount $"],
];

const MAX_MONTHS = 50 * 12;

// Standard repayment (Excel PMT, as a positive amount)
export function pmt(annualRate, months, balance) {
  if (months <= 0) return balance;
  const r = annualRate / 100 / 12;
  return r === 0 ? balance / months : (balance * r) / (1 - Math.pow(1 + r, -months));
}

// "YYYY-MM" for month index i counted from `start` (a Date)
export function monthKey(start, i) {
  const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-AU", { month: "short", year: "numeric" });
}
// Months from `start` to "YYYY-MM" (negative if before)
export function monthsUntil(start, key) {
  const [y, m] = key.split("-").map(Number);
  return (y - start.getFullYear()) * 12 + (m - 1 - start.getMonth());
}

// opts.baseline: no extra repayments, offset or lump sums — "what if I only
// paid the minimum", for the savings comparison.
export function schedule(loan, start = new Date(), { baseline = false } = {}) {
  const termMonths = Math.min(MAX_MONTHS, Math.max(1, Math.round((Number(loan.term_years) || 0) * 12)));
  const ioMonths = loan.repayment_type === "io"
    ? (loan.io_years == null || loan.io_years === "" ? termMonths : Math.round(Number(loan.io_years) * 12))
    : 0;
  const fixed = loan.repayment === null || loan.repayment === "" || loan.repayment === undefined
    ? null : perMonth(loan.repayment, loan.repayment_freq);
  const events = (loan.events || [])
    .map((e) => ({ ...e, at: monthsUntil(start, e.month) }))
    .filter((e) => !(baseline && (e.type === "offset" || e.type === "lump")));

  let balance = Number(loan.balance) || 0;
  let rate = Number(loan.rate) || 0;
  let offset = baseline ? 0 : Number(loan.offset_balance) || 0;
  const extraPm = baseline ? 0 : perMonth(loan.extra, loan.extra_freq);
  let calcPmt = null; // set when P&I starts and on each rate change
  const rows = [];

  for (let i = 0; i < termMonths && balance > 0.005; i++) {
    let rateChanged = i === ioMonths;
    for (const e of events) {
      if (e.at !== i && !(i === 0 && e.at < 0)) continue; // past events apply from today
      if (e.type === "rate") { rate = Number(e.value) || 0; rateChanged = true; }
      if (e.type === "offset") offset = Number(e.value) || 0;
    }
    const io = i < ioMonths;
    if (!io && (calcPmt === null || rateChanged)) calcPmt = pmt(rate, termMonths - i, balance);

    const opening = balance;
    const lump = events.filter((e) => e.type === "lump" && e.at === i).reduce((s, e) => s + (Number(e.value) || 0), 0);
    const extraPlanned = extraPm + lump;
    const interest = Math.max(0, opening - offset - extraPlanned) * (rate / 100 / 12);
    let repayment = io ? (fixed ?? interest) : (fixed ?? calcPmt);
    repayment = Math.min(repayment, opening + interest);
    const principal = repayment - interest; // negative if a fixed payment doesn't cover the interest
    const extra = Math.min(extraPlanned, Math.max(0, opening - principal));
    balance = opening - principal - extra;
    if (balance < 0.005) balance = 0;

    rows.push({ i, month: monthKey(start, i), opening, rate, offset, repayment, interest, principal, extra, closing: balance, io });
  }
  const paidOff = balance === 0;
  return {
    rows,
    paidOff,
    months: rows.length,                 // months until paid off (or to end of term)
    endBalance: balance,                 // owed at end of term if not paid off
    payoffMonth: paidOff ? rows[rows.length - 1].month : null,
    totalInterest: rows.reduce((s, r) => s + r.interest, 0),
  };
}

// Sum a field over the first n months
export const sumMonths = (rows, field, n) => rows.slice(0, n).reduce((s, r) => s + r[field], 0);

// Year-by-year roll-up (year 1 = this month and the next 11)
export function yearly(rows) {
  const out = [];
  rows.forEach((r) => {
    const y = Math.floor(r.i / 12);
    if (!out[y]) out[y] = { year: y + 1, from: r.month, to: r.month, opening: r.opening, repayment: 0, interest: 0, principal: 0, extra: 0, closing: 0 };
    const o = out[y];
    o.to = r.month; o.repayment += r.repayment; o.interest += r.interest; o.principal += r.principal; o.extra += r.extra; o.closing = r.closing;
  });
  return out;
}

// Interest × tax rate, for loans ticked as tax deductible
export const taxSaving = (loan, interest, taxRate) => (loan.tax_deductible ? interest * (Number(taxRate) || 0) / 100 : 0);
