import { useState, useEffect, useRef } from “react”;
import Reports from “./Reports.jsx”;

// ─── CONFIG ────────────────────────────────────────────────────────────────
const SUPABASE_URL = “https://dgdpiaqabdfsgwcpxuvx.supabase.co”;
const SUPABASE_ANON_KEY = “eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnZHBpYXFhYmRmc2d3Y3B4dXZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3OTk2MDMsImV4cCI6MjA4ODM3NTYwM30.YrdDeGaKKG0GzjKnDaDQoCS0LNl4S9-xYOSldeiZ8gY”;
const LOGO_URL = “”;

const supabase = {
async query(table, { method = “GET”, body, filters = “”, headers = {} } = {}) {
const url = `${SUPABASE_URL}/rest/v1/${table}${filters}`;
const res = await fetch(url, {
method,
headers: {
apikey: SUPABASE_ANON_KEY,
Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
“Content-Type”: “application/json”,
Prefer: method === “POST” ? “return=representation” : method === “DELETE” ? “return=minimal” : “return=representation”,
…headers,
},
body: body ? JSON.stringify(body) : undefined,
});
if (method === “DELETE”) return [];
return res.json();
},
from(table) {
return {
select: (filters = “”) => supabase.query(table, { filters: `?select=*${filters ? "&" + filters : ""}` }),
insert: (body) => supabase.query(table, { method: “POST”, body }),
update: (body, id) => supabase.query(table, { method: “PATCH”, body, filters: `?id=eq.${id}`, headers: { Prefer: “return=representation” } }),
delete: (id) => supabase.query(table, { method: “DELETE”, filters: `?id=eq.${id}` }),
};
},
};

// ─── BRAND ─────────────────────────────────────────────────────────────────
const C = {
teal: “#009292”, tealDark: “#007a7a”, tealLight: “#e6f5f5”,
grey: “#595A5A”, greyLight: “#DEE0E0”, white: “#FFFFFF”,
bg: “#f4f5f5”, text: “#333333”, textMuted: “#888888”,
border: “#DEE0E0”, danger: “#d9534f”,
holdBg: “#f0f0f0”, holdText: “#aaaaaa”,
priorityBg: “#fdf0ef”, priorityText: “#c0392b”,
};

// Column widths — shared across headers, filters, rows, new-row
const COL = { grip: 24, project: “1.53”, number: 77, client: “0.67”, date: 120, task: “2”, actions: 195 };
const PCOL = { name: “2”, number: “1”, client: “1”, actions: 90 };
const TCOL = { project: “1.2”, number: 70, client: “0.6”, date: 100, desc: “1.5”, units: 60, rate: 60, total: 70, actions: 80 };

// ─── SEARCHABLE DROPDOWN ───────────────────────────────────────────────────
function SearchableDropdown({ options, value, onChange, placeholder, displayKey, style: extraStyle }) {
const [open, setOpen] = useState(false);
const [search, setSearch] = useState(””);
const ref = useRef(null);

useEffect(() => {
const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
document.addEventListener(“mousedown”, handler);
return () => document.removeEventListener(“mousedown”, handler);
}, []);

const filtered = options.filter((o) => {
const label = typeof o === “string” ? o : o[displayKey];
return label?.toLowerCase().includes(search.toLowerCase());
});
const displayValue = value ? (typeof value === “string” ? value : value[displayKey]) : “”;

return (
<div ref={ref} style={{ position: “relative”, width: “100%”, …extraStyle }}>
<input type=“text” value={open ? search : displayValue} placeholder={placeholder}
onFocus={() => { setOpen(true); setSearch(””); }}
onChange={(e) => setSearch(e.target.value)} style={S.input} />
{open && (
<div style={S.dropdown}>
{filtered.length === 0 && <div style={S.dropdownEmpty}>No matches</div>}
{filtered.map((o, i) => {
const label = typeof o === “string” ? o : o[displayKey];
return (
<div key={i} onClick={() => { onChange(o); setOpen(false); setSearch(””); }}
style={S.dropdownItem}
onMouseEnter={(e) => e.currentTarget.style.background = C.tealLight}
onMouseLeave={(e) => e.currentTarget.style.background = “transparent”}
>{label}</div>
);
})}
</div>
)}
</div>
);
}

// ─── SORT HEADER ───────────────────────────────────────────────────────────
function SortHeader({ label, field, sortField, sortDir, onSort, style }) {
const active = sortField === field;
const arrow = active ? (sortDir === “asc” ? “ \u25B2” : “ \u25BC”) : “”;
return (
<div onClick={() => onSort(field)}
style={{ …S.colHeader, …style, cursor: “pointer”, userSelect: “none”, color: active ? C.teal : C.grey }}>
{label}{arrow}
</div>
);
}

