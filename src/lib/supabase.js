// ─── SUPABASE (thin PostgREST wrapper) ─────────────────────────────────────
// Errors are thrown and also broadcast to onError listeners so the app can
// show them, rather than silently putting an error object into state.
// Sign-in (and token refresh) is handled by supabase-js; every request is sent
// with the signed-in user's token. The anon key on its own can read nothing:
// row-level security only lets allowed users in (supabase/migrations).
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://dgdpiaqabdfsgwcpxuvx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnZHBpYXFhYmRmc2d3Y3B4dXZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3OTk2MDMsImV4cCI6MjA4ODM3NTYwM30.YrdDeGaKKG0GzjKnDaDQoCS0LNl4S9-xYOSldeiZ8gY";

export const auth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "ikb-tasks-auth" },
}).auth;

const listeners = new Set();
export const onError = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const report = (msg) => listeners.forEach((fn) => fn(msg));

export const supabase = {
  async query(table, { method = "GET", body, filters = "", headers = {} } = {}) {
    const { data: { session } } = await auth.getSession();
    if (!session) {
      report("You've been signed out. Please sign in again.");
      throw new Error("Not signed in");
    }
    let res;
    try {
      res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${filters}`, {
        method,
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.access_token}`,
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
