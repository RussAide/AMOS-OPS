import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--content-bg)" }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: "#245C5A", borderTopColor: "transparent" }} />
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Loading AMOS-OPS...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
