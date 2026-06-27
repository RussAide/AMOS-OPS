import { LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { navSections } from "@/data/navData";
import { useAuth } from "@/hooks/useAuth";

const SECTION_VISIBILITY_KEY: Record<string, string> = {
  "OPERATIONS": "operations",
  "COMPLIANCE": "compliance",
  "REPORTS": "hr",
  "HUMAN RESOURCES": "hr",
  "WORKFORCE ACTIVATION": "activation",
  "WORKFORCE MANAGEMENT": "management",
  "ADMIN": "admin",
};

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { getRoleDef, navVisibility } = useAuth();
  const currentPath = location.pathname;
  const roleDef = getRoleDef();

  const handleNavClick = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(href);
  };

  // Filter sections based on role visibility
  const visibleSections = navSections.filter((section) => {
    const key = SECTION_VISIBILITY_KEY[section.title];
    if (!key) return true; // unknown sections default visible
    return navVisibility[key] !== false;
  });

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-[240px] flex flex-col overflow-y-auto z-50"
      style={{
        background: "linear-gradient(180deg, #1A3B3A 0%, #142E2D 100%)",
      }}
    >
      {/* ─── Brand Block ─── */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: "#245C5A" }}
          >
            AC
          </div>
          <div className="flex flex-col">
            <span className="text-white font-bold text-[15px] leading-tight">
              Adolbi AMOS-OPS
            </span>
            <span
              className="text-[12px] leading-tight"
              style={{ color: "#8CB5B3" }}
            >
              Intranet IA - M1
            </span>
          </div>
        </div>
      </div>

      {/* ─── Divider ─── */}
      <div className="mx-4 h-px" style={{ backgroundColor: "#2D5A58" }} />

      {/* ─── Current Role Badge ─── */}
      <div className="px-4 pt-4 pb-2">
        <p
          className="text-[11px] font-semibold uppercase tracking-[1.5px] mb-2"
          style={{ color: "#5A9E9C" }}
        >
          CURRENT ROLE
        </p>
        <div
          className="rounded-lg px-4 py-3 flex items-center gap-2"
          style={{ backgroundColor: roleDef.badgeColor + "22", border: `1px solid ${roleDef.badgeColor}44` }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: roleDef.badgeColor }}
          />
          <span className="text-white font-medium text-[14px]">{roleDef.label}</span>
        </div>
        <p className="text-[10px] mt-1.5 px-1" style={{ color: "#8CB5B3" }}>
          {roleDef.description}
        </p>
      </div>

      {/* ─── Navigation Sections ─── */}
      <nav className="flex-1 px-3 py-2">
        {visibleSections.map((section) => (
          <div key={section.title} className="mb-5">
            <p
              className="text-[11px] font-semibold uppercase tracking-[1.5px] px-3 mb-1"
              style={{ color: "#5A9E9C" }}
            >
              {section.title}
            </p>
            {section.items.map((item) => {
              const isActive =
                item.href === "/onboarding"
                  ? currentPath.startsWith("/onboarding")
                  : item.href === "/hr"
                  ? currentPath.startsWith("/hr")
                  : currentPath === item.href;

              return (
                <button
                  key={item.href}
                  className="w-full flex flex-col rounded-md px-3 py-[10px] mx-0 mb-[2px] transition-colors duration-150 text-left border-none"
                  style={{
                    backgroundColor: isActive
                      ? "#245C5A"
                      : "transparent",
                    borderLeft: isActive
                      ? "3px solid #7EC8CA"
                      : "3px solid transparent",
                    cursor: "pointer",
                  }}
                  onClick={handleNavClick(item.href)}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor =
                        "rgba(255,255,255,0.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  <span
                    className="text-[14px] font-medium leading-tight"
                    style={{ color: isActive ? "#FFFFFF" : "#E8F0EF" }}
                  >
                    {item.label}
                  </span>
                  <span
                    className="text-[11px] mt-[2px] leading-tight"
                    style={{ color: "#8CB5B3" }}
                  >
                    {item.agent}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ─── Bottom Divider ─── */}
      <div className="mx-4 h-px" style={{ backgroundColor: "#2D5A58" }} />

      {/* ─── Logout ─── */}
      <div className="px-3 py-3">
        <button
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md transition-colors duration-100 border-none"
          style={{ color: "#8CB5B3", cursor: "pointer", background: "transparent" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)";
            e.currentTarget.style.color = "#E8F0EF";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "#8CB5B3";
          }}
        >
          <LogOut size={16} />
          <span className="text-[14px]">Logout</span>
        </button>
      </div>
    </aside>
  );
}