// ─── TASK ROW ──────────────────────────────────────────────────────────────
function TaskRow({ task, index, projects, onComplete, onEdit, onToggleHold, onTogglePriority, onOpenNotes, noteCount, onDragStart, onDragOver, onDrop }) {
const project = projects.find((p) => p.id === task.project_id);
const hold = task.on_hold;
const priority = task.priority;
const rowBg = hold ? C.holdBg : priority ? C.priorityBg : C.white;
const textColor = hold ? C.holdText : priority ? C.priorityText : undefined;

return (
<div draggable
onDragStart={(e) => onDragStart(e, index)}
onDragOver={(e) => { e.preventDefault(); onDragOver(e, index); }}
onDrop={(e) => onDrop(e, index)}
style={{ …S.row, background: rowBg }}
onMouseEnter={(e) => { if (!hold && !priority) e.currentTarget.style.background = C.tealLight; e.currentTarget.querySelector(’.grip’).style.opacity = 1; }}
onMouseLeave={(e) => { e.currentTarget.style.background = rowBg; e.currentTarget.querySelector(’.grip’).style.opacity = 0.25; }}
>
<div className=“grip” style={{ …S.cellFixed, width: COL.grip, color: C.textMuted, opacity: 0.25, fontSize: 18, textAlign: “center”, cursor: “grab”, userSelect: “none”, transition: “opacity 0.15s” }}>{”\u2807”}</div>
<div style={{ …S.cellFlex, flex: COL.project, color: textColor }}>{project?.name || “\u2014”}</div>
<div style={{ …S.cellFixed, width: COL.number, color: textColor || C.textMuted }}>{project?.number || “\u2014”}</div>
<div style={{ …S.cellFlex, flex: COL.client, color: textColor }}>{project?.client || “\u2014”}</div>
<div style={{ …S.cellFixed, width: COL.date, color: textColor || C.textMuted }}>{task.due_date || “\u2014”}</div>
<div
onClick={() => onOpenNotes(task)}
style={{ …S.cellFlex, flex: COL.task, color: textColor, cursor: “pointer”, display: “flex”, alignItems: “center”, gap: 6 }}
>
<span style={{ overflow: “hidden”, textOverflow: “ellipsis”, whiteSpace: “nowrap” }}>{task.description}</span>
{noteCount > 0 && <span style={{ fontSize: 10, background: C.teal, color: C.white, borderRadius: 10, padding: “1px 6px”, fontWeight: 700, flexShrink: 0 }}>{noteCount}</span>}
</div>
<div style={{ …S.cellFixed, width: COL.actions, display: “flex”, gap: 5, justifyContent: “flex-end” }}>
<button onClick={() => onTogglePriority(task)} style={priority ? S.priorityBtnActive : S.priorityBtn}>Priority</button>
<button onClick={() => onToggleHold(task)} style={hold ? S.holdBtnActive : S.holdBtn}>Hold</button>
<button onClick={() => onEdit(task)} style={S.editBtn}>Edit</button>
<button onClick={() => onComplete(task.id)} style={S.doneBtn}>Done</button>
</div>
</div>
);
}

// ─── MODAL ─────────────────────────────────────────────────────────────────
function Modal({ title, children, onClose }) {
return (
<div style={S.overlay} onClick={onClose}>
<div style={S.modal} onClick={(e) => e.stopPropagation()}>
<div style={S.modalHeader}>
<h2 style={S.modalTitle}>{title}</h2>
<button onClick={onClose} style={S.modalClose}>{”\u2715”}</button>
</div>
{children}
</div>
</div>
);
}

// ─── EDIT TASK MODAL ───────────────────────────────────────────────────────
function EditTaskModal({ task, projects, onSave, onClose }) {
const [data, setData] = useState({ …task });
const selProject = projects.find((p) => p.id === data.project_id) || null;
return (
<Modal title="Edit Task" onClose={onClose}>
<div style={{ display: “flex”, flexDirection: “column”, gap: 12 }}>
<SearchableDropdown options={projects} value={selProject}
onChange={(p) => setData({ …data, project_id: p.id })}
placeholder=“Search project” displayKey=“name” />
<input type=“date” value={data.due_date || “”} onChange={(e) => setData({ …data, due_date: e.target.value })} style={{ …S.input, cursor: “pointer” }} />
<input value={data.description} onChange={(e) => setData({ …data, description: e.target.value })} placeholder=“Task description” style={S.input} />
<div style={{ display: “flex”, gap: 8, justifyContent: “flex-end”, marginTop: 4 }}>
<button onClick={onClose} style={S.cancelBtn}>Cancel</button>
<button onClick={() => onSave(data)} style={S.addBtn}>Save</button>
</div>
</div>
</Modal>
);
}

