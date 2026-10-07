// ─── SUPABASE (thin PostgREST wrapper) ─────────────────────────────────────
// Errors are thrown and also broadcast to onError listeners so the app can
// show them, rather than silently putting an error object into state.
const SUPABASE_URL = "https://dgdpiaqabdfsgwcpxuvx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnZHBpYXFhYmRmc2d3Y3B4dXZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3OTk2MDMsImV4cCI6MjA4ODM3NTYwM30.YrdDeGaKKG0GzjKnDaDQoCS0LNl4S9-xYOSldeiZ8gY";

const listeners = new Set();
export const onError = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const report = (msg) => listeners.forEach((fn) => fn(msg));

export const supabase = {
  async query(table, { method = "GET", body, filters = "", headers = {} } = {}) {
    let res;
    try {
      res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${filters}`, {
        method,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: method === "DELETE" ? "return=minimal" : "return=representation",
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      report("Can't reach the database. Check your connection.");
      throw err;
    }
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try { const j = await res.json(); msg = j.message || j.hint || msg; } catch { /* no body */ }
      report(`${method} ${table}: ${msg}`);
      throw new Error(msg);
    }
    if (method === "DELETE" || res.status === 204) return [];
    return res.json();
  },
  from(table) {
    return {
      select: (filters = "") => supabase.query(table, { filters: `?select=*${filters ? "&" + filters : ""}` }),
      insert: (body) => supabase.query(table, { method: "POST", body }),
      update: (body, id) => supabase.query(table, { method: "PATCH", body, filters: `?id=eq.${id}` }),
      delete: (id) => supabase.query(table, { method: "DELETE", filters: `?id=eq.${id}` }),
      deleteWhere: (filters) => supabase.query(table, { method: "DELETE", filters: `?${filters}` }),
      count: async (filters) => (await supabase.query(table, { filters: `?select=id&${filters}` })).length,
    };
  },
};
