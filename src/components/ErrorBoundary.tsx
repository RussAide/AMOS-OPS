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
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium text-white transition-all hover:shadow-md"
              style={{ backgroundColor: "#245C5A" }}
            >
              <RotateCcw size={14} />
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
