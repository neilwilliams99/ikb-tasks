// ISO date (yyyy-mm-dd) → dd/mm/yy
export function formatDate(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const money = (x) => "$" + (Number(x) || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Accounting style: whole dollars, negatives in brackets, never a minus sign
export const acct = (x, cents = false) => {
  const n = Number(x) || 0;
  const s = "$" + Math.abs(n).toLocaleString("en-AU", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
  return n < 0 && Math.abs(n) >= (cents ? 0.005 : 0.5) ? `(${s})` : s;
};

export const num = (x) => {
  const n = parseFloat(x);
  return isFinite(n) ? n : 0;
};

// Case-insensitive "contains" used by all the column filters
export const has = (value, q) => !q || String(value ?? "").toLowerCase().includes(q.toLowerCase());

// ISO timestamp → dd/mm/yy in local time. Unlike formatDate this takes a full
// timestamptz, so it must not be sliced to 10 chars first: that would read the
// UTC date and show the wrong day for anything stamped late in the evening.
export function formatStamp(ts) {
  if (!ts) return "";
  const dt = new Date(ts);
  if (isNaN(dt)) return "";
  return dt.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
