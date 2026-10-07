import { useState } from "react";
import { supabase } from "../lib/supabase.js";
import { has } from "../lib/format.js";
import { SortHeader, nextSort, sortBy, PageHead, Modal, FilterInput } from "../components/ui.jsx";

const COL = { name: 2, number: 1, client: 1, actions: 90 };
const NO_FILTERS = { name: "", number: "", client: "" };

export default function ProjectLibrary({ projects, setProjects }) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [client, setClient] = useState("");
  const [sort, setSort] = useState({ field: null, dir: "asc" });
  const [filters, setFilters] = useState(NO_FILTERS);
  const [editing, setEditing] = useState(null);

  const add = async () => {
    if (!name.trim()) return;
    const [created] = await supabase.from("projects").insert({ name: name.trim(), number: number.trim(), client: client.trim() }).catch(() => []);
    if (!created) return;
    setProjects((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    setName(""); setNumber(""); setClient("");
  };

  const save = async (p) => {
    const [updated] = await supabase.from("projects").update({ name: p.name.trim(), number: (p.number || "").trim(), client: (p.client || "").trim() }, p.id).catch(() => []);
    if (!updated) return;
    setProjects((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
    setEditing(null);
  };

  // A project can only be deleted once nothing else refers to it, so time
  // entries and inspection reports are never orphaned. Open tasks (and their
  // notes) are deleted with it after confirmation.
  const remove = async (p) => {
    try {
      const [ts, reports, tasks] = await Promise.all([
        supabase.from("timesheet").count(`project_id=eq.${p.id}`),
        supabase.from("inspection_reports").count(`project_id=eq.${p.id}`),
        supabase.query("tasks", { filters: `?select=id&project_id=eq.${p.id}` }),
      ]);
      if (ts || reports) {
        window.alert(`"${p.name}" can't be deleted: it has ${ts} time entr${ts === 1 ? "y" : "ies"} and ${reports} inspection report${reports === 1 ? "" : "s"}.`);
        return;
      }
      const msg = tasks.length ? `Delete "${p.name}" and its ${tasks.length} open task${tasks.length === 1 ? "" : "s"}?` : `Delete "${p.name}"?`;
      if (!window.confirm(msg)) return;
      if (tasks.length) {
        const ids = tasks.map((t) => t.id).join(",");
        await supabase.from("task_notes").deleteWhere(`task_id=in.(${ids})`);
        await supabase.from("tasks").deleteWhere(`project_id=eq.${p.id}`);
      }
      await supabase.from("projects").delete(p.id);
      setProjects((prev) => prev.filter((x) => x.id !== p.id));
    } catch { /* shown by toast */ }
  };

  const shown = sortBy(projects.filter((p) => Object.keys(filters).every((f) => has(p[f], filters[f]))), sort, (p, f) => p[f]);
  const hasFilters = Object.values(filters).some(Boolean);
  const onSort = (f) => setSort((s) => nextSort(s, f));
  const enter = (e) => { if (e.key === "Enter") add(); };

  return (
    <>
      <PageHead eyebrow="project_library" title="Project Library">
        <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{projects.length} projects</span>
      </PageHead>

      <div className="row entry">
        <div style={{ flex: COL.name }}><input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={enter} placeholder="Project name" className="input" /></div>
        <div style={{ flex: COL.number }}><input value={number} onChange={(e) => setNumber(e.target.value)} onKeyDown={enter} placeholder="Project number" className="input" /></div>
        <div style={{ flex: COL.client }}><input value={client} onChange={(e) => setClient(e.target.value)} onKeyDown={enter} placeholder="Client" className="input" /></div>
        <div style={{ width: COL.actions, flex: "none", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={add} className="btn btn-primary" disabled={!name.trim()}>Add</button>
        </div>
      </div>

      <div className="table">
        <div className="row head">
          <SortHeader label="Project name" field="name" sort={sort} onSort={onSort} style={{ flex: COL.name }} />
          <SortHeader label="Number" field="number" sort={sort} onSort={onSort} style={{ flex: COL.number }} />
          <SortHeader label="Client" field="client" sort={sort} onSort={onSort} style={{ flex: COL.client }} />
          <div style={{ width: COL.actions, flex: "none" }} />
        </div>
        <div className="row filters">
          <div style={{ flex: COL.name }}><FilterInput value={filters.name} onChange={(v) => setFilters({ ...filters, name: v })} /></div>
          <div style={{ flex: COL.number }}><FilterInput value={filters.number} onChange={(v) => setFilters({ ...filters, number: v })} /></div>
          <div style={{ flex: COL.client }}><FilterInput value={filters.client} onChange={(v) => setFilters({ ...filters, client: v })} /></div>
          <div style={{ width: COL.actions, flex: "none", textAlign: "right" }}>
            {hasFilters && <button onClick={() => setFilters(NO_FILTERS)} className="btn-link">clear</button>}
          </div>
        </div>
        {shown.map((p) => (
          <div key={p.id} className="row data">
            <div className="cell strong" style={{ flex: COL.name }}>{p.name}</div>
            <div className="cell mono" style={{ flex: COL.number }}>{p.number}</div>
            <div className="cell muted" style={{ flex: COL.client }}>{p.client}</div>
            <div className="cell actions" style={{ width: COL.actions }}>
              <button onClick={() => setEditing({ ...p })} className="btn btn-sm btn-outline">Edit</button>
              <button onClick={() => remove(p)} className="btn btn-danger btn-icon" aria-label="Delete">{"✕"}</button>
            </div>
          </div>
        ))}
        {shown.length === 0 && <div className="empty">{hasFilters ? "no projects match filters" : "no projects yet"}</div>}
      </div>

      {editing && (
        <Modal title="Edit project" eyebrow="edit_project" onClose={() => setEditing(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field"><label>Project name</label><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="input" /></div>
            <div className="field"><label>Project number</label><input value={editing.number || ""} onChange={(e) => setEditing({ ...editing, number: e.target.value })} className="input" /></div>
            <div className="field"><label>Client</label><input value={editing.client || ""} onChange={(e) => setEditing({ ...editing, client: e.target.value })} className="input" /></div>
          </div>
          <div className="modal-actions">
            <button onClick={() => setEditing(null)} className="btn btn-ghost">Cancel</button>
            <button onClick={() => save(editing)} className="btn btn-primary" disabled={!editing.name.trim()}>Save</button>
          </div>
        </Modal>
      )}
    </>
  );
}
