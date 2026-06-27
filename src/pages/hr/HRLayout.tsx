import { Outlet } from "react-router-dom";
import { HRProvider } from "@/context/HRContext";

export function HRLayout() {
  return (
    <HRProvider>
      <div className="min-h-screen" style={{ backgroundColor: "var(--main-bg)" }}>
        <Outlet />
      </div>
    </HRProvider>
  );
}
