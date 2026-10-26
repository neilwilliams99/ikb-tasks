// ─── TABLE CACHE ───────────────────────────────────────────────────────────
// A table is fetched the first time a tab needs it and then kept in memory
// for the rest of the session, so switching tabs renders from state instead
// of going back to the database. The pages that show the rows keep them true
// as they go: every insert, update and delete already writes the row the
// database hands back straight into this state, so a kept copy never falls
// behind and never needs a refetch.
import { useCallback, useRef, useState } from "react";
import { supabase } from "./supabase.js";

// `columns` is passed on to the select for a table whose rows are only worth
// holding in part — see the reports library, which leaves its images behind.
export function useTable(table, query, columns = "*") {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  // Called on every visit to the tab, and does nothing after the first one,
  // so coming back to a tab costs no request. A failed fetch clears the flag
  // so the next visit tries again rather than leaving the tab empty for good.
  const load = useCallback(() => {
    if (fetched.current) return;
    fetched.current = true;
    setLoading(true);
    supabase.from(table).select(query, columns)
      .then((data) => { if (Array.isArray(data)) setRows(data); })
      .catch(() => { fetched.current = false; })
      .finally(() => setLoading(false));
  }, [table, query, columns]);

  return { rows, setRows, loading, load };
}
