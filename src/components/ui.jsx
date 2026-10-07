import { useState, useEffect, useRef } from "react";

// ─── SEARCHABLE DROPDOWN ───────────────────────────────────────────────────
// Type to search, arrow keys + Enter to pick, Esc to close.
export function SearchableDropdown({ options, value, onChange, placeholder = "Search project", displayKey = "name", subKey = "number", autoFocus }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [hl, setHl] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = search.toLowerCase();
  const filtered = options.filter((o) => `${o[displayKey] || ""} ${o[subKey] || ""}`.toLowerCase().includes(q));
  const pick = (o) => { onChange(o); setOpen(false); setSearch(""); };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHl((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHl((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && open && filtered[hl]) { e.preventDefault(); e.stopPropagation(); pick(filtered[hl]); }
    else if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
  };

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <input type="text" className="input" autoFocus={autoFocus}
        value={open ? search : value?.[displayKey] || ""} placeholder={placeholder}
        onFocus={() => { setOpen(true); setSearch(""); setHl(0); }}
        onChange={(e) => { setSearch(e.target.value); setHl(0); setOpen(true); }}
        onKeyDown={onKeyDown} />
      {open && (
        <div className="dropdown">
          {filtered.length === 0 && <div className="dropdown-empty">no matches</div>}
          {filtered.map((o, i) => (
            <div key={o.id ?? i} className={`dropdown-item${i === hl ? " hl" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setHl(i)}>
              {o[displayKey]}{o[subKey] && <span className="sub">{o[subKey]}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SORT HEADER ───────────────────────────────────────────────────────────
export function SortHeader({ label, field, sort, onSort, style, align }) {
  const active = sort.field === field;
  return (
    <div className={`col-head${active ? " active" : ""}`} onClick={() => onSort(field)}
      style={{ ...style, textAlign: align }}>
      {label}{active ? (sort.dir === "asc" ? " ▴" : " ▾") : ""}
    </div>
  );
}

// Click once = asc, again = desc, third time = off (back to manual order)
export const nextSort = (prev, field) =>
  prev.field !== field ? { field, dir: "asc" } : prev.dir === "asc" ? { field, dir: "desc" } : { field: null, dir: "asc" };

export function sortBy(arr, sort, getVal) {
  if (!sort.field) return arr;
  const d = sort.dir === "asc" ? 1 : -1;
  return [...arr].sort((a, b) => {
    const va = getVal(a, sort.field), vb = getVal(b, sort.field);
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * d;
    const sa = (va ?? "").toString().toLowerCase(), sb = (vb ?? "").toString().toLowerCase();
    if (!sa && sb) return 1;   // blanks always last
    if (sa && !sb) return -1;
    return sa.localeCompare(sb, undefined, { numeric: true }) * d;
  });
}

// ─── PAGE HEAD ─────────────────────────────────────────────────────────────
export function PageHead({ eyebrow, title, children }) {
  return (
    <div className="page-head">
      <div>
        <span className="eyebrow">// {eyebrow}</span>
        <h1 className="page-title">{title}</h1>
      </div>
      {children && <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>{children}</div>}
    </div>
  );
}

// ─── MODAL ─────────────────────────────────────────────────────────────────
export function Modal({ title, eyebrow, children, onClose, width }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal-dialog" style={width ? { maxWidth: width } : undefined} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            {eyebrow && <span className="eyebrow">// {eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">{"✕"}</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── FILTER INPUT ──────────────────────────────────────────────────────────
export function FilterInput({ value, onChange }) {
  return <input className="filter-input" placeholder="filter" value={value} onChange={(e) => onChange(e.target.value)} />;
}
