import { lazy, Suspense, Component, type ReactNode } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { useAuth } from "@/hooks/useAuth";

const AppShellRoutes = lazy(() => import("@/components/shell/AppShellRoutes"));

function Loader() {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#0a1628 0%,#0d1f35 50%,#0a1628 100%)" }}>
      <div style={{ textAlign: "center" }}>
        <img src="/assets/AMOS-OPS_Logo_Small.jpg" alt="AMOS-OPS" style={{ width: 280, marginBottom: 16 }} draggable={false} />
        <p style={{ color: "#5BA8A5", fontFamily: "system-ui", fontSize: 13, fontWeight: 600, letterSpacing: "0.25em", textTransform: "uppercase", margin: 0 }}>Digital Operations System</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TOP-LEVEL ERROR BOUNDARY — Catches crashes in lazy chunk
   ═══════════════════════════════════════════════════════════════ */

interface EBProps { children: ReactNode }
interface EBState { hasError: boolean; error?: Error }

class TopLevelErrorBoundary extends Component<EBProps, EBState> {
  constructor(props: EBProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[AMOS-OPS] Top-level crash:", error, info.componentStack)
    // Track crash for auto-recovery on next load
    try {
      const count = parseInt(sessionStorage.getItem("amos_crash_count") || "0", 10) + 1
      sessionStorage.setItem("amos_crash_count", String(count))
      sessionStorage.setItem("amos_crash_ts", String(Date.now()))
    } catch { /* ignore */ }
  }

  handleClearAndReload = () => {
    // Clear all localStorage and reload
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key) localStorage.removeItem(key)
      }
      sessionStorage.clear()
    } catch { /* ignore */ }
    window.location.reload()
  }

  handleSoftReload = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,#0a1628 0%,#0d1f35 100%)", fontFamily: "system-ui,sans-serif" }}>
          <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
            <img src="/assets/AMOS-OPS_Logo_Small.jpg" alt="AMOS-OPS" style={{ width: 160, margin: "0 auto 20px", display: "block" }} draggable={false} />
            <p style={{ color: "#7EC8CA", fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>Something went wrong</p>
            <p style={{ color: "#8AB5B4", fontSize: 13, lineHeight: 1.5, margin: "0 0 20px" }}>
              The application encountered an unexpected error. This can happen when session data becomes corrupted.
            </p>

            {this.state.error && (
              <div style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 20, textAlign: "left" }}>
                <p style={{ color: "#F87171", fontSize: 11, fontFamily: "monospace", margin: 0, wordBreak: "break-all" }}>
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={this.handleClearAndReload}
                style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#245C5A", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Clear Data & Reload
              </button>
              <button
                onClick={this.handleSoftReload}
                style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #2D5A58", background: "transparent", color: "#B8D4D3", fontSize: 13, cursor: "pointer" }}
              >
                Try Again
              </button>
            </div>
            <p style={{ color: "#5A7A78", fontSize: 11, marginTop: 16 }}>
              If this keeps happening, add <code style={{ background: "#1a3a38", padding: "2px 6px", borderRadius: 4, color: "#7EC8CA" }}>?resetamos=true</code> to the URL
            </p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function AuthRouter() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) return <Loader />

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          isAuthenticated ? (
            <TopLevelErrorBoundary>
              <AppShellRoutes />
            </TopLevelErrorBoundary>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<Loader />}>
        <AuthRouter />
      </Suspense>
    </HashRouter>
  )
}
