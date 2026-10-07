import { useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import { LOGO_BASE64 } from "../logoBase64.js";
import { supabase } from "../lib/supabase.js";
import { today } from "../lib/format.js";
import { SearchableDropdown, PageHead } from "../components/ui.jsx";

const DEFAULT_CAVEATS = [
  "This inspection does not take the place of the Foreman’s inspection. The Foreman is required to undertake an inspection before loading of the system takes place. As a minimum it should cover: Plumbness of system, damaged and non-genuine material and base plates sitting flat on concrete.",
  "Proprietary items installed in accordance with the manufacturer’s requirements.",
  "Concrete pour depth to be in accordance with structural drawings.",
  "This certificate shall not be construed as relieving any other party of their responsibilities.",
  "This certificate is based on a visual inspection by a qualified engineer.",
  "Ground conditions, permanent structure elements and loads from subsequent slabs are not covered by this certificate.",
];

const FOOTER_NOTES = [
  "Should this instruction constitute a variation to the contract, the contractor is NOT to proceed with work until a variation order is approved by the superintendent.",
  "Commencement of work signifies the contractor’s acceptance that these works do not constitute a variation to the contract.",
  "This site inspection report does not relieve the contractor of their responsibility to comply with the documentation specifications.",
];

function emptyForm() {
  return {
    project_id: null,
    to_company: "",
    attention: "",
    date: today(),
    ikb_reference: "",
    project_name: "",
    issued_by: "Neil Williams",
    subject: "",
    ref_docs: [""],
    caveats: [...DEFAULT_CAVEATS],
    hide_caveats: false,
    hide_ref_docs: false,
    hide_items: false,
    hide_image: false,
    items: [
      { text: "Pre-pour inspection is limited to checking the formwork has been installed generally in accordance with the reference documents." },
      { text: "Inspection was undertaken in person." },
      { text: "Amendments required on site prior to Pour (refer IKB Engineering mark-up):\nRefer to comments on page 2." },
    ],
    image: null,
    imagePreview: null,
  };
}

export default function Reports({ projects }) {
  const [view, setView] = useState("library"); // "library" | "form"
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [generating, setGenerating] = useState(null); // id of report being generated ("form" for the open form)
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const savedForm = useRef(JSON.stringify(emptyForm())); // to detect unsaved changes

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    const data = await supabase.from("inspection_reports").select("order=created_at.desc").catch(() => null);
    if (Array.isArray(data)) setReports(data);
    setLoading(false);
  };

  const q = search.trim().toLowerCase();
  const shownReports = reports.filter((r) => !q || [r.ikb_reference, r.project_name, r.to_company, r.subject].join(" ").toLowerCase().includes(q));

  const openForm = (f, id) => {
    setForm(f);
    savedForm.current = JSON.stringify(f);
    setEditingId(id);
    setView("form");
  };

  const backToLibrary = () => {
    if (JSON.stringify(form) !== savedForm.current && !window.confirm("Discard unsaved changes to this report?")) return;
    setView("library");
    setEditingId(null);
    setForm(emptyForm());
  };

  // When project selected, auto-fill fields
  const selectProject = (proj) => {
    setForm((f) => ({
      ...f,
      project_id: proj.id,
      to_company: proj.client || "",
      project_name: proj.name || "",
      ikb_reference: f.ikb_reference || proj.number || "",
    }));
  };

  const updateField = (field, val) => setForm((f) => ({ ...f, [field]: val }));

  const updateRefDoc = (i, val) => setForm((f) => ({ ...f, ref_docs: f.ref_docs.map((d, idx) => (idx === i ? val : d)) }));
  const addRefDoc = () => setForm((f) => ({ ...f, ref_docs: [...f.ref_docs, ""] }));
  const removeRefDoc = (i) => setForm((f) => {
    const docs = f.ref_docs.filter((_, idx) => idx !== i);
    return { ...f, ref_docs: docs.length ? docs : [""] };
  });

  const updateCaveat = (i, val) => setForm((f) => ({ ...f, caveats: f.caveats.map((c, idx) => (idx === i ? val : c)) }));

  const readImage = (file) => {
    const reader = new FileReader();
    reader.onload = (ev) => setForm((f) => ({ ...f, image: ev.target.result, imagePreview: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (file) readImage(file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        readImage(item.getAsFile());
        break;
      }
    }
  };

  // Save report to Supabase. The form is only cleared once the save succeeds.
  const saveReport = async () => {
    const payload = {
      project_id: form.project_id,
      to_company: form.to_company,
      attention: form.attention,
      date: form.date || null,
      ikb_reference: form.ikb_reference,
      project_name: form.project_name,
      issued_by: form.issued_by,
      subject: form.subject,
      ref_docs: JSON.stringify(form.ref_docs),
      caveats: JSON.stringify(form.caveats),
      hide_caveats: form.hide_caveats,
      hide_ref_docs: form.hide_ref_docs,
      hide_items: form.hide_items,
      hide_image: form.hide_image,
      items: JSON.stringify(form.items),
      image_data: form.image || null,
    };

    setSaving(true);
    try {
      if (editingId) {
        await supabase.from("inspection_reports").update(payload, editingId);
      } else {
        await supabase.from("inspection_reports").insert(payload);
      }
    } catch {
      setSaving(false);
      return; // keep the form so nothing is lost; the error toast explains why
    }
    setSaving(false);
    await loadReports();
    savedForm.current = JSON.stringify(form);
    setEditingId(null);
    setForm(emptyForm());
    setView("library");
  };

  const editReport = (r) => {
    openForm({
      project_id: r.project_id,
      to_company: r.to_company || "",
      attention: r.attention || "",
      date: r.date || "",
      ikb_reference: r.ikb_reference || "",
      project_name: r.project_name || "",
      issued_by: r.issued_by || "Neil Williams",
      subject: r.subject || "",
      ref_docs: safeJson(r.ref_docs, [""]),
      caveats: safeJson(r.caveats, [...DEFAULT_CAVEATS]),
      hide_caveats: r.hide_caveats || false,
      hide_ref_docs: r.hide_ref_docs || false,
      hide_items: r.hide_items || false,
      hide_image: r.hide_image || false,
      items: safeJson(r.items, safeJson(r.item1_text ? JSON.stringify([
        { text: r.item1_text },
        { text: r.item2_text },
        { text: "Amendments required on site prior to Pour (refer IKB Engineering mark-up):\n" + r.item3_text },
      ]) : null, [{ text: "" }])),
      image: r.image_data || null,
      imagePreview: r.image_data || null,
    }, r.id);
  };

  const deleteReport = async (r) => {
    if (!window.confirm(`Delete report ${r.ikb_reference || ""} — ${r.subject || r.project_name || "untitled"}?\n\nThis cannot be undone.`)) return;
    await supabase.from("inspection_reports").delete(r.id).then(() => setReports((prev) => prev.filter((x) => x.id !== r.id))).catch(() => {});
  };

  const newReport = () => openForm(emptyForm(), null);

  // ─── EMAIL ─────────────────────────────────────────────────────────────
  const emailReport = (reportData) => {
    const rd = reportData || form;
    const subject = `${rd.project_name || ""} / ${rd.subject || ""}`;
    const body = "Hi gents,\r\n\r\nPlease find today's inspection report attached.\r\n\r\nCheers,\r\nNeil";
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // ─── PDF GENERATION ────────────────────────────────────────────────────
  const generatePdf = async (reportData) => {
    setGenerating(reportData?.id ?? "form");
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pw = 210, ph = 297;
      const ml = 20, mr = 20, contentW = pw - ml - mr;

      const rd = reportData || form;
      const refDocs = typeof rd.ref_docs === "string" ? safeJson(rd.ref_docs, []) : rd.ref_docs;
      const caveats = typeof rd.caveats === "string" ? safeJson(rd.caveats, []) : rd.caveats;

      // ── Page 1 ──
      drawHeader(doc, ml, mr, pw);
      let y = 58;

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(51, 51, 51);
      doc.text("RECORD OF INSPECTION", ml, y);
      y += 14;

      // Details grid
      doc.setFontSize(9);
      const leftLabelX = ml, leftValX = ml + 30;
      const rightLabelX = ml + contentW * 0.53, rightValX = ml + contentW * 0.53 + 32;

      const details = [
        ["TO:", rd.to_company, "IKB REFERENCE:", rd.ikb_reference],
        ["ATTENTION:", rd.attention, "PROJECT NAME:", rd.project_name],
        ["DATE:", formatDate(rd.date), "ISSUED BY:", rd.issued_by],
        ["SUBJECT:", rd.subject, "", ""],
      ];

      details.forEach(([ll, lv, rl, rv]) => {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(51, 51, 51);
        doc.text(ll, leftLabelX, y);
        doc.setFont("helvetica", "normal");
        doc.text(lv || "", leftValX, y);
        if (rl) {
          doc.setFont("helvetica", "bold");
          doc.text(rl, rightLabelX, y);
          doc.setFont("helvetica", "normal");
          doc.text(rv || "", rightValX, y);
        }
        y += 7;
      });

      y += 6;

      // Item / Comments table
      const itemColW = 14;
      const commColW = contentW - itemColW;

      // Table header
      doc.setFillColor(89, 90, 90);
      doc.rect(ml, y, contentW, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("ITEM", ml + 2, y + 5);
      doc.text("COMMENTS", ml + itemColW + 2, y + 5);
      y += 7;

      doc.setTextColor(51, 51, 51);
      doc.setFontSize(8);

      // Reference docs section
      let cellY = y;
      doc.setDrawColor(200, 200, 200);
      doc.setFont("helvetica", "normal");

      let textY = cellY + 5;

      const hideRefDocs = rd.hide_ref_docs;
      if (!hideRefDocs) {
        doc.text("The following reference documents have been used to undertake this inspection:", ml + itemColW + 2, textY);
        textY += 5;

        refDocs.forEach((rd) => {
          if (rd.trim()) {
            doc.text("\u2022   " + rd, ml + itemColW + 6, textY);
            textY += 4.5;
          }
        });

        textY += 3;
      }
      const hideCaveats = rd.hide_caveats;
      if (!hideCaveats) {
        doc.text("This certification is subject to the following items:", ml + itemColW + 2, textY);
        textY += 5;

        caveats.forEach((c) => {
          const lines = doc.splitTextToSize("\u2022   " + c, commColW - 10);
          lines.forEach((line) => {
            if (textY > ph - 35) { addNewPage(doc, ml, mr, pw); textY = 55; }
            doc.text(line, ml + itemColW + 6, textY);
            textY += 4;
          });
          textY += 1;
        });
      }

      let cellH = textY - cellY;
      if (!hideRefDocs || !hideCaveats) {
        doc.rect(ml, cellY, itemColW, cellH);
        doc.rect(ml + itemColW, cellY, commColW, cellH);
      }
      y = cellY + cellH;

      // Numbered items
      const hideItems = rd.hide_items;
      if (!hideItems) {
        const items = typeof rd.items === "string" ? safeJson(rd.items, []) : (rd.items || []);
        // Backward compat: if old format with item1_text etc
        const itemList = items.length > 0 ? items : [
          { text: rd.item1_text || "" },
          { text: rd.item2_text || "" },
          { text: "Amendments required on site prior to Pour (refer IKB Engineering mark-up):\n" + (rd.item3_text || "") },
        ];

        itemList.forEach((item, idx) => {
          const txt = item.text || "";
          const lines = doc.splitTextToSize(txt, commColW - 6);
          const rowH = Math.max(8, lines.length * 4 + 4);

          if (y + rowH > ph - 35) { addNewPage(doc, ml, mr, pw); y = 55; }

          doc.setFont("helvetica", "bold");
          doc.text(String(idx + 1), ml + 5, y + 5);
          doc.setFont("helvetica", "normal");
          let ly = y + 5;
          lines.forEach((line) => {
            doc.text(line, ml + itemColW + 2, ly);
            ly += 4;
          });

          doc.rect(ml, y, itemColW, rowH);
          doc.rect(ml + itemColW, y, commColW, rowH);
          y += rowH;
        });
      }

      drawFooter(doc, ml, ph);

      // ── Page 2 (image) ──
      const imgData = rd.image || rd.image_data;
      const hideImage = rd.hide_image;
      if (imgData && !hideImage) {
        doc.addPage();
        drawHeader(doc, ml, mr, pw);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(51, 51, 51);
        doc.text("RECORD OF INSPECTION", ml, 58);

        // Load image to get real dimensions for correct aspect ratio
        const imgY = 68;
        const maxH = ph - imgY - 30;
        const maxW = contentW;

        const dims = await loadImageDimensions(imgData);
        const aspect = dims.h / dims.w;
        let iw = maxW;
        let ih = iw * aspect;
        if (ih > maxH) {
          ih = maxH;
          iw = ih / aspect;
        }
        const ix = ml + (contentW - iw) / 2;
        doc.addImage(imgData, /^data:image\/jpe?g/i.test(imgData) ? "JPEG" : "PNG", ix, imgY, iw, ih);

        drawFooter(doc, ml, ph);
      }

      const filename = `${rd.ikb_reference || "report"}_${rd.subject || "inspection"}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "_");

      // Use Save As dialog if browser supports it, otherwise fall back to download
      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: "PDF Document",
              accept: { "application/pdf": [".pdf"] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(doc.output("blob"));
          await writable.close();
        } catch (saveErr) {
          // User cancelled the dialog — don't treat as error
          if (saveErr.name !== "AbortError") {
            doc.save(filename);
          }
        }
      } else {
        doc.save(filename);
      }
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("PDF generation failed. Check console for details.");
    }
    setGenerating(null);
  };

  // ─── RENDER ────────────────────────────────────────────────────────────
  const toggle = (field, label) => (
    <label className={`toggle${form[field] ? " on" : ""}`}>
      <input type="checkbox" checked={form[field]} onChange={(e) => updateField(field, e.target.checked)} />
      {label}
    </label>
  );
  const hiddenNote = (what) => <p className="hint-line" style={{ margin: "4px 0 0" }}>// {what} will not be included in the PDF</p>;

  return (
    <div>
      <PageHead eyebrow="inspection_reports" title={view === "library" ? "Inspection Reports" : editingId ? "Edit Report" : "New Report"}>
        {view === "library" ? (
          <button onClick={newReport} className="btn btn-primary">New report</button>
        ) : (
          <button onClick={backToLibrary} className="btn btn-ghost">Back to library</button>
        )}
      </PageHead>

      {/* ═══ LIBRARY ═══ */}
      {view === "library" && (
        <>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reports (ref, project, client, subject)"
            className="input" style={{ maxWidth: 420, marginBottom: 12 }} />
          <div className="table">
            <div className="row head">
              <div className="col-head" style={{ width: 100, flex: "none" }}>Ref</div>
              <div className="col-head" style={{ flex: 2 }}>Project name</div>
              <div className="col-head" style={{ flex: 1 }}>Client</div>
              <div className="col-head" style={{ width: 84, flex: "none" }}>Date</div>
              <div className="col-head" style={{ flex: 2 }}>Subject</div>
              <div style={{ width: 230, flex: "none" }} />
            </div>
            {shownReports.map((r) => (
              <div key={r.id} className="row data">
                <div className="cell fixed mono" style={{ width: 100, color: "var(--text-primary)" }}>{r.ikb_reference}</div>
                <div className="cell strong" style={{ flex: 2 }}>{r.project_name}</div>
                <div className="cell muted" style={{ flex: 1 }}>{r.to_company}</div>
                <div className="cell fixed mono" style={{ width: 84 }}>{formatDate(r.date)}</div>
                <div className="cell" style={{ flex: 2 }} title={r.subject}>{r.subject}</div>
                <div className="cell actions" style={{ width: 230 }}>
                  <button onClick={() => generatePdf(r)} disabled={generating !== null} className="btn btn-sm btn-ghost">{generating === r.id ? "…" : "PDF"}</button>
                  <button onClick={() => emailReport(r)} className="btn btn-sm btn-ghost">Email</button>
                  <button onClick={() => editReport(r)} className="btn btn-sm btn-outline">Edit</button>
                  <button onClick={() => deleteReport(r)} className="btn btn-danger btn-icon" aria-label="Delete">{"✕"}</button>
                </div>
              </div>
            ))}
            {shownReports.length === 0 && <div className="empty">{loading ? "loading…" : search ? "no reports match search" : "no reports yet"}</div>}
          </div>
        </>
      )}

      {/* ═══ FORM ═══ */}
      {view === "form" && (
        <div onPaste={handlePaste} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="section-title">project details</div>
            <div className="grid-2">
              <div className="field">
                <label>Project <span className="hint">from library</span></label>
                <SearchableDropdown options={projects} value={projects.find((p) => p.id === form.project_id) || null} onChange={selectProject} />
              </div>
              <div className="field"><label>IKB reference</label>
                <input value={form.ikb_reference} onChange={(e) => updateField("ikb_reference", e.target.value)} className="input" /></div>
              <div className="field"><label>To <span className="hint">company</span></label>
                <input value={form.to_company} onChange={(e) => updateField("to_company", e.target.value)} className="input" /></div>
              <div className="field"><label>Attention</label>
                <input value={form.attention} onChange={(e) => updateField("attention", e.target.value)} className="input" /></div>
              <div className="field"><label>Date</label>
                <input type="date" value={form.date} onChange={(e) => updateField("date", e.target.value)} className="input" /></div>
              <div className="field"><label>Issued by</label>
                <input value={form.issued_by} onChange={(e) => updateField("issued_by", e.target.value)} className="input" /></div>
              <div className="field" style={{ gridColumn: "1 / -1" }}><label>Subject</label>
                <input value={form.subject} onChange={(e) => updateField("subject", e.target.value)} className="input" /></div>
            </div>
          </div>

          <div className="card">
            <div className="section-title">reference documents {toggle("hide_ref_docs", "do not print")}</div>
            {!form.hide_ref_docs ? (
              <>
                {form.ref_docs.map((doc, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <input value={doc} onChange={(e) => updateRefDoc(i, e.target.value)} placeholder="Reference document" className="input" style={{ flex: 1 }} />
                    {form.ref_docs.length > 1 && <button onClick={() => removeRefDoc(i)} className="btn btn-danger btn-icon" style={{ width: 34, height: 34 }} aria-label="Remove">{"✕"}</button>}
                  </div>
                ))}
                <button onClick={addRefDoc} className="btn btn-sm btn-outline" style={{ marginTop: 4 }}>+ Add reference</button>
              </>
            ) : hiddenNote("reference documents")}
          </div>

          <div className="card">
            <div className="section-title">certification caveats {toggle("hide_caveats", "do not print")}</div>
            {!form.hide_caveats ? (
              <>
                <p className="hint-line" style={{ margin: "0 0 10px" }}>// pre-populated — edit only if needed for this report</p>
                {form.caveats.map((c, i) => (
                  <textarea key={i} value={c} onChange={(e) => updateCaveat(i, e.target.value)} rows={2} className="input" style={{ marginBottom: 8 }} />
                ))}
              </>
            ) : hiddenNote("caveats")}
          </div>

          <div className="card">
            <div className="section-title">inspection items {toggle("hide_items", "do not print")}</div>
            {!form.hide_items ? (
              <>
                {form.items.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-start" }}>
                    <div className="mono" style={{ width: 28, paddingTop: 7, fontSize: "0.8rem", color: "var(--teal)", textAlign: "center", flex: "none" }}>{i + 1}</div>
                    <textarea value={item.text} rows={2} className="input" style={{ flex: 1 }}
                      onChange={(e) => setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { text: e.target.value } : it)) }))} />
                    {form.items.length > 1 && (
                      <button onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))}
                        className="btn btn-danger btn-icon" style={{ width: 34, height: 34, marginTop: 2 }} aria-label="Remove">{"✕"}</button>
                    )}
                  </div>
                ))}
                <button onClick={() => setForm((f) => ({ ...f, items: [...f.items, { text: "" }] }))} className="btn btn-sm btn-outline" style={{ marginTop: 4 }}>+ Add item</button>
              </>
            ) : hiddenNote("inspection items")}
          </div>

          <div className="card">
            <div className="section-title">page 2 image · screenshot / markup {toggle("hide_image", "do not print")}</div>
            {!form.hide_image ? (
              <>
                <p className="hint-line" style={{ margin: "0 0 10px" }}>// upload an image or paste a screenshot (ctrl+v anywhere on this page)</p>
                <input type="file" accept="image/png,image/jpeg" onChange={handleImage} style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }} />
                {form.imagePreview && (
                  <div style={{ marginTop: 12 }}>
                    <img src={form.imagePreview} alt="Preview" style={{ maxWidth: "100%", maxHeight: 300, border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", display: "block", background: "#fff" }} />
                    <button onClick={() => setForm((f) => ({ ...f, image: null, imagePreview: null }))} className="btn btn-sm btn-danger" style={{ marginTop: 8 }}>Remove image</button>
                  </div>
                )}
              </>
            ) : hiddenNote("the image page")}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button onClick={backToLibrary} className="btn btn-ghost">Cancel</button>
            <button onClick={() => emailReport()} className="btn btn-ghost">Email</button>
            <button onClick={() => generatePdf()} disabled={generating !== null} className="btn btn-outline">{generating !== null ? "Generating…" : "Generate PDF"}</button>
            <button onClick={saveReport} disabled={saving} className="btn btn-primary">{saving ? "Saving…" : editingId ? "Update report" : "Save report"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── HELPERS ───────────────────────────────────────────────────────────────
function safeJson(val, fallback) {
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

function formatDate(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function drawHeader(doc, ml, mr, pw) {
  try {
    doc.addImage(LOGO_BASE64, "PNG", ml, 6, 50, 30);
  } catch { /* logo failed */ }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(89, 90, 90);
  doc.text("0429 847 674", pw - mr, 14, { align: "right" });
  doc.text("info@ikbeng.com", pw - mr, 19, { align: "right" });
}

function drawFooter(doc, ml, ph) {
  const fy = ph - 18;
  doc.setDrawColor(200, 200, 200);
  doc.line(ml, fy, 210 - 20, fy);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(120, 120, 120);

  FOOTER_NOTES.forEach((note, i) => {
    doc.text(`${i + 1}.`, ml, fy + 4 + i * 3.5);
    const lines = doc.splitTextToSize(note, 160);
    doc.text(lines, ml + 5, fy + 4 + i * 3.5);
  });
}

function addNewPage(doc, ml, mr, pw) {
  drawFooter(doc, ml, 297);
  doc.addPage();
  drawHeader(doc, ml, mr, pw);
}

function loadImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 800, h: 600 }); // fallback
    img.src = dataUrl;
  });
}
