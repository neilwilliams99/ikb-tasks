import { useState } from "react";

// ─── APP DIRECTORY ─────────────────────────────────────────────────────────
// Links to every IKB app and site. URLs taken from `netlify sites:list` (07/10/2026).
// To add or update one, edit this list.
const APPS = [
  // Products
  { name: "BackProp", group: "Products", url: "https://backpropslabs.com", repo: "backprop-frontend", desc: "Slab back-propping design tool with Stripe subscriptions." },
  { name: "PTX", group: "Products", url: "https://ptxapp.com.au", repo: "ptx", desc: "Digital post-tension stressing records and extension tracking." },
  { name: "Drawing Register", group: "Products", url: "https://drawingregister.com.au", repo: "drawing-register", desc: "Lists the latest revision of every drawing in a job folder and reads missing titles with AI." },
  { name: "SpecRisk", group: "Products", url: "https://spec-review.netlify.app", repo: "spec-review", desc: "AI review of specifications for clauses that shift design work onto contractors or conflict with AS standards." },
  { name: "ShutterProp", group: "Products", url: "https://shutterprop.netlify.app", repo: "shutterprop", desc: "Column and wall shutter propping wind check to AS/NZS 1170.2." },
  { name: "StackCheck", group: "Products", url: "https://stackcheckapp.netlify.app", repo: "stackcheck", desc: "Overturning and sliding check of stacked sea containers under wind." },
  { name: "FormCheck", group: "Products", url: "https://formcheck-app.netlify.app", repo: "formcheck", desc: "Formwork design calculator to AS 3610 Table 4.5.2." },
  { name: "PropCheck", group: "Products", url: "https://propcheckapp.netlify.app", repo: "propcheck", desc: "Propping check tool." },
  { name: "FormBase", group: "Products", url: "https://formbase-app.netlify.app", repo: "formbase", desc: "Cross-manufacturer database and calculators for propping and slab formwork." },
  { name: "GearLog", group: "Products", url: "https://gearlogapp.netlify.app", repo: "gearlog", desc: "QR-sticker repair tracking for subcontractor gear." },
  { name: "YardSheet", group: "Products", url: "https://yardsheet.netlify.app", repo: "yardsheet", desc: "Stock control for subcontractor gear across the yard and jobs." },
  { name: "Threat Collector", group: "Products", url: "https://threat-collector.netlify.app", repo: "threat-collector", desc: "Multi-organisation safety incident reporting with an admin dashboard." },
  { name: "WeldCalc", group: "Products", url: "https://weld-calc.netlify.app", repo: "weld-calc", desc: "Weld records by organisation and project (partly built)." },

  // Tools
  { name: "Anchor Group Calculator", group: "Tools", url: "https://cast-in-anchors.netlify.app", repo: "cast-in-anchors", desc: "Calculator for groups of cast-in anchors." },
  { name: "Hazard Tool", group: "Tools", url: "https://hazard-tool.netlify.app", repo: "hazard-tool", desc: "Site wind parameters from Revolutio's Hazard API." },
  { name: "Concrete Pressure", group: "Tools", url: "https://concrete-pressure.netlify.app", repo: "concrete_pressure", desc: "Concrete pressure calculator (repo not cloned locally)." },
  { name: "IKB Tasks", group: "Tools", url: "https://ikbtasks.netlify.app", repo: "ikb-tasks", desc: "This app: tasks, time sheets and reports." },

  // Websites
  { name: "IKB Engineering", group: "Websites", url: "https://ikbeng.com", repo: "ikbe-website", desc: "IKB Engineering company website." },
  { name: "IKB Innovations", group: "Websites", url: "https://ikbinnovations.com", repo: "ikbi-website", desc: "IKB Innovations product website." },
  { name: "Beam Floor", group: "Websites", url: "https://beamfloor.netlify.app", repo: "beamfloor", desc: "Marketing site for Beam Floor's precast floor slabs." },

  // Not deployed
  { name: "Feaso", group: "Not deployed", repo: null,desc: "Development feasibility studies, stored in the browser." },
  { name: "Solwest Hoarding", group: "Not deployed", repo: null, desc: "Temporary hoarding design calculator (single HTML page)." },
  { name: "SpaceGass Tools", group: "Not deployed", url: "https://spacegass-tools.onrender.com", repo: "spacegass-tools", desc: "Generates SpaceGass Excel import models from plain-English descriptions." },
  { name: "Weld Group", group: "Not deployed", repo: null, desc: "Older .NET web app (IKB.Web) with a production database backup." },
];

const GROUPS = ["Products", "Tools", "Websites", "Not deployed"];
const GITHUB = "https://github.com/neilwilliams99/";

export default function Apps({ S, C }) {
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();
  const shown = APPS.filter((a) => !q || `${a.name} ${a.desc} ${a.url || ""}`.toLowerCase().includes(q));

  const card = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 };
  const link = { color: C.teal, fontSize: 12, fontWeight: 600, textDecoration: "none", wordBreak: "break-all" };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
        <h1 style={{ ...S.h1, marginBottom: 0 }}>Apps</h1>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter apps" style={{ ...S.input, maxWidth: 260 }} />
      </div>

      {GROUPS.map((g) => {
        const items = shown.filter((a) => a.group === g);
        if (!items.length) return null;
        return (
          <section key={g} style={{ marginBottom: 24 }}>
            <div style={{ ...S.colHeader, marginBottom: 8 }}>{g}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {items.map((a) => (
                <div key={a.name} style={card}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.grey }}>
                    {a.url ? <a href={a.url} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>{a.name}</a> : a.name}
                  </div>
                  <div style={{ fontSize: 13, color: C.text, flex: 1 }}>{a.desc}</div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={link}>{a.url.replace(/^https:\/\//, "")}</a>}
                    {a.repo && <a href={GITHUB + a.repo} target="_blank" rel="noreferrer" style={{ ...link, color: C.textMuted, fontWeight: 500 }}>GitHub</a>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {shown.length === 0 && <div style={S.empty}>No apps match filter</div>}
    </>
  );
}
