import { useState, useEffect } from "react";
import { supabase, auth, onError } from "./lib/supabase.js";
import { useTable } from "./lib/useTable.js";
import SignIn from "./pages/SignIn.jsx";
import logoIkbi from "./assets/logo-ikbi.svg";
import TaskBoard from "./pages/TaskBoard.jsx";
import TimeSheet from "./pages/TimeSheet.jsx";
import Reports, { LIST_COLUMNS as REPORT_LIST_COLUMNS } from "./pages/Reports.jsx";
import ProjectLibrary from "./pages/ProjectLibrary.jsx";
import Apps from "./pages/Apps.jsx";
import Loans from "./pages/Loans.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

const PAGES = [
  ["dashboard", "Task Board"],
  ["timesheet", "Time Sheet"],
  ["reports", "Reports"],
  ["projects", "Project Library"],
  ["loans", "Loans"],
  ["apps", "Apps"],
];

// Remember the open tab across reloads (?page=… in the URL)
const initialPage = () => {
  const p = new URLSearchParams(window.location.search).get("page");
  return PAGES.some(([k]) => k === p) ? p : "dashboard";
};

export default function App() {
  const [error, setError] = useState(null);
  const [session, setSession] = useState(undefined); // undefined = still checking

  useEffect(() => {
    auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => onError((msg) => setError(msg)), []);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 8000);
    return () => clearTimeout(t);
  }, [error]);

  if (session === undefined) return null;
  if (!session) return <SignIn />;

  return (
    <>
      {/* Keyed on the user, so signing out drops every table held below and
          the next person to sign in starts with none of it in memory. The key
          is the user id rather than the session, which is replaced on every
          token refresh and would otherwise throw the data away mid-session. */}
      <Workspace key={session.user.id} session={session} />

      {error && (
        <div className="toast" role="alert">
          <span className="tag">// error</span>
          <span style={{ flex: 1 }}>{error}</span>
          <button className="modal-close" onClick={() => setError(null)} aria-label="Dismiss">{"✕"}</button>
        </div>
      )}
    </>
  );
}

// Holds the signed-in user's rows for as long as they are signed in. Each
// table is fetched the first time its tab is opened and kept here afterwards,
// so tabbing between the pages renders from memory rather than reloading
// every table from the database on each visit.
function Workspace({ session }) {
  const [page, setPage] = useState(initialPage);
  const [projects, setProjects] = useState([]);

  const tasks = useTable("tasks", "order=sort_order.asc");
  const notes = useTable("task_notes", "order=created_at.asc");
  const time = useTable("timesheet", "order=date.desc.nullslast,id.desc");
  // The reports are held without their images, which are most of that table's
  // weight and are read one at a time by the page that needs them.
  const reports = useTable("inspection_reports", "order=created_at.desc", REPORT_LIST_COLUMNS);
  const loans = useTable("loans", "order=sort_order.asc,id.asc");
  const loanSettings = useTable("loan_settings", "id=eq.1");

  // Projects are needed by nearly every tab, so they are loaded up front.
  useEffect(() => {
    supabase.from("projects").select("order=name.asc").then(setProjects).catch(() => {});
  }, []);

  // Fetch what the open tab needs. These are no-ops once the table is held,
  // so the cost falls on the first visit only.
  useEffect(() => {
    if (page === "dashboard") { tasks.load(); notes.load(); }
    if (page === "timesheet") time.load();
    if (page === "reports") reports.load();
    if (page === "loans") { loans.load(); loanSettings.load(); }
  }, [page, tasks.load, notes.load, time.load, reports.load, loans.load, loanSettings.load]);

  // Archived projects stay loaded, so a task or entry against one still shows
  // its name; they are only kept out of the pickers for new and edited rows.
  const activeProjects = projects.filter((p) => !p.archived_at);

  // Each tab is a history entry, so Back steps through the tabs rather than
  // leaving the site; popstate puts the page back in step with the URL.
  const pageUrl = (p) => {
    const url = new URL(window.location.href);
    if (p === "dashboard") url.searchParams.delete("page"); else url.searchParams.set("page", p);
    return url;
  };
  const go = (p) => {
    if (p === page) return;
    setPage(p);
    window.history.pushState({ page: p }, "", pageUrl(p));
  };
  useEffect(() => {
    const onPop = () => setPage(initialPage());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <img src={logoIkbi} alt="IKBi" className="brand-logo" />
            <div className="brand-text">
              <span className="brand-name">IKB Tasks</span>
              <span className="brand-sub">// ikb_innovations · tasks, time &amp; inspections</span>
            </div>
          </div>
          <nav className="nav">
            {PAGES.map(([key, label]) => (
              <button key={key} onClick={() => go(key)} className={`nav-link${page === key ? " active" : ""}`}>{label}</button>
            ))}
            <button onClick={() => auth.signOut()} className="nav-link" title={session.user.email}>Sign out</button>
          </nav>
        </div>
      </header>

      <main className="content">
        <ErrorBoundary key={page} label={PAGES.find(([k]) => k === page)?.[1]}>
          {page === "dashboard" && (
            <TaskBoard projects={projects} pickable={activeProjects}
              tasks={tasks.rows} setTasks={tasks.setRows}
              notes={notes.rows} setNotes={notes.setRows}
              loading={tasks.loading || notes.loading} />
          )}
          {page === "timesheet" && (
            <TimeSheet projects={projects} pickable={activeProjects}
              entries={time.rows} setEntries={time.setRows} loading={time.loading} />
          )}
          {page === "reports" && (
            <Reports projects={projects} pickable={activeProjects}
              reports={reports.rows} setReports={reports.setRows} loading={reports.loading} />
          )}
          {page === "projects" && <ProjectLibrary projects={projects} setProjects={setProjects} />}
          {page === "loans" && (
            <Loans loans={loans.rows} setLoans={loans.setRows} loading={loans.loading}
              settings={loanSettings.rows} setSettings={loanSettings.setRows} settingsLoading={loanSettings.loading} />
          )}
          {page === "apps" && <Apps />}
        </ErrorBoundary>
      </main>

      <footer className="page-foot">
        // IKB Innovations · <a href="mailto:info@ikbeng.com">info@ikbeng.com</a> · engineering intelligence. built for industry.
      </footer>
    </>
  );
}
