import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────
// Replace these with your Supabase project details
const SUPABASE_URL = "https://dgdpiaqabdfsgwcpxuvx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnZHBpYXFhYmRmc2d3Y3B4dXZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3OTk2MDMsImV4cCI6MjA4ODM3NTYwM30.YrdDeGaKKG0GzjKnDaDQoCS0LNl4S9-xYOSldeiZ8gY";

// Simple Supabase REST helper (no SDK needed)
const supabase = {
  async query(table, { method = "GET", body, filters = "", headers = {} } = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${filters}`;
    const res = await fetch(url, {
      method,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: method === "POST" ? "return=representation" : method === "DELETE" ? "return=minimal" : "return=representation",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (method === "DELETE") return [];
    return res.json();
  },
  from(table) {
    return {
      select: (filters = "") => supabase.query(table, { filters: `?select=*${filters ? "&" + filters : ""}` }),
      insert: (body) => supabase.query(table, { method: "POST", body }),
      update: (body, id) => supabase.query(table, { method: "PATCH", body, filters: `?id=eq.${id}`, headers: { Prefer: "return=representation" } }),
      delete: (id) => supabase.query(table, { method: "DELETE", filters: `?id=eq.${id}` }),
    };
  },
};

const useDemo = false;

// ─── SEARCHABLE DROPDOWN ───────────────────────────────────────────────────
function SearchableDropdown({ options, value, onChange, placeholder, displayKey }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((o) => {
    const label = typeof o === "string" ? o : o[displayKey];
    return label?.toLowerCase().includes(search.toLowerCase());
  });

  const displayValue = value ? (typeof value === "string" ? value : value[displayKey]) : "";

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        value={open ? search : displayValue}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setSearch(""); }}
        onChange={(e) => setSearch(e.target.value)}
        style={styles.input}
      />
      {open && (
        <div style={styles.dropdown}>
          {filtered.length === 0 && <div style={styles.dropdownEmpty}>No matches</div>}
          {filtered.map((o, i) => {
            const label = typeof o === "string" ? o : o[displayKey];
            return (
              <div
                key={i}
                onClick={() => { onChange(o); setOpen(false); setSearch(""); }}
                style={styles.dropdownItem}
                onMouseEnter={(e) => e.currentTarget.style.background = "#f0ece4"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                {label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── DATE PICKER ───────────────────────────────────────────────────────────
function DatePicker({ value, onChange }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...styles.input, cursor: "pointer" }}
    />
  );
}

// ─── DRAGGABLE TASK ROW ────────────────────────────────────────────────────
function TaskRow({ task, index, projects, onComplete, onDragStart, onDragOver, onDrop }) {
  const project = projects.find((p) => p.id === task.project_id);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e, index); }}
      onDrop={(e) => onDrop(e, index)}
      style={styles.taskRow}
      onMouseEnter={(e) => { e.currentTarget.style.background = "#faf8f4"; e.currentTarget.querySelector('.grip').style.opacity = 1; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "#ffffff"; e.currentTarget.querySelector('.grip').style.opacity = 0.3; }}
    >
      <div className="grip" style={styles.grip}>⠿</div>
      <div style={styles.taskCell}>{project?.name || "—"}</div>
      <div style={styles.taskCellSmall}>{project?.number || "—"}</div>
      <div style={styles.taskCell}>{project?.client || "—"}</div>
      <div style={styles.taskCellSmall}>{task.due_date || "—"}</div>
      <div style={{ ...styles.taskCell, flex: 2 }}>{task.description}</div>
      <button onClick={() => onComplete(task.id)} style={styles.completeBtn}>
        Done
      </button>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [filterText, setFilterText] = useState("");

  // New task form
  const [selectedProject, setSelectedProject] = useState(null);
  const [newDate, setNewDate] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // New project form
  const [projName, setProjName] = useState("");
  const [projNumber, setProjNumber] = useState("");
  const [projClient, setProjClient] = useState("");

  // Drag state
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  // ── Load data ──
  useEffect(() => {
    if (useDemo) {
      setProjects([
        { id: 1, name: "Victoria Quay Landscaping", number: "VQ-2025-001", client: "Human Urban" },
        { id: 2, name: "Smith Street BTR", number: "SS-2025-002", client: "Perkins Builders" },
        { id: 3, name: "Cordova Court Residence", number: "CC-2025-003", client: "Thompson Family" },
      ]);
      setTasks([
        { id: 1, project_id: 1, due_date: "2026-03-10", description: "Review Wall A blockwork specification", sort_order: 0 },
        { id: 2, project_id: 2, due_date: "2026-03-12", description: "Submit PI insurance documentation", sort_order: 1 },
        { id: 3, project_id: 3, due_date: "2026-03-15", description: "Finalise screw pile design calcs", sort_order: 2 },
      ]);
    } else {
      supabase.from("projects").select("order=name.asc").then(setProjects);
      supabase.from("tasks").select("order=sort_order.asc").then(setTasks);
    }
  }, []);

  // ── Add project ──
  const addProject = async () => {
    if (!projName.trim()) return;
    const newP = { name: projName.trim(), number: projNumber.trim(), client: projClient.trim() };
    if (useDemo) {
      const id = Date.now();
      setProjects((p) => [...p, { ...newP, id }]);
    } else {
      const [created] = await supabase.from("projects").insert(newP);
      setProjects((p) => [...p, created]);
    }
    setProjName(""); setProjNumber(""); setProjClient("");
  };

  const deleteProject = async (id) => {
    if (useDemo) {
      setProjects((p) => p.filter((x) => x.id !== id));
      setTasks((t) => t.filter((x) => x.project_id !== id));
    } else {
      await supabase.from("tasks").delete(`project_id=eq.${id}`);
      await supabase.from("projects").delete(id);
      setProjects((p) => p.filter((x) => x.id !== id));
      setTasks((t) => t.filter((x) => x.project_id !== id));
    }
  };

  // ── Add task ──
  const addTask = async () => {
    if (!selectedProject || !newDesc.trim()) return;
    const newT = {
      project_id: selectedProject.id,
      due_date: newDate || null,
      description: newDesc.trim(),
      sort_order: tasks.length,
    };
    if (useDemo) {
      setTasks((t) => [...t, { ...newT, id: Date.now() }]);
    } else {
      const [created] = await supabase.from("tasks").insert(newT);
      setTasks((t) => [...t, created]);
    }
    setSelectedProject(null); setNewDate(""); setNewDesc("");
  };

  // ── Complete (delete) task ──
  const completeTask = async (id) => {
    if (!useDemo) await supabase.from("tasks").delete(id);
    setTasks((t) => t.filter((x) => x.id !== id));
  };

  // ── Drag & drop ──
  const onDragStart = (e, index) => { dragItem.current = index; e.dataTransfer.effectAllowed = "move"; };
  const onDragOver = (e, index) => { dragOverItem.current = index; };
  const onDrop = () => {
    const items = [...tasks];
    const [dragged] = items.splice(dragItem.current, 1);
    items.splice(dragOverItem.current, 0, dragged);
    const reordered = items.map((t, i) => ({ ...t, sort_order: i }));
    setTasks(reordered);
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // ── Filter tasks ──
  const filteredTasks = tasks.filter((t) => {
    if (!filterText) return true;
    const p = projects.find((pr) => pr.id === t.project_id);
    const hay = `${p?.name} ${p?.number} ${p?.client} ${t.description} ${t.due_date}`.toLowerCase();
    return hay.includes(filterText.toLowerCase());
  });

  // ── Keyboard shortcut: Enter to add ──
  const handleTaskKeyDown = (e) => { if (e.key === "Enter") addTask(); };
  const handleProjectKeyDown = (e) => { if (e.key === "Enter") addProject(); };

  return (
    <div style={styles.shell}>
      {/* ── BANNER NAV ── */}
      <nav style={styles.nav}>
        <div style={styles.navInner}>
          <div style={styles.logo}>IKB Tasks</div>
          <div style={styles.navLinks}>
            <button
              onClick={() => setPage("dashboard")}
              style={page === "dashboard" ? styles.navActive : styles.navLink}
            >
              Dashboard
            </button>
            <button
              onClick={() => setPage("projects")}
              style={page === "projects" ? styles.navActive : styles.navLink}
            >
              Project Library
            </button>
          </div>
        </div>
      </nav>

      <div style={styles.content}>
        {/* ══════════ DASHBOARD ══════════ */}
        {page === "dashboard" && (
          <>
            <div style={styles.pageHeader}>
              <h1 style={styles.h1}>Task Board</h1>
              <input
                type="text"
                placeholder="Filter tasks…"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                style={{ ...styles.input, maxWidth: 260 }}
              />
            </div>

            {/* Column headers */}
            <div style={styles.colHeaders}>
              <div style={{ width: 28 }}></div>
              <div style={styles.colHeader}>Project</div>
              <div style={styles.colHeaderSmall}>Number</div>
              <div style={styles.colHeader}>Client</div>
              <div style={styles.colHeaderSmall}>Date</div>
              <div style={{ ...styles.colHeader, flex: 2 }}>Task</div>
              <div style={{ width: 64 }}></div>
            </div>

            {/* Task list */}
            <div style={styles.taskList}>
              {filteredTasks.map((t, i) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  index={i}
                  projects={projects}
                  onComplete={completeTask}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                />
              ))}
              {filteredTasks.length === 0 && (
                <div style={styles.empty}>
                  {filterText ? "No tasks match your filter" : "No tasks yet — add one below"}
                </div>
              )}
            </div>

            {/* New task entry */}
            <div style={styles.newRow}>
              <div style={{ flex: 1 }}>
                <SearchableDropdown
                  options={projects}
                  value={selectedProject}
                  onChange={(p) => setSelectedProject(p)}
                  placeholder="Search project…"
                  displayKey="name"
                />
              </div>
              <div style={{ width: 120 }}>
                <input
                  type="text"
                  readOnly
                  value={selectedProject?.number || ""}
                  placeholder="Number"
                  style={{ ...styles.input, background: "#f7f5f0", color: "#6b6458" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  readOnly
                  value={selectedProject?.client || ""}
                  placeholder="Client"
                  style={{ ...styles.input, background: "#f7f5f0", color: "#6b6458" }}
                />
              </div>
              <div style={{ width: 140 }}>
                <DatePicker value={newDate} onChange={setNewDate} />
              </div>
              <div style={{ flex: 2 }}>
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  onKeyDown={handleTaskKeyDown}
                  placeholder="Task description…"
                  style={styles.input}
                />
              </div>
              <button onClick={addTask} style={styles.addBtn}>Add</button>
            </div>

            {useDemo && (
              <div style={styles.demoBanner}>
                Demo mode — connect Supabase to persist data. See setup instructions below.
              </div>
            )}
          </>
        )}

        {/* ══════════ PROJECT LIBRARY ══════════ */}
        {page === "projects" && (
          <>
            <div style={styles.pageHeader}>
              <h1 style={styles.h1}>Project Library</h1>
            </div>

            {/* Project table */}
            <div style={styles.colHeaders}>
              <div style={{ ...styles.colHeader, flex: 2 }}>Project Name</div>
              <div style={styles.colHeader}>Project Number</div>
              <div style={styles.colHeader}>Client</div>
              <div style={{ width: 64 }}></div>
            </div>

            <div style={styles.taskList}>
              {projects.map((p) => (
                <div key={p.id} style={styles.taskRow}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#faf8f4"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#ffffff"}
                >
                  <div style={{ ...styles.taskCell, flex: 2, fontWeight: 600 }}>{p.name}</div>
                  <div style={styles.taskCell}>{p.number}</div>
                  <div style={styles.taskCell}>{p.client}</div>
                  <button onClick={() => deleteProject(p.id)} style={styles.deleteProjBtn}>✕</button>
                </div>
              ))}
              {projects.length === 0 && (
                <div style={styles.empty}>No projects yet — add one below</div>
              )}
            </div>

            {/* New project entry */}
            <div style={styles.newRow}>
              <div style={{ flex: 2 }}>
                <input
                  type="text"
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  onKeyDown={handleProjectKeyDown}
                  placeholder="Project name"
                  style={styles.input}
                />
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={projNumber}
                  onChange={(e) => setProjNumber(e.target.value)}
                  onKeyDown={handleProjectKeyDown}
                  placeholder="Project number"
                  style={styles.input}
                />
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={projClient}
                  onChange={(e) => setProjClient(e.target.value)}
                  onKeyDown={handleProjectKeyDown}
                  placeholder="Client"
                  style={styles.input}
                />
              </div>
              <button onClick={addProject} style={styles.addBtn}>Add</button>
            </div>
          </>
        )}
      </div>

      {/* ── SETUP GUIDE (only in demo) ── */}
      {useDemo && (
        <div style={styles.setupGuide}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700, color: "#3d3929" }}>Supabase Setup</h2>
          <p style={{ margin: "0 0 8px", lineHeight: 1.5 }}>
            1. Create a Supabase project at <strong>supabase.com</strong><br/>
            2. Run this SQL in the SQL Editor:
          </p>
          <pre style={styles.code}>{`create table projects (
  id bigint generated always as identity primary key,
  name text not null,
  number text,
  client text
);

create table tasks (
  id bigint generated always as identity primary key,
  project_id bigint references projects(id),
  due_date date,
  description text not null,
  sort_order int default 0
);

-- Enable Row Level Security (optional)
alter table projects enable row level security;
alter table tasks enable row level security;

-- Public read/write policies (tighten for production)
create policy "public_projects" on projects for all using (true);
create policy "public_tasks" on tasks for all using (true);`}</pre>
          <p style={{ margin: "8px 0 0", lineHeight: 1.5 }}>
            3. Replace <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> at the top of this file with your project values (Settings → API).
          </p>
        </div>
      )}
    </div>
  );
}

// ─── STYLES ────────────────────────────────────────────────────────────────
const C = {
  bg: "#f5f2eb",
  surface: "#ffffff",
  border: "#e0dbd0",
  text: "#3d3929",
  textMuted: "#8a8474",
  accent: "#b8860b",
  accentHover: "#9a7209",
  navBg: "#3d3929",
  navText: "#e8e2d4",
};

const styles = {
  shell: {
    fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
    background: C.bg,
    minHeight: "100vh",
    color: C.text,
  },
  nav: {
    background: C.navBg,
    borderBottom: `1px solid ${C.border}`,
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  navInner: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "0 24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
  },
  logo: {
    fontSize: 20,
    fontWeight: 800,
    color: C.accent,
    letterSpacing: "-0.5px",
  },
  navLinks: { display: "flex", gap: 4 },
  navLink: {
    background: "none",
    border: "none",
    color: C.navText,
    fontSize: 14,
    fontWeight: 500,
    padding: "8px 16px",
    borderRadius: 6,
    cursor: "pointer",
    opacity: 0.7,
    fontFamily: "inherit",
  },
  navActive: {
    background: "rgba(255,255,255,0.1)",
    border: "none",
    color: "#ffffff",
    fontSize: 14,
    fontWeight: 600,
    padding: "8px 16px",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  content: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "32px 24px",
  },
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 12,
  },
  h1: {
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: "-0.5px",
    margin: 0,
  },
  colHeaders: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 16px",
    borderBottom: `2px solid ${C.border}`,
    marginBottom: 2,
  },
  colHeader: {
    flex: 1,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    color: C.textMuted,
  },
  colHeaderSmall: {
    width: 120,
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    color: C.textMuted,
  },
  taskList: {
    background: C.surface,
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    marginBottom: 16,
    overflow: "hidden",
  },
  taskRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderBottom: `1px solid ${C.border}`,
    cursor: "grab",
    transition: "background 0.15s",
    background: "#ffffff",
  },
  grip: {
    width: 20,
    textAlign: "center",
    fontSize: 16,
    color: C.textMuted,
    opacity: 0.3,
    transition: "opacity 0.15s",
    userSelect: "none",
  },
  taskCell: {
    flex: 1,
    fontSize: 14,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  taskCellSmall: {
    width: 120,
    fontSize: 13,
    color: C.textMuted,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  completeBtn: {
    width: 56,
    padding: "6px 0",
    fontSize: 12,
    fontWeight: 700,
    background: "none",
    border: `1.5px solid ${C.accent}`,
    color: C.accent,
    borderRadius: 5,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.15s",
  },
  deleteProjBtn: {
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    background: "none",
    border: "none",
    color: C.textMuted,
    borderRadius: 4,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  newRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "12px 16px",
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    fontSize: 14,
    border: `1.5px solid ${C.border}`,
    borderRadius: 6,
    background: "#ffffff",
    color: C.text,
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  },
  addBtn: {
    padding: "8px 20px",
    fontSize: 14,
    fontWeight: 700,
    background: C.accent,
    color: "#ffffff",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    transition: "background 0.15s",
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    maxHeight: 200,
    overflowY: "auto",
    background: "#ffffff",
    border: `1.5px solid ${C.border}`,
    borderTop: "none",
    borderRadius: "0 0 6px 6px",
    zIndex: 50,
    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
  },
  dropdownItem: {
    padding: "8px 12px",
    fontSize: 14,
    cursor: "pointer",
    transition: "background 0.1s",
  },
  dropdownEmpty: {
    padding: "12px",
    fontSize: 13,
    color: C.textMuted,
    textAlign: "center",
  },
  empty: {
    padding: "32px",
    textAlign: "center",
    color: C.textMuted,
    fontSize: 14,
  },
  demoBanner: {
    marginTop: 16,
    padding: "10px 16px",
    background: "#fef3cd",
    border: "1px solid #ffc107",
    borderRadius: 6,
    fontSize: 13,
    color: "#856404",
    textAlign: "center",
  },
  setupGuide: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "0 24px 48px",
    fontSize: 14,
    color: C.text,
  },
  code: {
    background: C.navBg,
    color: "#e8e2d4",
    padding: "16px",
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.5,
    overflowX: "auto",
    whiteSpace: "pre",
  },
};
