import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import { formatDate, today, has } from "../lib/format.js";
import { SearchableDropdown, SortHeader, nextSort, sortBy, PageHead, Modal, FilterInput } from "../components/ui.jsx";

// Column widths — shared across header, filter, entry and data rows
const COL = { project: 1.5, number: 80, client: 0.7, date: 96, task: 2, actions: 210 };
const NO_FILTERS = { project: "", number: "", client: "", date: "", description: "" };
const ignore = () => {}; // errors are already shown by the supabase toast

export default function TaskBoard({ projects }) {
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selProject, setSelProject] = useState(null);
  const [newDate, setNewDate] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const [editing, setEditing] = useState(null);
  const [notesFor, setNotesFor] = useState(null);
  const [sort, setSort] = useState({ field: null, dir: "asc" });
  const [filters, setFilters] = useState(NO_FILTERS);

  const dragFrom = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  useEffect(() => {
    Promise.all([
      supabase.from("tasks").select("order=sort_order.asc"),
      supabase.from("task_notes").select("order=created_at.asc"),
    ]).then(([t, n]) => { setTasks(t); setNotes(n); }).catch(ignore).finally(() => setLoading(false));
  }, []);

  const projectOf = (t) => projects.find((p) => p.id === t.project_id);
  const noteCount = {};
  notes.forEach((n) => { if (!n.checked) noteCount[n.task_id] = (noteCount[n.task_id] || 0) + 1; });

  // ── CRUD ──
  const addTask = async () => {
    if (!selProject || !newDesc.trim()) return;
    const maxOrder = tasks.reduce((m, t) => Math.max(m, t.sort_order ?? 0), -1);
    const [created] = await supabase.from("tasks").insert({
      project_id: selProject.id, due_date: newDate || null, description: newDesc.trim(), sort_order: maxOrder + 1, on_hold: false, priority: false,
    }).catch(() => []);
    if (!created) return;
    setTasks((prev) => [...prev, created]);
    setSelProject(null); setNewDate(""); setNewDesc("");
  };

  const patch = async (task, fields) => {
    const [updated] = await supabase.from("tasks").update(fields, task.id).catch(() => []);
    if (updated) setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...updated } : t)));
    return updated;
  };

  const saveEdit = async (t) => {
    if (await patch(t, { project_id: t.project_id, due_date: t.due_date || null, description: t.description.trim() })) setEditing(null);
  };

  const complete = async (task) => {
    try {
      await supabase.from("task_notes").deleteWhere(`task_id=eq.${task.id}`);
      await supabase.from("tasks").delete(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setNotes((prev) => prev.filter((n) => n.task_id !== task.id));
    } catch { /* shown by toast */ }
  };

  // ── Notes ──
  const addNote = async (text) => {
    const [created] = await supabase.from("task_notes").insert({ task_id: notesFor.id, text, checked: false }).catch(() => []);
    if (created) setNotes((prev) => [...prev, created]);
  };
  const toggleNote = async (note) => {
    const [updated] = await supabase.from("task_notes").update({ checked: !note.checked }, note.id).catch(() => []);
    if (updated) setNotes((prev) => prev.map((n) => (n.id === note.id ? updated : n)));
  };
  const deleteNote = async (id) => {
    await supabase.from("task_notes").delete(id).then(() => setNotes((prev) => prev.filter((n) => n.id !== id))).catch(ignore);
  };

  // ── Filter + sort ──
  const val = (t, f) => {
    const p = projectOf(t);
    return { project: p?.name, number: p?.number, client: p?.client, date: t.due_date, description: t.description }[f];
  };
  const shown = sortBy(
    tasks.filter((t) => Object.keys(filters).every((f) => has(f === "date" ? formatDate(val(t, f)) : val(t, f), filters[f]))),
    sort, val,
  );
  const hasFilters = Object.values(filters).some(Boolean);
  const canDrag = !sort.field && !hasFilters;

  // ── Drag to reorder (only on the unsorted, unfiltered list) ──
  const onDrop = async (toIndex) => {
    const from = dragFrom.current;
    dragFrom.current = null; setDragOver(null);
    if (!canDrag || from === null || from === toIndex) return;
    const items = [...tasks];
    const [moved] = items.splice(from, 1);
    items.splice(toIndex, 0, moved);
    const reordered = items.map((t, i) => ({ ...t, sort_order: i }));
    const changed = reordered.filter((t, i) => tasks.find((o) => o.id === t.id)?.sort_order !== i);
    setTasks(reordered);
    try {
      await Promise.all(changed.map((t) => supabase.from("tasks").update({ sort_order: t.sort_order }, t.id)));
    } catch {
      setTasks(tasks); // put it back if the save failed
    }
  };

  const now = today();

  return (
    <>
      <PageHead eyebrow="task_board" title="Task Board">
        <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
          {tasks.length} task{tasks.length === 1 ? "" : "s"} · {tasks.filter((t) => t.priority).length} priority · {tasks.filter((t) => t.on_hold).length} on hold
        </span>
      </PageHead>

      {/* New task */}
      <div className="row entry">
        <div style={{ width: 24, flex: "none" }} />
        <div style={{ flex: COL.project, minWidth: 0 }}><SearchableDropdown options={projects} value={selProject} onChange={setSelProject} /></div>
        <div style={{ width: COL.number, flex: "none" }}><input readOnly value={selProject?.number || ""} placeholder="Number" className="input" /></div>
        <div style={{ flex: COL.client, minWidth: 0 }}><input readOnly value={selProject?.client || ""} placeholder="Client" className="input" /></div>
        <div style={{ width: COL.date + 30, flex: "none" }}><input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="input" /></div>
        <div style={{ flex: COL.task, minWidth: 0 }}>
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTask(); }} placeholder="Task description" className="input" />
        </div>
        <div style={{ width: COL.actions - 30, flex: "none", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={addTask} className="btn btn-primary" disabled={!selProject || !newDesc.trim()}>Add task</button>
        </div>
      </div>

      <div className="table">
        <div className="row head">
          <div style={{ width: 24, flex: "none" }} />
          <SortHeader label="Project" field="project" sort={sort} onSort={(f) => setSort((s) => nextSort(s, f))} style={{ flex: COL.project }} />
          <SortHeader label="Number" field="number" sort={sort} onSort={(f) => setSort((s) => nextSort(s, f))} style={{ width: COL.number, flex: "none" }} />
          <SortHeader label="Client" field="client" sort={sort} onSort={(f) => setSort((s) => nextSort(s, f))} style={{ flex: COL.client }} />
          <SortHeader label="Due" field="date" sort={sort} onSort={(f) => setSort((s) => nextSort(s, f))} style={{ width: COL.date, flex: "none" }} />
          <SortHeader label="Task" field="description" sort={sort} onSort={(f) => setSort((s) => nextSort(s, f))} style={{ flex: COL.task }} />
          <div style={{ width: COL.actions, flex: "none" }} />
        </div>

        <div className="row filters">
          <div style={{ width: 24, flex: "none" }} />
          <div style={{ flex: COL.project, minWidth: 0 }}><FilterInput value={filters.project} onChange={(v) => setFilters({ ...filters, project: v })} /></div>
          <div style={{ width: COL.number, flex: "none" }}><FilterInput value={filters.number} onChange={(v) => setFilters({ ...filters, number: v })} /></div>
          <div style={{ flex: COL.client, minWidth: 0 }}><FilterInput value={filters.client} onChange={(v) => setFilters({ ...filters, client: v })} /></div>
          <div style={{ width: COL.date, flex: "none" }}><FilterInput value={filters.date} onChange={(v) => setFilters({ ...filters, date: v })} /></div>
          <div style={{ flex: COL.task, minWidth: 0 }}><FilterInput value={filters.description} onChange={(v) => setFilters({ ...filters, description: v })} /></div>
          <div style={{ width: COL.actions, flex: "none", textAlign: "right" }}>
            {hasFilters && <button onClick={() => setFilters(NO_FILTERS)} className="btn-link">clear filters</button>}
          </div>
        </div>

        {shown.map((t, i) => {
          const p = projectOf(t);
          const overdue = t.due_date && t.due_date < now && !t.on_hold;
          return (
            <div key={t.id}
              className={`row data${t.on_hold ? " hold" : ""}${t.priority ? " priority" : ""}${dragOver === i ? " drop-target" : ""}`}
              draggable={canDrag}
              onDragStart={(e) => { dragFrom.current = i; e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { if (canDrag) { e.preventDefault(); setDragOver(i); } }}
              onDragLeave={() => setDragOver((d) => (d === i ? null : d))}
              onDragEnd={() => { dragFrom.current = null; setDragOver(null); }}
              onDrop={(e) => { e.preventDefault(); onDrop(i); }}>
              <div className={`grip${canDrag ? "" : " disabled"}`} title={canDrag ? "Drag to reorder" : "Clear sorting and filters to reorder"}>{"⠇"}</div>
              <div className="cell strong" style={{ flex: COL.project }}>{p?.name || "—"}</div>
              <div className="cell fixed mono" style={{ width: COL.number }}>{p?.number || "—"}</div>
              <div className="cell muted" style={{ flex: COL.client }}>{p?.client || "—"}</div>
              <div className={`cell fixed mono${overdue ? " overdue" : ""}`} style={{ width: COL.date }} title={overdue ? "Overdue" : undefined}>{formatDate(t.due_date) || "—"}</div>
              <div className="cell clickable" style={{ flex: COL.task }} onClick={() => setNotesFor(t)} title="Status notes">
                <span className="cell">{t.description}</span>
                {noteCount[t.id] > 0 && <span className="badge">{noteCount[t.id]}</span>}
              </div>
              <div className="cell actions" style={{ width: COL.actions }}>
                <button onClick={() => patch(t, { priority: !t.priority })} className={`btn btn-sm btn-danger${t.priority ? " on" : ""}`}>Priority</button>
                <button onClick={() => patch(t, { on_hold: !t.on_hold })} className={`btn btn-sm btn-ghost${t.on_hold ? " on" : ""}`}>Hold</button>
                <button onClick={() => setEditing({ ...t })} className="btn btn-sm btn-outline">Edit</button>
                <button onClick={() => complete(t)} className="btn btn-sm btn-primary" title="Mark done and remove">Done</button>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <div className="empty">{loading ? "loading…" : hasFilters ? "no tasks match filters" : "no tasks yet"}</div>}
      </div>

      {editing && (
        <Modal title="Edit task" eyebrow="edit_task" onClose={() => setEditing(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field"><label>Project</label>
              <SearchableDropdown options={projects} value={projects.find((p) => p.id === editing.project_id) || null} onChange={(p) => setEditing({ ...editing, project_id: p.id })} />
            </div>
            <div className="field"><label>Due date</label>
              <input type="date" value={editing.due_date || ""} onChange={(e) => setEditing({ ...editing, due_date: e.target.value })} className="input" />
            </div>
            <div className="field"><label>Task</label>
              <input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter" && editing.description.trim()) saveEdit(editing); }} className="input" />
            </div>
          </div>
          <div className="modal-actions">
            <button onClick={() => setEditing(null)} className="btn btn-ghost">Cancel</button>
            <button onClick={() => saveEdit(editing)} className="btn btn-primary" disabled={!editing.description.trim()}>Save</button>
          </div>
        </Modal>
      )}

      {notesFor && (
        <NotesModal task={notesFor} notes={notes.filter((n) => n.task_id === notesFor.id)}
          onAdd={addNote} onToggle={toggleNote} onDelete={deleteNote} onClose={() => setNotesFor(null)} />
      )}
    </>
  );
}

function NotesModal({ task, notes, onAdd, onToggle, onDelete, onClose }) {
  const [text, setText] = useState("");
  const add = () => { if (text.trim()) { onAdd(text.trim()); setText(""); } };
  return (
    <Modal title={task.description} eyebrow="status_notes" onClose={onClose} width={520}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="Add a status note" className="input" style={{ flex: 1 }} />
        <button onClick={add} className="btn btn-primary" disabled={!text.trim()}>Add</button>
      </div>
      <div style={{ maxHeight: 340, overflowY: "auto" }}>
        {notes.length === 0 && <div className="empty" style={{ padding: 16 }}>no notes yet</div>}
        {notes.map((n) => (
          <div key={n.id} className={`note-row${n.checked ? " done" : ""}`}>
            <input type="checkbox" checked={n.checked} onChange={() => onToggle(n)} />
            <span style={{ flex: 1 }}>{n.text}</span>
            <button onClick={() => onDelete(n.id)} className="modal-close" aria-label="Delete note">{"✕"}</button>
          </div>
        ))}
      </div>
    </Modal>
  );
}
