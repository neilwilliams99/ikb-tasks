import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { formatDate, today, money, num, has } from "../lib/format.js";
import { SearchableDropdown, SortHeader, nextSort, sortBy, PageHead, Modal, FilterInput } from "../components/ui.jsx";

const COL = { project: 1.2, number: 76, client: 0.6, date: 84, desc: 1.6, units: 64, rate: 72, total: 96, actions: 90 };
const NO_FILTERS = { project: "", number: "", client: "", date: "", description: "" };

export default function TimeSheet({ projects }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState({ field: null, dir: "asc" });
  const [filters, setFilters] = useState(NO_FILTERS);
  const [editing, setEditing] = useState(null);

  const [proj, setProj] = useState(null);
  const [date, setDate] = useState(today());
  const [desc, setDesc] = useState("");
  const [units, setUnits] = useState("");
  const [rate, setRate] = useState("");

  useEffect(() => {
    supabase.from("timesheet").select("order=date.desc.nullslast,id.desc").then(setEntries).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const projectOf = (e) => projects.find((p) => p.id === e.project_id);

  const add = async () => {
    if (!proj || !desc.trim()) return;
    const [created] = await supabase.from("timesheet").insert({
      project_id: proj.id, date: date || null, description: desc.trim(), units: num(units), rate: num(rate),
    }).catch(() => []);
    if (!created) return;
    setEntries((prev) => [created, ...prev]);
    setProj(null); setDesc(""); setUnits(""); // keep date and rate for the next entry
  };

  const save = async (e) => {
    const [updated] = await supabase.from("timesheet").update({
      project_id: e.project_id, date: e.date || null, description: e.description.trim(), units: num(e.units), rate: num(e.rate),
    }, e.id).catch(() => []);
    if (!updated) return;
    setEntries((prev) => prev.map((x) => (x.id === e.id ? updated : x)));
    setEditing(null);
  };

  const remove = async (e) => {
    if (!window.confirm(`Delete this time entry?\n\n${e.description}`)) return;
    await supabase.from("timesheet").delete(e.id).then(() => setEntries((prev) => prev.filter((x) => x.id !== e.id))).catch(() => {});
  };

  const val = (e, f) => {
    const p = projectOf(e);
    return {
      project: p?.name, number: p?.number, client: p?.client, date: e.date, description: e.description,
      units: num(e.units), rate: num(e.rate), total: num(e.units) * num(e.rate),
    }[f];
  };
  const shown = sortBy(
    entries.filter((e) => Object.keys(filters).every((f) => has(f === "date" ? formatDate(val(e, f)) : val(e, f), filters[f]))),
    sort, val,
  );
  const hasFilters = Object.values(filters).some(Boolean);
  const totalUnits = shown.reduce((s, e) => s + num(e.units), 0);
  const total = shown.reduce((s, e) => s + num(e.units) * num(e.rate), 0);
  const onSort = (f) => setSort((s) => nextSort(s, f));
  const setF = (k) => (v) => setFilters({ ...filters, [k]: v });

  return (
    <>
      <PageHead eyebrow="time_sheet" title="Time Sheet" />

      {/* New entry */}
      <div className="row entry">
        <div style={{ flex: COL.project, minWidth: 0 }}><SearchableDropdown options={projects} value={proj} onChange={setProj} /></div>
        <div style={{ width: COL.number, flex: "none" }}><input readOnly value={proj?.number || ""} placeholder="No." className="input" /></div>
        <div style={{ flex: COL.client, minWidth: 0 }}><input readOnly value={proj?.client || ""} placeholder="Client" className="input" /></div>
        <div style={{ width: COL.date + 46, flex: "none" }}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" /></div>
        <div style={{ flex: COL.desc, minWidth: 0 }}><input value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="Description" className="input" /></div>
        <div style={{ width: COL.units, flex: "none" }}><input type="number" step="0.25" min="0" value={units} onChange={(e) => setUnits(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="Hrs" className="input num" /></div>
        <div style={{ width: COL.rate, flex: "none" }}><input type="number" min="0" value={rate} onChange={(e) => setRate(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="Rate" className="input num" /></div>
        <div className="cell num accent" style={{ width: COL.total, flex: "none" }}>{money(num(units) * num(rate))}</div>
        <div style={{ width: COL.actions - 46, flex: "none", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={add} className="btn btn-primary" disabled={!proj || !desc.trim()}>Add</button>
        </div>
      </div>

      <div className="table">
        <div className="row head">
          <SortHeader label="Project" field="project" sort={sort} onSort={onSort} style={{ flex: COL.project }} />
          <SortHeader label="No." field="number" sort={sort} onSort={onSort} style={{ width: COL.number, flex: "none" }} />
          <SortHeader label="Client" field="client" sort={sort} onSort={onSort} style={{ flex: COL.client }} />
          <SortHeader label="Date" field="date" sort={sort} onSort={onSort} style={{ width: COL.date, flex: "none" }} />
          <SortHeader label="Description" field="description" sort={sort} onSort={onSort} style={{ flex: COL.desc }} />
          <SortHeader label="Hrs" field="units" sort={sort} onSort={onSort} style={{ width: COL.units, flex: "none" }} align="right" />
          <SortHeader label="Rate" field="rate" sort={sort} onSort={onSort} style={{ width: COL.rate, flex: "none" }} align="right" />
          <SortHeader label="Total" field="total" sort={sort} onSort={onSort} style={{ width: COL.total, flex: "none" }} align="right" />
          <div style={{ width: COL.actions, flex: "none" }} />
        </div>

        <div className="row filters">
          <div style={{ flex: COL.project, minWidth: 0 }}><FilterInput value={filters.project} onChange={setF("project")} /></div>
          <div style={{ width: COL.number, flex: "none" }}><FilterInput value={filters.number} onChange={setF("number")} /></div>
          <div style={{ flex: COL.client, minWidth: 0 }}><FilterInput value={filters.client} onChange={setF("client")} /></div>
          <div style={{ width: COL.date, flex: "none" }}><FilterInput value={filters.date} onChange={setF("date")} /></div>
          <div style={{ flex: COL.desc, minWidth: 0 }}><FilterInput value={filters.description} onChange={setF("description")} /></div>
          <div style={{ width: COL.units + COL.rate + COL.total + 20, flex: "none" }} />
          <div style={{ width: COL.actions, flex: "none", textAlign: "right" }}>
            {hasFilters && <button onClick={() => setFilters(NO_FILTERS)} className="btn-link">clear filters</button>}
          </div>
        </div>

        {shown.map((e) => {
          const p = projectOf(e);
          return (
            <div key={e.id} className="row data">
              <div className="cell strong" style={{ flex: COL.project }}>{p?.name || "—"}</div>
              <div className="cell fixed mono" style={{ width: COL.number }}>{p?.number || "—"}</div>
              <div className="cell muted" style={{ flex: COL.client }}>{p?.client || "—"}</div>
              <div className="cell fixed mono" style={{ width: COL.date }}>{formatDate(e.date) || "—"}</div>
              <div className="cell" style={{ flex: COL.desc }} title={e.description}>{e.description}</div>
              <div className="cell fixed num" style={{ width: COL.units }}>{num(e.units)}</div>
              <div className="cell fixed num" style={{ width: COL.rate }}>{money(e.rate)}</div>
              <div className="cell fixed num accent" style={{ width: COL.total }}>{money(num(e.units) * num(e.rate))}</div>
              <div className="cell actions" style={{ width: COL.actions }}>
                <button onClick={() => setEditing({ ...e })} className="btn btn-sm btn-outline">Edit</button>
                <button onClick={() => remove(e)} className="btn btn-danger btn-icon" aria-label="Delete">{"✕"}</button>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <div className="empty">{loading ? "loading…" : hasFilters ? "no entries match filters" : "no time entries yet"}</div>}

        {shown.length > 0 && (
          <div className="row total">
            <div className="cell" style={{ flex: 1 }}>
              Total <span className="mono" style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontWeight: 400 }}>// {shown.length} entr{shown.length === 1 ? "y" : "ies"}{hasFilters ? " (filtered)" : ""}</span>
            </div>
            <div className="cell fixed num" style={{ width: COL.units }}>{totalUnits}</div>
            <div style={{ width: COL.rate, flex: "none" }} />
            <div className="cell fixed num accent" style={{ width: COL.total, fontSize: "0.86rem" }}>{money(total)}</div>
            <div style={{ width: COL.actions, flex: "none" }} />
          </div>
        )}
      </div>

      {editing && (
        <Modal title="Edit time entry" eyebrow="edit_entry" onClose={() => setEditing(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field"><label>Project</label>
              <SearchableDropdown options={projects} value={projects.find((p) => p.id === editing.project_id) || null} onChange={(p) => setEditing({ ...editing, project_id: p.id })} />
            </div>
            <div className="field"><label>Date</label>
              <input type="date" value={editing.date || ""} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className="input" />
            </div>
            <div className="field"><label>Description</label>
              <input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="input" />
            </div>
            <div className="grid-3">
              <div className="field"><label>Units <span className="hint">hrs</span></label>
                <input type="number" step="0.25" min="0" value={editing.units} onChange={(e) => setEditing({ ...editing, units: e.target.value })} className="input num" />
              </div>
              <div className="field"><label>Rate <span className="hint">$/hr</span></label>
                <input type="number" min="0" value={editing.rate} onChange={(e) => setEditing({ ...editing, rate: e.target.value })} className="input num" />
              </div>
              <div className="field"><label>Total</label>
                <input readOnly value={money(num(editing.units) * num(editing.rate))} className="input num" />
              </div>
            </div>
          </div>
          <div className="modal-actions">
            <button onClick={() => setEditing(null)} className="btn btn-ghost">Cancel</button>
            <button onClick={() => save(editing)} className="btn btn-primary" disabled={!editing.description.trim()}>Save</button>
          </div>
        </Modal>
      )}
    </>
  );
}
