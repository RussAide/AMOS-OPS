import { Component, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

/* ─── Router-aware retry helper (hooks can't live in classes) ─── */
function ErrorActions({ onRetry }: { onRetry: () => void }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col sm:flex-row gap-3 mt-6">
      <button
        onClick={onRetry}
        className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#245C5A] focus:ring-offset-2 focus:ring-offset-[#0a1628]"
        style={{ backgroundColor: "#245C5A" }}
      >
        <RotateCcw size={16} />
        Retry
      </button>
      <button
        onClick={() => navigate("/")}
        className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#245C5A] focus:ring-offset-2 focus:ring-offset-[#0a1628]"
        style={{
          backgroundColor: "rgba(36, 92, 90, 0.15)",
          color: "#245C5A",
          border: "1px solid rgba(36, 92, 90, 0.3)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(36, 92, 90, 0.25)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(36, 92, 90, 0.15)";
        }}
      >
        <Home size={16} />
        Go to Dashboard
      </button>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, showDetails: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, showDetails: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development; in production this could be a telemetry service
    console.error("[ErrorBoundary] Caught an error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  handleRetry = () => {
    window.location.reload();
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-screen items-center justify-center px-4"
          style={{ backgroundColor: "#0a1628" }}
        >
          <div className="max-w-md w-full text-center">
            {/* AMOS-OPS Logo */}
            <img
              src="/assets/AMOS-OPS_Logo_Small.png"
              alt="AMOS-OPS"
              className="mx-auto mb-6 h-12 w-auto object-contain"
            />

            {/* Alert icon */}
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(220, 38, 38, 0.12)" }}
            >
              <AlertTriangle size={32} color="#EF4444" />
            </div>

            {/* Heading */}
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ color: "#ffffff" }}
            >
              Something went wrong
            </h1>

            {/* Subtitle */}
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              An unexpected error occurred. Please try again or contact IT support.
            </p>

            {/* Action buttons */}
            <ErrorActions onRetry={this.handleRetry} />

            {/* Collapsible error details */}
            <div className="mt-6 text-left">
              <button
                onClick={this.toggleDetails}
                className="text-xs font-medium underline underline-offset-2 transition-colors hover:opacity-80"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {this.state.showDetails ? "Hide" : "Show"} Error Details
              </button>

              {this.state.showDetails && this.state.error && (
                <div
                  className="mt-2 rounded-lg p-3 text-left text-xs font-mono leading-relaxed overflow-auto"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.5)",
                    maxHeight: "200px",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {this.state.error.toString()}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
