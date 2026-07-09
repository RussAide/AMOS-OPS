import { Outlet } from "react-router-dom";
import { HRProvider } from "@/context/hr-context";

export function HRLayout() {
  return (
    <HRProvider>
      <div className="min-h-screen" style={{ backgroundColor: "var(--main-bg)" }}>
        <Outlet />
      </div>
    </HRProvider>
  );
}

export default HRLayout;
