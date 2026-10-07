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

export const num = (x) => {
  const n = parseFloat(x);
  return isFinite(n) ? n : 0;
};

// Case-insensitive "contains" used by all the column filters
export const has = (value, q) => !q || String(value ?? "").toLowerCase().includes(q.toLowerCase());
