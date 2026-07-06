import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[AMOS-OPS Error Boundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  handleClearAndReload = () => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key) localStorage.removeItem(key);
      }
      sessionStorage.clear();
    } catch { /* ignore */ }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "var(--main-bg)" }}>
          <div className="max-w-md w-full text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: "#FEE2E2" }}
            >
              <AlertTriangle size={28} style={{ color: "#DC2626" }} />
            </div>
            <h2 className="text-[18px] font-bold mb-2" style={{ color: "var(--topbar-title)" }}>
              Something went wrong
            </h2>
            <p className="text-[13px] mb-4" style={{ color: "var(--topbar-subtitle)" }}>
              An error occurred in the application. This has been logged for review.
            </p>
            {this.state.error && (
              <div
                className="rounded-lg border p-3 mb-4 text-left"
                style={{ borderColor: "#FEE2E2", backgroundColor: "#FEF2F2" }}
              >
                <p className="text-[11px] font-mono" style={{ color: "#991B1B" }}>
                  {this.state.error.message}
                </p>
              </div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={this.handleClearAndReload}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium text-white transition-all hover:shadow-md"
                style={{ backgroundColor: "#DC2626" }}
              >
                <RotateCcw size={14} />
                Clear Data & Reload
              </button>
              <button
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all hover:shadow-md"
                style={{ backgroundColor: "transparent", border: "1px solid #2D5A58", color: "#B8D4D3" }}
              >
                Try Again
              </button>
            </div>
            <p style={{ color: "#5A7A78", fontSize: 11, marginTop: 16, textAlign: "center" }}>
              If this keeps happening, add <code style={{ background: "#1a3a38", padding: "2px 6px", borderRadius: 4, color: "#7EC8CA" }}>?resetamos=true</code> to the URL
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
