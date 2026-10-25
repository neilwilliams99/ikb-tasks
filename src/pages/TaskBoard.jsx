import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import { formatDate, formatStamp, today, has } from "../lib/format.js";
import { SearchableDropdown, SortHeader, nextSort, sortBy, PageHead, Modal, FilterInput } from "../components/ui.jsx";
import { isMailDrag, messagesFrom, emailUrl } from "../lib/maildrop.js";

// Column widths — shared across header, filter, entry and data rows
const COL = { project: 1.5, number: 80, client: 0.7, date: 96, task: 2, actions: 232 };
const NO_FILTERS = { project: "", number: "", client: "", date: "", description: "" };
const ignore = () => {}; // errors are already shown by the supabase toast

// `projects` is every project, used to show a task's project name even once
// that project has been archived. `pickable` leaves the archived ones out, so
// they cannot be chosen for new or edited tasks.
export default function TaskBoard({ projects, pickable }) {
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
  const [showDone, setShowDone] = useState(false);

  const dragFrom = useRef(null);                  // task id being dragged, not a row index
  const [dragOver, setDragOver] = useState(null); // task id being hovered

  const [mailOver, setMailOver] = useState(false);        // an email is being dragged over the page
  const [maildrop, setMaildrop] = useState(null);         // messages dropped, waiting on the dialog
  const mailDepth = useRef(0);                            // enter/leave nest as the cursor crosses children

  useEffect(() => {
    Promise.all([
      supabase.from("tasks").select("order=sort_order.asc"),
      supabase.from("task_notes").select("order=created_at.asc"),
    ]).then(([t, n]) => { setTasks(t); setNotes(n); }).catch(ignore).finally(() => setLoading(false));
  }, []);

  // ── Drop an email anywhere on the board to start a task from its subject ──
  // Listening on the window rather than a drop zone keeps the whole page a
  // target. Every handler bails out unless the drag is an email, so dragging
  // a row to reorder it and dragging a file in from the desktop both behave
  // exactly as they did before.
  useEffect(() => {
    const enter = (e) => { if (!isMailDrag(e.dataTransfer)) return; mailDepth.current += 1; setMailOver(true); };
    const over = (e) => {
      if (!isMailDrag(e.dataTransfer)) return;
      e.preventDefault();                      // without this the browser refuses the drop
      e.dataTransfer.dropEffect = "copy";
    };
    const leave = (e) => {
      if (!isMailDrag(e.dataTransfer)) return;
      mailDepth.current = Math.max(0, mailDepth.current - 1);
      if (mailDepth.current === 0) setMailOver(false);
    };
    const drop = (e) => {
      if (!isMailDrag(e.dataTransfer)) return;
      e.preventDefault();
      mailDepth.current = 0; setMailOver(false);
      const dropped = messagesFrom(e.dataTransfer);
      if (dropped.messages.length) setMaildrop(dropped);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);

  const projectOf = (t) => projects.find((p) => p.id === t.project_id);
  const noteCount = {};
  notes.forEach((n) => { if (!n.checked) noteCount[n.task_id] = (noteCount[n.task_id] || 0) + 1; });

  const open = tasks.filter((t) => !t.completed_at);
  const doneCount = tasks.length - open.length;

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

  // One insert for the whole drop, so a drag of several emails either lands
  // completely or not at all and cannot half-create tasks on a retry.
  const addFromMail = async (rows, project, date, mailbox) => {
    const base = tasks.reduce((m, t) => Math.max(m, t.sort_order ?? 0), -1);
    const created = await supabase.from("tasks").insert(
      rows.map(({ description, subject, itemId }, i) => ({
        project_id: project.id, due_date: date || null, description, sort_order: base + 1 + i, on_hold: false, priority: false,
        email_item_id: itemId, email_mailbox: itemId ? mailbox : null, email_subject: subject,
      })),
    ).catch(() => []);
    if (!created.length) return false;
    setTasks((prev) => [...prev, ...created]);
    setMaildrop(null);
    return true;
  };

  const patch = async (task, fields) => {
    const [updated] = await supabase.from("tasks").update(fields, task.id).catch(() => []);
    if (updated) setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...updated } : t)));
    return updated;
  };

  const saveEdit = async (t) => {
    if (await patch(t, { project_id: t.project_id, due_date: t.due_date || null, description: t.description.trim() })) setEditing(null);
  };

  // Done and Restore are the same stamp, set and cleared. Status notes are
  // deliberately left alone, so a restored task comes back with its history.
  const complete = (task) => patch(task, { completed_at: new Date().toISOString() });
  const restore = (task) => patch(task, { completed_at: null });

  // The only hard delete left, and only reachable from the completed view.
  // task_notes.task_id references tasks.id, so the notes have to go first.
  const destroy = async (task) => {
    if (!window.confirm(`Permanently delete this task and its status notes?\n\n${task.description}\n\nThis cannot be undone.`)) return;
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
    (showDone ? tasks : open).filter((t) => Object.keys(filters).every((f) => has(f === "date" ? formatDate(val(t, f)) : val(t, f), filters[f]))),
    sort, val,
  );
  const hasFilters = Object.values(filters).some(Boolean);
  // Reordering only makes sense against the full open list in its stored order.
  const canDrag = !sort.field && !hasFilters && !showDone;

  // ── Drag to reorder ──
  // Rows are identified by id, not by row position: the rendered list is a
  // subset of `tasks` once completed tasks are hidden, so row positions do not
  // line up with the positions in `tasks` that sort_order is numbered from.
  const onDrop = async (toId) => {
    const fromId = dragFrom.current;
    dragFrom.current = null; setDragOver(null);
    if (!canDrag || fromId === null || fromId === toId) return;
    const from = tasks.findIndex((t) => t.id === fromId);
    const to = tasks.findIndex((t) => t.id === toId);
    if (from === -1 || to === -1) return;

    const items = [...tasks];
    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);
    const reordered = items.map((t, i) => ({ ...t, sort_order: i }));

    const before = new Map(tasks.map((t) => [t.id, t.sort_order]));
    const changed = reordered.filter((t) => before.get(t.id) !== t.sort_order);
    const previous = tasks;
    setTasks(reordered);
    try {
      await Promise.all(changed.map((t) => supabase.from("tasks").update({ sort_order: t.sort_order }, t.id)));
    } catch {
      setTasks(previous); // put it back if the save failed
    }
  };

  const now = today();

  return (
    <>
      <PageHead eyebrow="task_board" title="Task Board">
        <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
          {open.length} open · {open.filter((t) => t.priority).length} priority · {open.filter((t) => t.on_hold).length} on hold
        </span>
        <label className={`toggle view${showDone ? " on" : ""}`}>
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Show completed{doneCount ? ` (${doneCount})` : ""}
        </label>
      </PageHead>

      {/* New task */}
      <div className="row entry">
        <div style={{ width: 24, flex: "none" }} />
        <div style={{ flex: COL.project, minWidth: 0 }}><SearchableDropdown options={pickable} value={selProject} onChange={setSelProject} /></div>
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

        {shown.map((t) => {
          const p = projectOf(t);
          const done = !!t.completed_at;
          const overdue = t.due_date && t.due_date < now && !t.on_hold && !done;
          return (
            <div key={t.id}
              className={`row data${done ? " done" : ""}${t.on_hold && !done ? " hold" : ""}${t.priority && !done ? " priority" : ""}${dragOver === t.id ? " drop-target" : ""}`}
              draggable={canDrag}
              onDragStart={(e) => { dragFrom.current = t.id; e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => { if (canDrag) { e.preventDefault(); setDragOver(t.id); } }}
              onDragLeave={() => setDragOver((d) => (d === t.id ? null : d))}
              onDragEnd={() => { dragFrom.current = null; setDragOver(null); }}
              onDrop={(e) => { e.preventDefault(); onDrop(t.id); }}>
              <div className={`grip${canDrag ? "" : " disabled"}`} title={canDrag ? "Drag to reorder" : "Clear sorting, filters and Show completed to reorder"}>{"⠇"}</div>
              <div className="cell strong" style={{ flex: COL.project }}>{p?.name || "—"}</div>
              <div className="cell fixed mono" style={{ width: COL.number }}>{p?.number || "—"}</div>
              <div className="cell muted" style={{ flex: COL.client }}>{p?.client || "—"}</div>
              <div className={`cell fixed mono${overdue ? " overdue" : ""}`} style={{ width: COL.date }} title={overdue ? "Overdue" : undefined}>{formatDate(t.due_date) || "—"}</div>
              <div className="cell clickable" style={{ flex: COL.task }} onClick={() => setNotesFor(t)} title="Status notes">
                {/* The title shows the subject the task was raised from, which is worth
                    seeing even when the description has been reworded past recognition.
                    stopPropagation so the envelope does not also open the notes. */}
                {t.email_item_id && (
                  <a className="mail-link" href={emailUrl(t.email_item_id)} target="_blank" rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title={t.email_subject ? `Open the email: ${t.email_subject}` : "Open the email this task came from"}
                    aria-label="Open the email this task came from">{"✉"}</a>
                )}
                <span className="cell">{t.description}</span>
                {done && <span className="mono" style={{ flex: "none", fontSize: "0.68rem", color: "var(--text-muted)" }}>done {formatStamp(t.completed_at)}</span>}
                {noteCount[t.id] > 0 && <span className="badge">{noteCount[t.id]}</span>}
              </div>
              <div className="cell actions" style={{ width: COL.actions }}>
                {done ? (
                  <>
                    <button onClick={() => restore(t)} className="btn btn-sm btn-outline">Restore</button>
                    <button onClick={() => destroy(t)} className="btn btn-danger btn-icon" aria-label="Delete permanently" title="Delete permanently">{"✕"}</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => patch(t, { priority: !t.priority })} className={`btn btn-sm btn-danger${t.priority ? " on" : ""}`}>Priority</button>
                    <button onClick={() => patch(t, { on_hold: !t.on_hold })} className={`btn btn-sm btn-ghost${t.on_hold ? " on" : ""}`}>Hold</button>
                    <button onClick={() => setEditing({ ...t })} className="btn btn-sm btn-outline">Edit</button>
                    <button onClick={() => complete(t)} className="btn btn-sm btn-primary" title="Mark done and hide">Done</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {shown.length === 0 && (
          <div className="empty">
            {loading ? "loading…" : hasFilters ? "no tasks match filters" : showDone ? "no tasks yet" : doneCount ? "nothing open — tick Show completed" : "no tasks yet"}
          </div>
        )}
      </div>

      {editing && (
        <Modal title="Edit task" eyebrow="edit_task" onClose={() => setEditing(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field"><label>Project</label>
              <SearchableDropdown options={pickable} value={projects.find((p) => p.id === editing.project_id) || null} onChange={(p) => setEditing({ ...editing, project_id: p.id })} />
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

      {/* pointer-events stay off so the overlay never swallows the drag events */}
      {mailOver && (
        <div className="mail-drop" aria-hidden="true">
          <div className="mail-drop-card">
            <span className="eyebrow">// from_email</span>
            <strong>Drop to add a task</strong>
          </div>
        </div>
      )}

      {maildrop && (
        <MailTaskModal drop={maildrop} pickable={pickable}
          onCreate={addFromMail} onClose={() => setMaildrop(null)} />
      )}
    </>
  );
}

// The subjects arrive as the task descriptions, editable before saving: an
// email subject is rarely worded as the thing you have to do. Each one keeps
// the id of the message it came from, so the saved task can link back to it.
function MailTaskModal({ drop, pickable, onCreate, onClose }) {
  const [descs, setDescs] = useState(drop.messages.map((m) => m.subject));
  const [project, setProject] = useState(null);
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  // The subject is kept as it arrived even when the description is reworded,
  // because it is what the link searches on.
  const kept = descs
    .map((d, i) => ({ description: d.trim(), subject: drop.messages[i].subject, itemId: drop.messages[i].itemId }))
    .filter((r) => r.description);
  const ready = !!project && kept.length > 0 && !saving;
  const save = async () => {
    if (!ready) return;
    setSaving(true);
    if (!await onCreate(kept, project, date, drop.mailbox)) setSaving(false); // error is already on a toast
  };
  const setDesc = (i, v) => setDescs((prev) => prev.map((d, j) => (j === i ? v : d)));

  return (
    <Modal eyebrow="from_email" onClose={onClose}
      title={descs.length === 1 ? "New task from email" : `New tasks from ${descs.length} emails`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="field"><label>Project</label>
          <SearchableDropdown options={pickable} value={project} onChange={setProject} autoFocus />
        </div>
        <div className="field"><label>Due date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </div>
        <div className="field"><label>{descs.length === 1 ? "Task" : "Tasks"}</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
            {descs.map((d, i) => (
              <input key={i} value={d} onChange={(e) => setDesc(i, e.target.value)} className="input"
                onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
            ))}
          </div>
        </div>
      </div>
      <div className="modal-actions">
        <button onClick={onClose} className="btn btn-ghost">Cancel</button>
        <button onClick={save} className="btn btn-primary" disabled={!ready}>
          {kept.length > 1 ? `Add ${kept.length} tasks` : "Add task"}
        </button>
      </div>
    </Modal>
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
