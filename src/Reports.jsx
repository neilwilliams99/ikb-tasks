import { useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import { LOGO_BASE64 } from "./logoBase64.js";

// ─── BRAND ─────────────────────────────────────────────────────────────────
const C = {
  teal: "#009292", grey: "#595A5A", greyLight: "#DEE0E0", white: "#FFFFFF",
  bg: "#f4f5f5", text: "#333333", textMuted: "#888888", border: "#DEE0E0", danger: "#d9534f",
};

const DEFAULT_CAVEATS = [
  "This inspection does not take the place of the Foreman\u2019s inspection. The Foreman is required to undertake an inspection before loading of the system takes place. As a minimum it should cover: Plumbness of system, damaged and non-genuine material and base plates sitting flat on concrete.",
  "Proprietary items installed in accordance with the manufacturer\u2019s requirements.",
  "Concrete pour depth to be in accordance with structural drawings.",
  "This certificate shall not be construed as relieving any other party of their responsibilities.",
  "This certificate is based on a visual inspection by a qualified engineer.",
  "Ground conditions, permanent structure elements and loads from subsequent slabs are not covered by this certificate.",
];

const FOOTER_NOTES = [
  "Should this instruction constitute a variation to the contract, the contractor is NOT to proceed with work until a variation order is approved by the superintendent.",
  "Commencement of work signifies the contractor\u2019s acceptance that these works do not constitute a variation to the contract.",
  "This site inspection report does not relieve the contractor of their responsibility to comply with the documentation specifications.",
];

export default function Reports({ supabase, projects, S }) {
  const [view, setView] = useState("library"); // "library" | "form"
  const [reports, setReports] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Form state
  const [form, setForm] = useState(emptyForm());

  function emptyForm() {
    return {
      project_id: null,
      to_company: "",
      attention: "",
      date: new Date().toISOString().slice(0, 10),
      ikb_reference: "",
      project_name: "",
      issued_by: "Neil Williams",
      subject: "",
      ref_docs: [""],
      caveats: [...DEFAULT_CAVEATS],
      hide_caveats: false,
      items: [
        { text: "Pre-pour inspection is limited to checking the formwork has been installed generally in accordance with the reference documents." },
        { text: "Inspection was undertaken in person." },
        { text: "Amendments required on site prior to Pour (refer IKB Engineering mark-up):\nRefer to comments on page 2." },
      ],
      image: null,
      imagePreview: null,
    };
  }

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    const data = await supabase.from("inspection_reports").select("order=created_at.desc");
    if (Array.isArray(data)) setReports(data);
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

  const updateRefDoc = (i, val) => {
    const docs = [...form.ref_docs];
    docs[i] = val;
    setForm((f) => ({ ...f, ref_docs: docs }));
  };
  const addRefDoc = () => setForm((f) => ({ ...f, ref_docs: [...f.ref_docs, ""] }));
  const removeRefDoc = (i) => {
    const docs = form.ref_docs.filter((_, idx) => idx !== i);
    setForm((f) => ({ ...f, ref_docs: docs.length ? docs : [""] }));
  };

  const updateCaveat = (i, val) => {
    const cavs = [...form.caveats];
    cavs[i] = val;
    setForm((f) => ({ ...f, caveats: cavs }));
  };

  const handleImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm((f) => ({ ...f, image: ev.target.result, imagePreview: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (ev) => {
          setForm((f) => ({ ...f, image: ev.target.result, imagePreview: ev.target.result }));
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  // Save report to Supabase
  const saveReport = async () => {
    const payload = {
      project_id: form.project_id,
      to_company: form.to_company,
      attention: form.attention,
      date: form.date,
      ikb_reference: form.ikb_reference,
      project_name: form.project_name,
      issued_by: form.issued_by,
      subject: form.subject,
      ref_docs: JSON.stringify(form.ref_docs),
      caveats: JSON.stringify(form.caveats),
      hide_caveats: form.hide_caveats,
      items: JSON.stringify(form.items),
      image_data: form.image || null,
    };

    if (editingId) {
      await supabase.from("inspection_reports").update(payload, editingId);
    } else {
      await supabase.from("inspection_reports").insert(payload);
    }
    await loadReports();
    setEditingId(null);
    setForm(emptyForm());
    setView("library");
  };

  const editReport = (r) => {
    setForm({
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
      items: safeJson(r.items, safeJson(r.item1_text ? JSON.stringify([
        { text: r.item1_text },
        { text: r.item2_text },
        { text: "Amendments required on site prior to Pour (refer IKB Engineering mark-up):\n" + r.item3_text },
      ]) : null, [{ text: "" }])),
      image: r.image_data || null,
      imagePreview: r.image_data || null,
    });
    setEditingId(r.id);
    setView("form");
  };

  const deleteReport = async (id) => {
    await supabase.from("inspection_reports").delete(id);
    setReports((prev) => prev.filter((r) => r.id !== id));
  };

  const newReport = () => {
    setForm(emptyForm());
    setEditingId(null);
    setView("form");
  };

  // ─── PDF GENERATION ────────────────────────────────────────────────────
  const generatePdf = async (reportData) => {
    setGenerating(true);
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
      doc.text("The following reference documents have been used to undertake this inspection:", ml + itemColW + 2, textY);
      textY += 5;

      refDocs.forEach((rd) => {
        if (rd.trim()) {
          doc.text("\u2022   " + rd, ml + itemColW + 6, textY);
          textY += 4.5;
        }
      });

      textY += 3;
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
      doc.rect(ml, cellY, itemColW, cellH);
      doc.rect(ml + itemColW, cellY, commColW, cellH);
      y = cellY + cellH;

      // Numbered items
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

      drawFooter(doc, ml, ph);

      // ── Page 2 (image) ──
      const imgData = rd.image || rd.image_data;
      if (imgData) {
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
        doc.addImage(imgData, "PNG", ix, imgY, iw, ih);

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
    setGenerating(false);
  };

  // ─── RENDER ────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={S.h1}>Inspection Reports</h1>
        {view === "library" ? (
          <button onClick={newReport} style={S.addBtn}>New Report</button>
        ) : (
          <button onClick={() => { setView("library"); setEditingId(null); setForm(emptyForm()); }} style={S.cancelBtn}>Back to Library</button>
        )}
      </div>

      {/* ═══ LIBRARY ═══ */}
      {view === "library" && (
        <>
          {/* Column headers */}
          <div style={{ ...S.row, borderBottom: `2px solid ${C.teal}` }}>
            <div style={{ width: 100, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: C.grey }}>Ref</div>
            <div style={{ flex: 2, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: C.grey }}>Project Name</div>
            <div style={{ flex: 1, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: C.grey }}>Client</div>
            <div style={{ width: 90, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: C.grey }}>Date</div>
            <div style={{ flex: 2, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: C.grey }}>Description</div>
            <div style={{ width: 180 }} />
          </div>
          <div style={S.list}>
            {reports.length === 0 && <div style={{ ...sty.empty }}>No reports yet</div>}
            {reports.map((r) => (
              <div key={r.id} style={{ ...S.row, cursor: "default" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#e6f5f5"}
                onMouseLeave={(e) => e.currentTarget.style.background = C.white}>
                <div style={{ width: 100, fontWeight: 600, fontSize: 13 }}>{r.ikb_reference}</div>
                <div style={{ flex: 2, fontSize: 13 }}>{r.project_name}</div>
                <div style={{ flex: 1, fontSize: 13, color: C.textMuted }}>{r.to_company}</div>
                <div style={{ width: 90, fontSize: 12, color: C.textMuted }}>{formatDate(r.date)}</div>
                <div style={{ flex: 2, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subject}</div>
                <div style={{ display: "flex", gap: 5, width: 180, justifyContent: "flex-end" }}>
                  <button onClick={() => generatePdf(r)} disabled={generating} style={sty.pdfBtn}>{generating ? "..." : "PDF"}</button>
                  <button onClick={() => editReport(r)} style={S.editBtn}>Edit</button>
                  <button onClick={() => deleteReport(r.id)} style={S.deleteBtn}>{"\u2715"}</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ═══ FORM ═══ */}
      {view === "form" && (
        <div onPaste={handlePaste}>
          <div style={sty.card}>
            <h2 style={sty.section}>Project Details</h2>
            <div style={sty.grid2}>
              <div>
                <label style={sty.label}>Project (from library)</label>
                <SearchSelect options={projects} value={projects.find((p) => p.id === form.project_id) || null}
                  onChange={selectProject} displayKey="name" S={S} />
              </div>
              <div>
                <label style={sty.label}>IKB Reference</label>
                <input value={form.ikb_reference} onChange={(e) => updateField("ikb_reference", e.target.value)} style={S.input} />
              </div>
              <div>
                <label style={sty.label}>To (Company)</label>
                <input value={form.to_company} onChange={(e) => updateField("to_company", e.target.value)} style={S.input} />
              </div>
              <div>
                <label style={sty.label}>Attention</label>
                <input value={form.attention} onChange={(e) => updateField("attention", e.target.value)} style={S.input} />
              </div>
              <div>
                <label style={sty.label}>Date</label>
                <input type="date" value={form.date} onChange={(e) => updateField("date", e.target.value)} style={{ ...S.input, cursor: "pointer" }} />
              </div>
              <div>
                <label style={sty.label}>Issued By</label>
                <input value={form.issued_by} onChange={(e) => updateField("issued_by", e.target.value)} style={S.input} />
              </div>
              <div>
                <label style={sty.label}>Subject</label>
                <input value={form.subject} onChange={(e) => updateField("subject", e.target.value)} style={S.input} />
              </div>
            </div>
          </div>

          <div style={sty.card}>
            <h2 style={sty.section}>Reference Documents</h2>
            {form.ref_docs.map((doc, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input value={doc} onChange={(e) => updateRefDoc(i, e.target.value)} placeholder="Reference document" style={{ ...S.input, flex: 1 }} />
                {form.ref_docs.length > 1 && (
                  <button onClick={() => removeRefDoc(i)} style={{ ...S.deleteBtn, width: 32, height: 32 }}>{"\u2715"}</button>
                )}
              </div>
            ))}
            <button onClick={addRefDoc} style={{ ...S.editBtn, marginTop: 4 }}>+ Add Reference</button>
          </div>

          <div style={sty.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 8, borderBottom: `2px solid ${C.teal}` }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: C.grey, margin: 0 }}>Certification Caveats</h2>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: form.hide_caveats ? C.danger : C.textMuted }}>
                <input type="checkbox" checked={form.hide_caveats} onChange={(e) => updateField("hide_caveats", e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: C.danger, cursor: "pointer" }} />
                Do not print
              </label>
            </div>
            {!form.hide_caveats && (
              <>
                <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>These are pre-populated. Edit only if needed for this report.</p>
                {form.caveats.map((c, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <textarea value={c} onChange={(e) => updateCaveat(i, e.target.value)}
                      rows={2} style={{ ...S.input, resize: "vertical", lineHeight: 1.5 }} />
                  </div>
                ))}
              </>
            )}
            {form.hide_caveats && (
              <p style={{ fontSize: 13, color: C.textMuted, fontStyle: "italic", padding: "8px 0" }}>Caveats will not be included in the PDF.</p>
            )}
          </div>

          <div style={sty.card}>
            <h2 style={sty.section}>Inspection Items</h2>
            {form.items.map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-start" }}>
                <div style={{ width: 32, paddingTop: 8, fontWeight: 700, fontSize: 13, color: C.grey, textAlign: "center", flexShrink: 0 }}>{i + 1}</div>
                <textarea value={item.text} onChange={(e) => {
                  const newItems = [...form.items];
                  newItems[i] = { text: e.target.value };
                  setForm((f) => ({ ...f, items: newItems }));
                }} rows={2} style={{ ...S.input, flex: 1, resize: "vertical", lineHeight: 1.5 }} />
                {form.items.length > 1 && (
                  <button onClick={() => {
                    const newItems = form.items.filter((_, idx) => idx !== i);
                    setForm((f) => ({ ...f, items: newItems }));
                  }} style={{ ...S.deleteBtn, width: 32, height: 32, marginTop: 4 }}>{"\u2715"}</button>
                )}
              </div>
            ))}
            <button onClick={() => setForm((f) => ({ ...f, items: [...f.items, { text: "" }] }))} style={{ ...S.editBtn, marginTop: 4 }}>+ Add Item</button>
          </div>

          <div style={sty.card}>
            <h2 style={sty.section}>Page 2 Image (Screenshot / Markup)</h2>
            <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 12 }}>Upload an image or paste a screenshot (Ctrl+V anywhere on this page).</p>
            <input type="file" accept="image/*" onChange={handleImage} style={{ marginBottom: 12, fontSize: 13 }} />
            {form.imagePreview && (
              <div style={{ marginTop: 8 }}>
                <img src={form.imagePreview} alt="Preview" style={{ maxWidth: "100%", maxHeight: 300, border: `1px solid ${C.border}`, borderRadius: 6 }} />
                <button onClick={() => setForm((f) => ({ ...f, image: null, imagePreview: null }))} style={{ ...S.deleteBtn, marginTop: 8, width: "auto", height: "auto", padding: "4px 12px" }}>Remove Image</button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 16, justifyContent: "flex-end" }}>
            <button onClick={() => { setView("library"); setEditingId(null); setForm(emptyForm()); }} style={S.cancelBtn}>Cancel</button>
            <button onClick={saveReport} style={S.addBtn}>{editingId ? "Update Report" : "Save Report"}</button>
            <button onClick={() => generatePdf()} disabled={generating} style={sty.pdfBtn}>{generating ? "Generating..." : "Generate PDF"}</button>
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

// ─── SEARCH SELECT (simplified) ────────────────────────────────────────────
function SearchSelect({ options, value, onChange, displayKey, S }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((o) => o[displayKey]?.toLowerCase().includes(search.toLowerCase()));
  const displayValue = value ? value[displayKey] : "";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input type="text" value={open ? search : displayValue} placeholder="Search project"
        onFocus={() => { setOpen(true); setSearch(""); }}
        onChange={(e) => setSearch(e.target.value)} style={S.input} />
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, maxHeight: 200, overflowY: "auto", background: "#fff", border: "1.5px solid #DEE0E0", borderTop: "none", borderRadius: "0 0 6px 6px", zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}>
          {filtered.length === 0 && <div style={{ padding: 12, fontSize: 12, color: "#888", textAlign: "center" }}>No matches</div>}
          {filtered.map((o, i) => (
            <div key={i} onClick={() => { onChange(o); setOpen(false); setSearch(""); }}
              style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#e6f5f5"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >{o[displayKey]}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── LOCAL STYLES ──────────────────────────────────────────────────────────
const sty = {
  card: {
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: "20px 24px",
    marginBottom: 16,
  },
  section: {
    fontSize: 15,
    fontWeight: 700,
    color: C.grey,
    margin: "0 0 14px",
    paddingBottom: 8,
    borderBottom: `2px solid ${C.teal}`,
  },
  label: {
    fontSize: 11,
    fontWeight: 600,
    color: C.grey,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: 4,
    display: "block",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
  },
  empty: {
    padding: 32,
    textAlign: "center",
    color: C.textMuted,
    fontSize: 13,
  },
  pdfBtn: {
    padding: "5px 14px",
    fontSize: 12,
    fontWeight: 700,
    background: C.grey,
    border: "none",
    color: C.white,
    borderRadius: 4,
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  },
};
