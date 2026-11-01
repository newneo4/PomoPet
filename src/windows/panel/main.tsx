import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { PanelApp } from "./PanelApp";
import "./panel.css";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: "#d93829", fontFamily: "sans-serif" }}>
          <h2>Error al cargar los ajustes</h2>
          <pre
            style={{
              background: "#f5f5f5",
              padding: 12,
              borderRadius: 6,
              overflow: "auto",
            }}
          >
            {this.state.error.message}
            {"\n"}
            {this.state.error.stack}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: "8px 16px", cursor: "pointer", marginTop: 12 }}
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element in panel.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <PanelApp />
    </ErrorBoundary>
  </StrictMode>,
);