// ─── STATUS NOTES MODAL ────────────────────────────────────────────────────
function StatusNotesModal({ task, notes, onAddNote, onToggleNote, onDeleteNote, onClose }) {
const [text, setText] = useState(””);
const inputRef = useRef(null);

useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

const handleAdd = () => {
if (!text.trim()) return;
onAddNote(text.trim());
setText(””);
};

return (
<Modal title={task.description} onClose={onClose}>
<div style={{ display: “flex”, gap: 8, marginBottom: 16 }}>
<input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
onKeyDown={(e) => { if (e.key === “Enter”) handleAdd(); }}
placeholder=“Add a status note” style={{ …S.input, flex: 1 }} />
<button onClick={handleAdd} style={S.addBtn}>Add</button>
</div>
<div style={{ maxHeight: 320, overflowY: “auto” }}>
{notes.length === 0 && <div style={{ color: C.textMuted, fontSize: 13, textAlign: “center”, padding: 16 }}>No notes yet</div>}
{notes.map((n) => (
<div key={n.id} style={{ display: “flex”, alignItems: “center”, gap: 10, padding: “8px 0”, borderBottom: `1px solid ${C.border}` }}>
<input type=“checkbox” checked={n.checked} onChange={() => onToggleNote(n)}
style={{ width: 16, height: 16, accentColor: C.teal, cursor: “pointer”, flexShrink: 0 }} />
<span style={{
flex: 1, fontSize: 13, color: n.checked ? C.textMuted : C.text,
textDecoration: n.checked ? “line-through” : “none”,
}}>{n.text}</span>
<button onClick={() => onDeleteNote(n.id)}
style={{ background: “none”, border: “none”, color: C.textMuted, fontSize: 14, cursor: “pointer”, fontFamily: “inherit”, padding: “2px 6px” }}>{”\u2715”}</button>
</div>
))}
</div>
</Modal>
);
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────
export default function App() {
const [page, setPage] = useState(“dashboard”);
const [projects, setProjects] = useState([]);
const [tasks, setTasks] = useState([]);

const [selectedProject, setSelectedProject] = useState(null);
const [newDate, setNewDate] = useState(””);
const [newDesc, setNewDesc] = useState(””);

const [projName, setProjName] = useState(””);
const [projNumber, setProjNumber] = useState(””);
const [projClient, setProjClient] = useState(””);

const [editingTask, setEditingTask] = useState(null);
const [editingProject, setEditingProject] = useState(null);
const [statusTask, setStatusTask] = useState(null);
const [taskNotes, setTaskNotes] = useState([]);

const [taskSort, setTaskSort] = useState({ field: null, dir: “asc” });
const [projSort, setProjSort] = useState({ field: null, dir: “asc” });

const [taskFilters, setTaskFilters] = useState({ project: “”, number: “”, client: “”, date: “”, description: “” });
const [projFilters, setProjFilters] = useState({ name: “”, number: “”, client: “” });

// Timesheet
const [tsEntries, setTsEntries] = useState([]);
const [tsSort, setTsSort] = useState({ field: null, dir: “asc” });
const [tsFilters, setTsFilters] = useState({ project: “”, number: “”, client: “”, date: “”, description: “” });
const [tsProject, setTsProject] = useState(null);
const [tsDate, setTsDate] = useState(””);
const [tsDesc, setTsDesc] = useState(””);
const [tsUnits, setTsUnits] = useState(””);
const [tsRate, setTsRate] = useState(””);
const [editingTs, setEditingTs] = useState(null);

const dragItem = useRef(null);
const dragOverItem = useRef(null);

const [allNotes, setAllNotes] = useState([]);

useEffect(() => {
supabase.from(“projects”).select(“order=name.asc”).then(setProjects);
supabase.from(“tasks”).select(“order=sort_order.asc”).then(setTasks);
supabase.from(“timesheet”).select(“order=date.desc”).then((data) => { if (Array.isArray(data)) setTsEntries(data); });
supabase.from(“task_notes”).select(“order=created_at.asc”).then((data) => { if (Array.isArray(data)) setAllNotes(data); });
}, []);

// Note counts per task
const noteCountMap = {};
allNotes.forEach((n) => { noteCountMap[n.task_id] = (noteCountMap[n.task_id] || 0) + 1; });

// Open notes modal
const openNotes = async (task) => {
setStatusTask(task);
const notes = await supabase.from(“task_notes”).select(`task_id=eq.${task.id}&order=created_at.asc`);
setTaskNotes(Array.isArray(notes) ? notes : []);
};
const addNote = async (text) => {
const [created] = await supabase.from(“task_notes”).insert({ task_id: statusTask.id, text, checked: false });
setTaskNotes((prev) => […prev, created]);
setAllNotes((prev) => […prev, created]);
};
const toggleNote = async (note) => {
const newVal = !note.checked;
await supabase.from(“task_notes”).update({ checked: newVal }, note.id);
setTaskNotes((prev) => prev.map((n) => (n.id === note.id ? { …n, checked: newVal } : n)));
setAllNotes((prev) => prev.map((n) => (n.id === note.id ? { …n, checked: newVal } : n)));
};
const deleteNote = async (id) => {
await supabase.from(“task_notes”).delete(id);
setTaskNotes((prev) => prev.filter((n) => n.id !== id));
setAllNotes((prev) => prev.filter((n) => n.id !== id));
};

// Projects CRUD
const addProject = async () => {
if (!projName.trim()) return;
const [created] = await supabase.from(“projects”).insert({ name: projName.trim(), number: projNumber.trim(), client: projClient.trim() });
setProjects((prev) => […prev, created]);
setProjName(””); setProjNumber(””); setProjClient(””);
};
const updateProject = async (proj) => {
const [updated] = await supabase.from(“projects”).update({ name: proj.name, number: proj.number, client: proj.client }, proj.id);
setProjects((prev) => prev.map((p) => (p.id === proj.id ? { …p, …updated } : p)));
setEditingProject(null);
};
const deleteProject = async (id) => {
await supabase.query(“tasks”, { method: “DELETE”, filters: `?project_id=eq.${id}` });
await supabase.from(“projects”).delete(id);
setProjects((p) => p.filter((x) => x.id !== id));
setTasks((t) => t.filter((x) => x.project_id !== id));
};

// Tasks CRUD
const addTask = async () => {
if (!selectedProject || !newDesc.trim()) return;
const [created] = await supabase.from(“tasks”).insert({ project_id: selectedProject.id, due_date: newDate || null, description: newDesc.trim(), sort_order: tasks.length, on_hold: false });
setTasks((prev) => […prev, created]);
setSelectedProject(null); setNewDate(””); setNewDesc(””);
};
const updateTask = async (task) => {
const [updated] = await supabase.from(“tasks”).update({ project_id: task.project_id, due_date: task.due_date || null, description: task.description }, task.id);
setTasks((prev) => prev.map((t) => (t.id === task.id ? { …t, …updated } : t)));
setEditingTask(null);
};
const completeTask = async (id) => {
await supabase.query(“task_notes”, { method: “DELETE”, filters: `?task_id=eq.${id}` });
await supabase.from(“tasks”).delete(id);
setTasks((t) => t.filter((x) => x.id !== id));
setAllNotes((prev) => prev.filter((n) => n.task_id !== id));
};
const toggleHold = async (task) => {
const newVal = !task.on_hold;
await supabase.from(“tasks”).update({ on_hold: newVal }, task.id);
setTasks((prev) => prev.map((t) => (t.id === task.id ? { …t, on_hold: newVal } : t)));
};
const togglePriority = async (task) => {
const newVal = !task.priority;
await supabase.from(“tasks”).update({ priority: newVal }, task.id);
setTasks((prev) => prev.map((t) => (t.id === task.id ? { …t, priority: newVal } : t)));
};

// Timesheet CRUD
const addTsEntry = async () => {
if (!tsProject || !tsDesc.trim()) return;
const entry = { project_id: tsProject.id, date: tsDate || null, description: tsDesc.trim(), units: parseFloat(tsUnits) || 0, rate: parseFloat(tsRate) || 0 };
const [created] = await supabase.from(“timesheet”).insert(entry);
setTsEntries((prev) => [created, …prev]);
setTsProject(null); setTsDate(””); setTsDesc(””); setTsUnits(””); setTsRate(””);
};
const updateTsEntry = async (entry) => {
const [updated] = await supabase.from(“timesheet”).update({ project_id: entry.project_id, date: entry.date || null, description: entry.description, units: parseFloat(entry.units) || 0, rate: parseFloat(entry.rate) || 0 }, entry.id);
setTsEntries((prev) => prev.map((e) => (e.id === entry.id ? { …e, …updated } : e)));
setEditingTs(null);
};
const deleteTsEntry = async (id) => {
await supabase.from(“timesheet”).delete(id);
setTsEntries((prev) => prev.filter((e) => e.id !== id));
};

// Drag
const onDragStart = (e, i) => { dragItem.current = i; e.dataTransfer.effectAllowed = “move”; };
const onDragOver = (e, i) => { dragOverItem.current = i; };
const onDrop = () => {
const items = […tasks];
const [dragged] = items.splice(dragItem.current, 1);
items.splice(dragOverItem.current, 0, dragged);
setTasks(items.map((t, i) => ({ …t, sort_order: i })));
dragItem.current = null; dragOverItem.current = null;
};

// Sort
const toggleSort = (setter) => (field) => {
setter((prev) => ({ field, dir: prev.field === field && prev.dir === “asc” ? “desc” : “asc” }));
};
const sortArr = (arr, s, getVal) => {
if (!s.field) return arr;
const d = s.dir === “asc” ? 1 : -1;
return […arr].sort((a, b) => {
const va = (getVal(a, s.field) || “”).toString().toLowerCase();
const vb = (getVal(b, s.field) || “”).toString().toLowerCase();
return va < vb ? -d : va > vb ? d : 0;
});
};

// Filter + sort tasks
const taskVal = (t, f) => {
const p = projects.find((pr) => pr.id === t.project_id);
if (f === “project”) return p?.name;
if (f === “number”) return p?.number;
if (f === “client”) return p?.client;
if (f === “date”) return t.due_date;
if (f === “description”) return t.description;
return “”;
};
const fTasks = tasks.filter((t) => {
const p = projects.find((pr) => pr.id === t.project_id);
if (taskFilters.project && !(p?.name || “”).toLowerCase().includes(taskFilters.project.toLowerCase())) return false;
if (taskFilters.number && !(p?.number || “”).toLowerCase().includes(taskFilters.number.toLowerCase())) return false;
if (taskFilters.client && !(p?.client || “”).toLowerCase().includes(taskFilters.client.toLowerCase())) return false;
if (taskFilters.date && !(t.due_date || “”).includes(taskFilters.date)) return false;
if (taskFilters.description && !(t.description || “”).toLowerCase().includes(taskFilters.description.toLowerCase())) return false;
return true;
});
const sTasks = sortArr(fTasks, taskSort, taskVal);

// Filter + sort projects
const fProjs = projects.filter((p) => {
if (projFilters.name && !p.name?.toLowerCase().includes(projFilters.name.toLowerCase())) return false;
if (projFilters.number && !p.number?.toLowerCase().includes(projFilters.number.toLowerCase())) return false;
if (projFilters.client && !p.client?.toLowerCase().includes(projFilters.client.toLowerCase())) return false;
return true;
});
const sProjs = sortArr(fProjs, projSort, (p, f) => p[f] || “”);

const hasTF = Object.values(taskFilters).some(Boolean);
const hasPF = Object.values(projFilters).some(Boolean);
const hasTsF = Object.values(tsFilters).some(Boolean);

// Filter + sort timesheet
const tsVal = (e, f) => {
const p = projects.find((pr) => pr.id === e.project_id);
if (f === “project”) return p?.name;
if (f === “number”) return p?.number;
if (f === “client”) return p?.client;
if (f === “date”) return e.date;
if (f === “description”) return e.description;
if (f === “units”) return e.units;
if (f === “rate”) return e.rate;
if (f === “total”) return (e.units || 0) * (e.rate || 0);
return “”;
};
const fTs = tsEntries.filter((e) => {
const p = projects.find((pr) => pr.id === e.project_id);
if (tsFilters.project && !(p?.name || “”).toLowerCase().includes(tsFilters.project.toLowerCase())) return false;
if (tsFilters.number && !(p?.number || “”).toLowerCase().includes(tsFilters.number.toLowerCase())) return false;
if (tsFilters.client && !(p?.client || “”).toLowerCase().includes(tsFilters.client.toLowerCase())) return false;
if (tsFilters.date && !(e.date || “”).includes(tsFilters.date)) return false;
if (tsFilters.description && !(e.description || “”).toLowerCase().includes(tsFilters.description.toLowerCase())) return false;
return true;
});
const sTs = sortArr(fTs, tsSort, tsVal);
const tsTotal = sTs.reduce((sum, e) => sum + (e.units || 0) * (e.rate || 0), 0);

return (
<div style={S.shell}>
<nav style={S.nav}>
<div style={S.navInner}>
<div style={S.logoWrap}>
{LOGO_URL ? <img src={LOGO_URL} alt=“IKB” style={{ height: 32, marginRight: 10 }} /> : <span style={S.logoText}>IKB</span>}
<span style={S.logoSub}>Tasks</span>
</div>
<div style={S.navLinks}>
{[[“dashboard”, “Task Board”], [“timesheet”, “Time Sheet”], [“reports”, “Reports”], [“projects”, “Project Library”]].map(([pg, label]) => (
<button key={pg} onClick={() => setPage(pg)} style={page === pg ? S.navActive : S.navLink}>
{label}
</button>
))}
</div>
</div>
</nav>

```
  <div style={S.content}>
    {/* ═══ DASHBOARD ═══ */}
    {page === "dashboard" && (
      <>
        <h1 style={S.h1}>Task Board</h1>

        {/* New task entry */}
        <div style={{ ...S.row, marginBottom: 16, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <div style={{ ...S.cellFixed, width: COL.grip }} />
          <div style={{ flex: COL.project }}><SearchableDropdown options={projects} value={selectedProject} onChange={setSelectedProject} placeholder="Search project" displayKey="name" /></div>
          <div style={{ ...S.cellFixed, width: COL.number }}><input readOnly value={selectedProject?.number || ""} placeholder="Number" style={{ ...S.input, background: C.bg, color: C.textMuted }} /></div>
          <div style={{ flex: COL.client }}><input readOnly value={selectedProject?.client || ""} placeholder="Client" style={{ ...S.input, background: C.bg, color: C.textMuted }} /></div>
          <div style={{ ...S.cellFixed, width: COL.date }}><input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ ...S.input, cursor: "pointer" }} /></div>
          <div style={{ flex: COL.task }}><input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTask(); }} placeholder="Task description" style={S.input} /></div>
          <div style={{ ...S.cellFixed, width: COL.actions, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={addTask} style={S.addBtn}>Add</button>
          </div>
        </div>

        {/* Header row */}
        <div style={S.row}>
          <div style={{ ...S.cellFixed, width: COL.grip }} />
          <SortHeader label="Project" field="project" style={{ flex: COL.project }} sortField={taskSort.field} sortDir={taskSort.dir} onSort={toggleSort(setTaskSort)} />
          <SortHeader label="Number" field="number" style={{ width: COL.number }} sortField={taskSort.field} sortDir={taskSort.dir} onSort={toggleSort(setTaskSort)} />
          <SortHeader label="Client" field="client" style={{ flex: COL.client }} sortField={taskSort.field} sortDir={taskSort.dir} onSort={toggleSort(setTaskSort)} />
          <SortHeader label="Date" field="date" style={{ width: COL.date }} sortField={taskSort.field} sortDir={taskSort.dir} onSort={toggleSort(setTaskSort)} />
          <SortHeader label="Task" field="description" style={{ flex: COL.task }} sortField={taskSort.field} sortDir={taskSort.dir} onSort={toggleSort(setTaskSort)} />
          <div style={{ ...S.cellFixed, width: COL.actions }} />
        </div>

        {/* Filter row */}
        <div style={{ ...S.row, background: C.white, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ ...S.cellFixed, width: COL.grip }} />
          <div style={{ flex: COL.project }}><input placeholder="Filter" value={taskFilters.project} onChange={(e) => setTaskFilters({ ...taskFilters, project: e.target.value })} style={S.filterInput} /></div>
          <div style={{ ...S.cellFixed, width: COL.number }}><input placeholder="Filter" value={taskFilters.number} onChange={(e) => setTaskFilters({ ...taskFilters, number: e.target.value })} style={S.filterInput} /></div>
          <div style={{ flex: COL.client }}><input placeholder="Filter" value={taskFilters.client} onChange={(e) => setTaskFilters({ ...taskFilters, client: e.target.value })} style={S.filterInput} /></div>
          <div style={{ ...S.cellFixed, width: COL.date }}><input placeholder="Filter" value={taskFilters.date} onChange={(e) => setTaskFilters({ ...taskFilters, date: e.target.value })} style={S.filterInput} /></div>
          <div style={{ flex: COL.task }}><input placeholder="Filter" value={taskFilters.description} onChange={(e) => setTaskFilters({ ...taskFilters, description: e.target.value })} style={S.filterInput} /></div>
          <div style={{ ...S.cellFixed, width: COL.actions, textAlign: "center" }}>
            {hasTF && <button onClick={() => setTaskFilters({ project: "", number: "", client: "", date: "", description: "" })} style={S.clearBtn}>Clear</button>}
          </div>
        </div>

        {/* Task list */}
        <div style={S.list}>
          {sTasks.map((t, i) => (
            <TaskRow key={t.id} task={t} index={i} projects={projects}
              onComplete={completeTask} onEdit={setEditingTask} onToggleHold={toggleHold} onTogglePriority={togglePriority}
              onOpenNotes={openNotes} noteCount={noteCountMap[t.id] || 0}
              onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} />
          ))}
          {sTasks.length === 0 && <div style={S.empty}>{hasTF ? "No tasks match filters" : "No tasks yet"}</div>}
        </div>

        {editingTask && <EditTaskModal task={editingTask} projects={projects} onSave={updateTask} onClose={() => setEditingTask(null)} />}
        {statusTask && <StatusNotesModal task={statusTask} notes={taskNotes} onAddNote={addNote} onToggleNote={toggleNote} onDeleteNote={deleteNote} onClose={() => setStatusTask(null)} />}
      </>
    )}

    {/* ═══ TIME SHEET ═══ */}
    {page === "timesheet" && (
      <>
        <h1 style={S.h1}>Time Sheet</h1>

        {/* New entry */}
        <div style={{ ...S.row, marginBottom: 16, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <div style={{ flex: TCOL.project }}><SearchableDropdown options={projects} value={tsProject} onChange={setTsProject} placeholder="Search project" displayKey="name" /></div>
          <div style={{ ...S.cellFixed, width: TCOL.number }}><input readOnly value={tsProject?.number || ""} placeholder="No." style={{ ...S.input, background: C.bg, color: C.textMuted }} /></div>
          <div style={{ flex: TCOL.client }}><input readOnly value={tsProject?.client || ""} placeholder="Client" style={{ ...S.input, background: C.bg, color: C.textMuted }} /></div>
          <div style={{ ...S.cellFixed, width: TCOL.date }}><input type="date" value={tsDate} onChange={(e) => setTsDate(e.target.value)} style={{ ...S.input, cursor: "pointer" }} /></div>
          <div style={{ flex: TCOL.desc }}><input value={tsDesc} onChange={(e) => setTsDesc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTsEntry(); }} placeholder="Description" style={S.input} /></div>
          <div style={{ ...S.cellFixed, width: TCOL.units }}><input type="number" step="0.25" value={tsUnits} onChange={(e) => setTsUnits(e.target.value)} placeholder="Hrs" style={{ ...S.input, textAlign: "right" }} /></div>
          <div style={{ ...S.cellFixed, width: TCOL.rate }}><input type="number" value={tsRate} onChange={(e) => setTsRate(e.target.value)} placeholder="Rate" style={{ ...S.input, textAlign: "right" }} /></div>
          <div style={{ ...S.cellFixed, width: TCOL.total, fontSize: 13, fontWeight: 600, textAlign: "right", color: C.teal }}>
            ${((parseFloat(tsUnits) || 0) * (parseFloat(tsRate) || 0)).toFixed(2)}
          </div>
          <div style={{ ...S.cellFixed, width: TCOL.actions, display: "flex", justifyContent: "flex-end" }}>
            <button onClick={addTsEntry} style={S.addBtn}>Add</button>
          </div>
        </div>

        {/* Header */}
        <div style={S.row}>
          <SortHeader label="Project" field="project" style={{ flex: TCOL.project }} sortField={tsSort.field} sortDir={tsSort.dir} onSort={toggleSort(setTsSort)} />
          <SortHeader label="No." field="number" style={{ width: TCOL.number }} sortField={tsSort.field} sortDir={tsSort.dir} onSort={toggleSort(setTsSort)} />
          <SortHeader label="Client" field="client" style={{ flex: TCOL.client }} sortField={tsSort.field} sortDir={tsSort.dir} onSort={toggleSort(setTsSort)} />
          <SortHeader label="Date" field="date" style={{ width: TCOL.date }} sortField={tsSort.field} sortDir={tsSort.dir} onSort={toggleSort(setTsSort)} />
          <SortHeader label="Description" field="description" style={{ flex: TCOL.desc }} sortField={tsSort.field} sortDir={tsSort.dir} onSort={toggleSort(setTsSort)} />
          <SortHeader label="Units" field="units" style={{ width: TCOL.units, textAlign: "right" }} sortField={tsSort.field} sortDir={tsSort.dir} onSort={toggleSort(setTsSort)} />
          <SortHeader label="Rate" field="rate" style={{ width: TCOL.rate, textAlign: "right" }} sortField={tsSort.field} sortDir={tsSort.dir} onSort={toggleSort(setTsSort)} />
          <SortHeader label="Total" field="total" style={{ width: TCOL.total, textAlign: "right" }} sortField={tsSort.field} sortDir={tsSort.dir} onSort={toggleSort(setTsSort)} />
          <div style={{ ...S.cellFixed, width: TCOL.actions }} />
        </div>

        {/* Filters */}
        <div style={{ ...S.row, background: C.white, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ flex: TCOL.project }}><input placeholder="Filter" value={tsFilters.project} onChange={(e) => setTsFilters({ ...tsFilters, project: e.target.value })} style={S.filterInput} /></div>
          <div style={{ ...S.cellFixed, width: TCOL.number }}><input placeholder="Filter" value={tsFilters.number} onChange={(e) => setTsFilters({ ...tsFilters, number: e.target.value })} style={S.filterInput} /></div>
          <div style={{ flex: TCOL.client }}><input placeholder="Filter" value={tsFilters.client} onChange={(e) => setTsFilters({ ...tsFilters, client: e.target.value })} style={S.filterInput} /></div>
          <div style={{ ...S.cellFixed, width: TCOL.date }}><input placeholder="Filter" value={tsFilters.date} onChange={(e) => setTsFilters({ ...tsFilters, date: e.target.value })} style={S.filterInput} /></div>
          <div style={{ flex: TCOL.desc }}><input placeholder="Filter" value={tsFilters.description} onChange={(e) => setTsFilters({ ...tsFilters, description: e.target.value })} style={S.filterInput} /></div>
          <div style={{ ...S.cellFixed, width: TCOL.units }} />
          <div style={{ ...S.cellFixed, width: TCOL.rate }} />
          <div style={{ ...S.cellFixed, width: TCOL.total }} />
          <div style={{ ...S.cellFixed, width: TCOL.actions, textAlign: "center" }}>
            {hasTsF && <button onClick={() => setTsFilters({ project: "", number: "", client: "", date: "", description: "" })} style={S.clearBtn}>Clear</button>}
          </div>
        </div>

        {/* Entries */}
        <div style={S.list}>
          {sTs.map((e) => {
            const p = projects.find((pr) => pr.id === e.project_id);
            const total = (e.units || 0) * (e.rate || 0);
            return (
              <div key={e.id} style={S.row}
                onMouseEnter={(ev) => ev.currentTarget.style.background = C.tealLight}
                onMouseLeave={(ev) => ev.currentTarget.style.background = C.white}>
                <div style={{ ...S.cellFlex, flex: TCOL.project }}>{p?.name || "\u2014"}</div>
                <div style={{ ...S.cellFixed, width: TCOL.number, color: C.textMuted }}>{p?.number || "\u2014"}</div>
                <div style={{ ...S.cellFlex, flex: TCOL.client }}>{p?.client || "\u2014"}</div>
                <div style={{ ...S.cellFixed, width: TCOL.date, color: C.textMuted }}>{e.date || "\u2014"}</div>
                <div style={{ ...S.cellFlex, flex: TCOL.desc }}>{e.description}</div>
                <div style={{ ...S.cellFixed, width: TCOL.units, textAlign: "right" }}>{e.units || 0}</div>
                <div style={{ ...S.cellFixed, width: TCOL.rate, textAlign: "right" }}>${(e.rate || 0).toFixed(0)}</div>
                <div style={{ ...S.cellFixed, width: TCOL.total, textAlign: "right", fontWeight: 600, color: C.teal }}>${total.toFixed(2)}</div>
                <div style={{ ...S.cellFixed, width: TCOL.actions, display: "flex", gap: 5, justifyContent: "flex-end" }}>
                  <button onClick={() => setEditingTs({ ...e })} style={S.editBtn}>Edit</button>
                  <button onClick={() => deleteTsEntry(e.id)} style={S.deleteBtn}>{"\u2715"}</button>
                </div>
              </div>
            );
          })}
          {sTs.length === 0 && <div style={S.empty}>{hasTsF ? "No entries match filters" : "No time entries yet"}</div>}
        </div>

        {/* Running total */}
        {sTs.length > 0 && (
          <div style={{ ...S.row, borderRadius: 8, border: `1px solid ${C.border}`, fontWeight: 700, color: C.grey }}>
            <div style={{ flex: 1 }}>Total ({sTs.length} entries)</div>
            <div style={{ ...S.cellFixed, width: TCOL.total, textAlign: "right", color: C.teal, fontSize: 15 }}>${tsTotal.toFixed(2)}</div>
            <div style={{ ...S.cellFixed, width: TCOL.actions }} />
          </div>
        )}

        {/* Edit modal */}
        {editingTs && (
          <Modal title="Edit Time Entry" onClose={() => setEditingTs(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <SearchableDropdown options={projects} value={projects.find((p) => p.id === editingTs.project_id) || null}
                onChange={(p) => setEditingTs({ ...editingTs, project_id: p.id })}
                placeholder="Search project" displayKey="name" />
              <input type="date" value={editingTs.date || ""} onChange={(e) => setEditingTs({ ...editingTs, date: e.target.value })} style={{ ...S.input, cursor: "pointer" }} />
              <input value={editingTs.description} onChange={(e) => setEditingTs({ ...editingTs, description: e.target.value })} placeholder="Description" style={S.input} />
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: C.grey, textTransform: "uppercase", marginBottom: 4, display: "block" }}>Units (hrs)</label>
                  <input type="number" step="0.25" value={editingTs.units} onChange={(e) => setEditingTs({ ...editingTs, units: e.target.value })} style={{ ...S.input, textAlign: "right" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: C.grey, textTransform: "uppercase", marginBottom: 4, display: "block" }}>Rate ($)</label>
                  <input type="number" value={editingTs.rate} onChange={(e) => setEditingTs({ ...editingTs, rate: e.target.value })} style={{ ...S.input, textAlign: "right" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: C.grey, textTransform: "uppercase", marginBottom: 4, display: "block" }}>Total</label>
                  <div style={{ ...S.input, background: C.bg, color: C.teal, fontWeight: 700, textAlign: "right" }}>
                    ${((parseFloat(editingTs.units) || 0) * (parseFloat(editingTs.rate) || 0)).toFixed(2)}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setEditingTs(null)} style={S.cancelBtn}>Cancel</button>
                <button onClick={() => updateTsEntry(editingTs)} style={S.addBtn}>Save</button>
              </div>
            </div>
          </Modal>
        )}
      </>
    )}

    {/* ═══ REPORTS ═══ */}
    {page === "reports" && (
      <Reports supabase={supabase} projects={projects} S={S} />
    )}

    {/* ═══ PROJECT LIBRARY ═══ */}
    {page === "projects" && (
      <>
        <h1 style={S.h1}>Project Library</h1>

        {/* New project entry */}
        <div style={{ ...S.row, marginBottom: 16, borderRadius: 8, border: `1px solid ${C.border}` }}>
          <div style={{ flex: PCOL.name }}><input value={projName} onChange={(e) => setProjName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addProject(); }} placeholder="Project name" style={S.input} /></div>
          <div style={{ flex: PCOL.number }}><input value={projNumber} onChange={(e) => setProjNumber(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addProject(); }} placeholder="Project number" style={S.input} /></div>
          <div style={{ flex: PCOL.client }}><input value={projClient} onChange={(e) => setProjClient(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addProject(); }} placeholder="Client" style={S.input} /></div>
          <div style={{ ...S.cellFixed, width: parseInt(PCOL.actions), display: "flex", justifyContent: "flex-end" }}>
            <button onClick={addProject} style={S.addBtn}>Add</button>
          </div>
        </div>

        <div style={S.row}>
          <SortHeader label="Project Name" field="name" style={{ flex: PCOL.name }} sortField={projSort.field} sortDir={projSort.dir} onSort={toggleSort(setProjSort)} />
          <SortHeader label="Project Number" field="number" style={{ flex: PCOL.number }} sortField={projSort.field} sortDir={projSort.dir} onSort={toggleSort(setProjSort)} />
          <SortHeader label="Client" field="client" style={{ flex: PCOL.client }} sortField={projSort.field} sortDir={projSort.dir} onSort={toggleSort(setProjSort)} />
          <div style={{ ...S.cellFixed, width: parseInt(PCOL.actions) }} />
        </div>

        <div style={{ ...S.row, background: C.white, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ flex: PCOL.name }}><input placeholder="Filter" value={projFilters.name} onChange={(e) => setProjFilters({ ...projFilters, name: e.target.value })} style={S.filterInput} /></div>
          <div style={{ flex: PCOL.number }}><input placeholder="Filter" value={projFilters.number} onChange={(e) => setProjFilters({ ...projFilters, number: e.target.value })} style={S.filterInput} /></div>
          <div style={{ flex: PCOL.client }}><input placeholder="Filter" value={projFilters.client} onChange={(e) => setProjFilters({ ...projFilters, client: e.target.value })} style={S.filterInput} /></div>
          <div style={{ ...S.cellFixed, width: parseInt(PCOL.actions), textAlign: "center" }}>
            {hasPF && <button onClick={() => setProjFilters({ name: "", number: "", client: "" })} style={S.clearBtn}>Clear</button>}
          </div>
        </div>

        <div style={S.list}>
          {sProjs.map((p) => (
            <div key={p.id} style={S.row}
              onMouseEnter={(e) => e.currentTarget.style.background = C.tealLight}
              onMouseLeave={(e) => e.currentTarget.style.background = C.white}>
              <div style={{ ...S.cellFlex, flex: PCOL.name, fontWeight: 600 }}>{p.name}</div>
              <div style={{ ...S.cellFlex, flex: PCOL.number }}>{p.number}</div>
              <div style={{ ...S.cellFlex, flex: PCOL.client }}>{p.client}</div>
              <div style={{ ...S.cellFixed, width: parseInt(PCOL.actions), display: "flex", gap: 5, justifyContent: "flex-end" }}>
                <button onClick={() => setEditingProject({ ...p })} style={S.editBtn}>Edit</button>
                <button onClick={() => deleteProject(p.id)} style={S.deleteBtn}>{"\u2715"}</button>
              </div>
            </div>
          ))}
          {sProjs.length === 0 && <div style={S.empty}>{hasPF ? "No projects match filters" : "No projects yet"}</div>}
        </div>

        {editingProject && (
          <Modal title="Edit Project" onClose={() => setEditingProject(null)}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input value={editingProject.name} onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })} placeholder="Project name" style={S.input} />
              <input value={editingProject.number} onChange={(e) => setEditingProject({ ...editingProject, number: e.target.value })} placeholder="Project number" style={S.input} />
              <input value={editingProject.client} onChange={(e) => setEditingProject({ ...editingProject, client: e.target.value })} placeholder="Client" style={S.input} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={() => setEditingProject(null)} style={S.cancelBtn}>Cancel</button>
                <button onClick={() => updateProject(editingProject)} style={S.addBtn}>Save</button>
              </div>
            </div>
          </Modal>
        )}
      </>
    )}
  </div>
</div>
```

);
}

// ─── STYLES ────────────────────────────────────────────────────────────────
const S = {
shell: { fontFamily: “‘Poppins’, sans-serif”, background: C.bg, minHeight: “100vh”, color: C.text },
nav: { background: C.teal, position: “sticky”, top: 0, zIndex: 100, boxShadow: “0 2px 8px rgba(0,0,0,0.12)” },
navInner: { maxWidth: 1280, margin: “0 auto”, padding: “0 24px”, display: “flex”, alignItems: “center”, justifyContent: “space-between”, height: 56 },
logoWrap: { display: “flex”, alignItems: “center”, gap: 6 },
logoText: { fontSize: 22, fontWeight: 700, color: C.white, letterSpacing: “1px” },
logoSub: { fontSize: 16, fontWeight: 300, color: “rgba(255,255,255,0.8)”, letterSpacing: “0.5px” },
navLinks: { display: “flex”, gap: 4 },
navLink: { background: “none”, border: “none”, color: “rgba(255,255,255,0.7)”, fontSize: 14, fontWeight: 500, padding: “8px 16px”, borderRadius: 6, cursor: “pointer”, fontFamily: “inherit” },
navActive: { background: “rgba(255,255,255,0.18)”, border: “none”, color: C.white, fontSize: 14, fontWeight: 600, padding: “8px 16px”, borderRadius: 6, cursor: “pointer”, fontFamily: “inherit” },
content: { maxWidth: 1280, margin: “0 auto”, padding: “28px 24px” },
h1: { fontSize: 24, fontWeight: 700, margin: “0 0 20px”, color: C.grey },

// Shared row layout — used for headers, filters, data rows, new-entry rows
row: { display: “flex”, alignItems: “center”, gap: 10, padding: “8px 16px”, borderBottom: `1px solid ${C.border}`, background: C.white, transition: “background 0.12s” },
colHeader: { fontSize: 11, fontWeight: 700, textTransform: “uppercase”, letterSpacing: “0.6px”, color: C.grey },
cellFlex: { fontSize: 13, overflow: “hidden”, textOverflow: “ellipsis”, whiteSpace: “nowrap”, minWidth: 0 },
cellFixed: { flexShrink: 0, flexGrow: 0, fontSize: 13 },

filterInput: { width: “100%”, padding: “4px 8px”, fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 4, fontFamily: “inherit”, outline: “none”, boxSizing: “border-box”, color: C.text, background: C.white },
clearBtn: { background: “none”, border: “none”, color: C.teal, fontSize: 11, fontWeight: 600, cursor: “pointer”, fontFamily: “inherit”, textDecoration: “underline” },

list: { background: C.white, borderRadius: “0 0 8px 8px”, border: `1px solid ${C.border}`, borderTop: “none”, marginBottom: 16, overflow: “hidden” },

// Buttons
editBtn: { padding: “4px 10px”, fontSize: 11, fontWeight: 600, background: “none”, border: `1.5px solid ${C.teal}`, color: C.teal, borderRadius: 4, cursor: “pointer”, fontFamily: “inherit”, whiteSpace: “nowrap” },
doneBtn: { padding: “4px 10px”, fontSize: 11, fontWeight: 600, background: C.teal, border: `1.5px solid ${C.teal}`, color: C.white, borderRadius: 4, cursor: “pointer”, fontFamily: “inherit”, whiteSpace: “nowrap” },
holdBtn: { padding: “4px 8px”, fontSize: 11, fontWeight: 600, background: “none”, border: `1.5px solid ${C.textMuted}`, color: C.textMuted, borderRadius: 4, cursor: “pointer”, fontFamily: “inherit”, whiteSpace: “nowrap” },
holdBtnActive: { padding: “4px 8px”, fontSize: 11, fontWeight: 600, background: C.textMuted, border: `1.5px solid ${C.textMuted}`, color: C.white, borderRadius: 4, cursor: “pointer”, fontFamily: “inherit”, whiteSpace: “nowrap” },
priorityBtn: { padding: “4px 8px”, fontSize: 11, fontWeight: 600, background: “none”, border: `1.5px solid ${C.danger}`, color: C.danger, borderRadius: 4, cursor: “pointer”, fontFamily: “inherit”, whiteSpace: “nowrap” },
priorityBtnActive: { padding: “4px 8px”, fontSize: 11, fontWeight: 600, background: C.danger, border: `1.5px solid ${C.danger}`, color: C.white, borderRadius: 4, cursor: “pointer”, fontFamily: “inherit”, whiteSpace: “nowrap” },
deleteBtn: { width: 26, height: 26, display: “flex”, alignItems: “center”, justifyContent: “center”, fontSize: 12, background: “none”, border: `1.5px solid ${C.danger}`, color: C.danger, borderRadius: 4, cursor: “pointer”, fontFamily: “inherit” },
addBtn: { padding: “8px 20px”, fontSize: 13, fontWeight: 700, background: C.teal, color: C.white, border: “none”, borderRadius: 6, cursor: “pointer”, fontFamily: “inherit”, whiteSpace: “nowrap” },
cancelBtn: { padding: “8px 20px”, fontSize: 13, fontWeight: 500, background: “none”, color: C.grey, border: `1.5px solid ${C.border}`, borderRadius: 6, cursor: “pointer”, fontFamily: “inherit” },

input: { width: “100%”, padding: “8px 12px”, fontSize: 13, border: `1.5px solid ${C.border}`, borderRadius: 6, background: C.white, color: C.text, fontFamily: “inherit”, outline: “none”, boxSizing: “border-box” },
dropdown: { position: “absolute”, top: “100%”, left: 0, right: 0, maxHeight: 200, overflowY: “auto”, background: C.white, border: `1.5px solid ${C.border}`, borderTop: “none”, borderRadius: “0 0 6px 6px”, zIndex: 50, boxShadow: “0 8px 24px rgba(0,0,0,0.08)” },
dropdownItem: { padding: “8px 12px”, fontSize: 13, cursor: “pointer”, transition: “background 0.1s” },
dropdownEmpty: { padding: “12px”, fontSize: 12, color: C.textMuted, textAlign: “center” },
empty: { padding: “32px”, textAlign: “center”, color: C.textMuted, fontSize: 13 },

overlay: { position: “fixed”, inset: 0, background: “rgba(0,0,0,0.35)”, display: “flex”, alignItems: “center”, justifyContent: “center”, zIndex: 200 },
modal: { background: C.white, borderRadius: 10, padding: “24px 28px”, width: 420, maxWidth: “90vw”, boxShadow: “0 16px 48px rgba(0,0,0,0.15)” },
modalHeader: { display: “flex”, justifyContent: “space-between”, alignItems: “center”, marginBottom: 16 },
modalTitle: { fontSize: 18, fontWeight: 700, color: C.grey, margin: 0 },
modalClose: { background: “none”, border: “none”, fontSize: 18, color: C.textMuted, cursor: “pointer”, fontFamily: “inherit” },
};
