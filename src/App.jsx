import { useState, useEffect } from "react";
import { supabase, onError } from "./lib/supabase.js";
import logoIkbi from "./assets/logo-ikbi.svg";
import TaskBoard from "./pages/TaskBoard.jsx";
import TimeSheet from "./pages/TimeSheet.jsx";
import Reports from "./pages/Reports.jsx";
import ProjectLibrary from "./pages/ProjectLibrary.jsx";
import Apps from "./pages/Apps.jsx";

const PAGES = [
  ["dashboard", "Task Board"],
  ["timesheet", "Time Sheet"],
  ["reports", "Reports"],
  ["projects", "Project Library"],
  ["apps", "Apps"],
];

// Remember the open tab across reloads (?page=… in the URL)
const initialPage = () => {
  const p = new URLSearchParams(window.location.search).get("page");
  return PAGES.some(([k]) => k === p) ? p : "dashboard";
};

export default function App() {
  const [page, setPage] = useState(initialPage);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.from("projects").select("order=name.asc").then(setProjects).catch(() => {});
  }, []);

  useEffect(() => onError((msg) => setError(msg)), []);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 8000);
    return () => clearTimeout(t);
  }, [error]);

  const go = (p) => {
    setPage(p);
    const url = new URL(window.location.href);
    if (p === "dashboard") url.searchParams.delete("page"); else url.searchParams.set("page", p);
    window.history.replaceState(null, "", url);
  };

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
          </nav>
        </div>
      </header>

      <main className="content">
        {page === "dashboard" && <TaskBoard projects={projects} />}
        {page === "timesheet" && <TimeSheet projects={projects} />}
        {page === "reports" && <Reports projects={projects} />}
        {page === "projects" && <ProjectLibrary projects={projects} setProjects={setProjects} />}
        {page === "apps" && <Apps />}
      </main>

      <footer className="page-foot">
        // IKB Innovations · <a href="mailto:info@ikbeng.com">info@ikbeng.com</a> · engineering intelligence. built for industry.
      </footer>

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
