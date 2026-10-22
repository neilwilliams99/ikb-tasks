import { Component } from "react";

// A render error used to unmount the whole app and leave a black page, with
// nothing to report. This catches it, keeps the rest of the site usable and
// shows what went wrong so it can be pasted into a bug report.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Caught by ErrorBoundary:", error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const where = this.props.label ? ` on ${this.props.label}` : "";
    return (
      <div className="card" role="alert">
        <div className="section-title">Something went wrong{where}</div>
        <p style={{ margin: "0 0 14px", color: "var(--text-secondary)" }}>
          The rest of the site still works — switch tabs to carry on. If it keeps happening, send this message to info@ikbeng.com.
        </p>
        <pre className="mono" style={{
          margin: "0 0 16px", padding: "10px 12px", overflowX: "auto",
          background: "var(--dark-900)", border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-sm)", fontSize: "0.72rem", color: "var(--fail)", whiteSpace: "pre-wrap",
        }}>{String(error?.message || error)}</pre>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>Try again</button>
          <button className="btn btn-ghost" onClick={() => window.location.reload()}>Reload the page</button>
        </div>
      </div>
    );
  }
}
