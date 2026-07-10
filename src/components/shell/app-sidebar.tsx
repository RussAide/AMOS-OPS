import { useState, useMemo } from "react";
import { LogOut, Settings, Bot, ChevronDown, Shield } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { navSections, bottomNavItems } from "@/data/navData";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_DEFINITIONS, DIVISIONS, getDivisionCategory, type UserRole } from "@/constants/roles";

/* ─── Section → navVisibility key(s) ───
   Each section maps to one or more keys in ROLE_NAV_VISIBILITY.
   A section shows if ANY of its keys are true for the current role. */
const SECTION_VISIBILITY_KEYS: Record<string, string[]> = {
  "HOME": ["dashboard"],
  "YOUTH CARE": ["clinical", "gro"],
  "RESIDENTIAL": ["gro"],
  "COMPLIANCE & REVENUE": ["qa", "revenue"],
  "WORKFORCE": ["hr"],
  "INTELLIGENCE": ["executive", "documents", "knowledge"],
};

/* ─── Individual item → navVisibility key ───
   Each nav item maps to the module key that controls its visibility.
   An item shows only if its key is true for the current role. */
/* ─── Section → Profit Center / Corporate Office category ─── */
const SECTION_CATEGORY: Record<string, { category: "pc" | "co"; label: string; color: string }> = {
  "HOME": { category: "co", label: "CO", color: "#D97706" },
  "YOUTH CARE": { category: "pc", label: "PC", color: "#C45C4A" },
  "RESIDENTIAL": { category: "pc", label: "PC", color: "#245C5A" },
  "COMPLIANCE & REVENUE": { category: "co", label: "CO", color: "#D97706" },
  "WORKFORCE": { category: "co", label: "CO", color: "#991B1B" },
  "INTELLIGENCE": { category: "co", label: "CO", color: "#991B1B" },
};

const ITEM_VISIBILITY_KEY: Record<string, string> = {
  "/": "dashboard",
  "/workflows": "dashboard",
  "/intake": "clinical",
  "/cases": "clinical",
  "/observations": "gro",
  "/meetings": "gro",
  "/crisis": "clinical",
  "/medications": "clinical",
  "/family": "gro",
  "/residential": "gro",
  "/handoffs": "gro",
  "/gro/shift-logs": "gro",
  "/gro/safety-rounds": "gro",
  "/gro/care-logs": "gro",
  "/gro/incidents": "gro",
  "/gro/supervision": "gro",
  "/gro/handoffs": "gro",
  "/gro/compliance": "gro",
  "/mobile-mar": "clinical",
  "/analytics": "dashboard",
  "/qa": "qa",
  "/toolkits/chart-audit": "qa",
  "/revenue": "revenue",
  "/authorizations": "revenue",
  "/compliance/hhsc-export": "qa",
  "/hr/personnel-files": "hr",
  "/hr/credentials": "hr",
  "/hr": "hr",
  "/hr/performance": "hr",
  "/executive": "executive",
  "/executive/mgma": "executive",
  "/executive/strategic-projects": "executive",
  "/executive/marketing-review": "executive",
  "/knowledge": "knowledge",
  "/documents": "documents",
  "/nil": "dashboard",
  "/clinical/treatment-plans": "clinical",
  "/clinical/sessions": "clinical",
  "/clinical/outcome-measures": "clinical",
  "/clinical/insurance-plans": "clinical",
  "/clinical/referrals": "clinical",
  "/clinical/cans-assessments": "clinical",
  "/clinical/service-delivery": "clinical",
};

interface AppSidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export function AppSidebar({ mobile = false, onNavigate }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { getRoleDef, navVisibility, logout, currentRole, setRole, permissions } = useAuth();
  const currentPath = location.pathname;
  const roleDef = getRoleDef();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const handleNavClick = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(href);
    if (onNavigate) onNavigate();
  };

  // 6 representative roles across all 4 divisions for the switcher
  const primaryRoles: UserRole[] = [
    "administrator",      // EO — Executive oversight
    "bhc-director",       // BHC — Division head
    "gro-administrator",  // GRO — Division head
    "hr-director",        // GAD — HR leadership
    "clinical-director",  // BHC — Clinical governance
    "rcs-day",            // GRO — Frontline staff
  ];

  // Filter bottom nav items by role permission
  const visibleBottomItems = bottomNavItems.filter((item) => {
    if (item.href === "/admin/settings") return permissions.canViewAdmin;
    if (item.href === "/personas") return permissions.canEditAdmin;
    return true;
  });

  // Build filtered sections with item-level filtering
  const filteredSections = useMemo(() => {
    return navSections
      .map((section) => {
        // Section-level check: show if ANY of the section's keys are visible
        const sectionKeys = SECTION_VISIBILITY_KEYS[section.title];
        const sectionVisible = !sectionKeys || sectionKeys.some((k) => navVisibility[k] !== false);
        if (!sectionVisible) return null;

        // Item-level check: each item shows only if its specific key is visible
        const visibleItems = section.items.filter((item) => {
          const itemKey = ITEM_VISIBILITY_KEY[item.href];
          if (!itemKey) return true; // no restriction = show
          return navVisibility[itemKey] === true;
        });

        // Only return section if it has at least one visible item
        if (visibleItems.length === 0) return null;
        return { ...section, items: visibleItems };
      })
      .filter(Boolean) as typeof navSections;
  }, [navVisibility]);

  return (
    <aside
      className={`h-screen flex flex-col overflow-hidden z-50 ${mobile ? "w-[260px] fixed left-0 top-0" : "w-[240px] flex-shrink-0"}`}
      style={{
        background: "linear-gradient(180deg, #0f2524 0%, #142E2D 50%, #0f2524 100%)",
      }}
    >
      {/* ─── Brand Block ─── */}
      <div className="pt-5 pb-2 flex-shrink-0">
        <img
          src="/assets/AMOS-OPS_Logo_Vertical_Dark.png"
          alt="AMOS-OPS"
          className="w-[200px] mx-auto"
          draggable={false}
        />
      </div>

      {/* ─── Divider ─── */}
      <div className="mx-4 h-px flex-shrink-0" style={{ backgroundColor: "#1e403e" }} />

      {/* ─── Role Switcher ─── */}
      <RoleSwitcher currentRole={currentRole} onRoleChange={setRole} roles={primaryRoles} />

      {/* ─── Navigation Sections ─── */}
      <nav className="flex-1 px-3 py-1 overflow-y-auto min-h-0">
        {filteredSections.map((section) => (
          <div key={section.title} className="mb-4">
            {/* Section Header — PC/CO badge + title */}
            <div className="flex items-center gap-1.5 px-3 mb-1">
              {(() => {
                const cat = SECTION_CATEGORY[section.title];
                if (!cat) return null;
                return (
                  <span
                    className="text-[8px] font-bold px-1 py-[1px] rounded-[2px] leading-none flex-shrink-0"
                    style={{
                      backgroundColor: cat.color + "22",
                      color: cat.color,
                      border: `1px solid ${cat.color}44`,
                    }}
                    title={cat.category === "pc" ? "Profit Center" : "Corporate Office"}
                  >
                    {cat.label}
                  </span>
                );
              })()}
              <p
                className="text-[10px] font-semibold uppercase tracking-[1.5px]"
                style={{ color: "#4A7A78" }}
              >
                {section.title}
              </p>
            </div>

            {section.items.map((item) => {
              const isActive =
                item.href === "/"
                  ? currentPath === "/"
                  : item.href === "/hr"
                  ? currentPath.startsWith("/hr")
                  : currentPath === item.href;
              const isHovered = hoveredItem === item.href;

              return (
                <button
                  key={item.href}
                  className="w-full flex items-center gap-2.5 rounded-md px-3 py-[8px] mx-0 mb-[1px] transition-colors duration-150 text-left border-none relative"
                  style={{
                    backgroundColor: isActive
                      ? "rgba(36,92,90,0.15)"
                      : isHovered
                      ? "rgba(255,255,255,0.04)"
                      : "transparent",
                    borderLeft: isActive ? "2px solid #7EC8CA" : "2px solid transparent",
                    cursor: "pointer",
                  }}
                  onClick={handleNavClick(item.href)}
                  onMouseEnter={() => setHoveredItem(item.href)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Icon */}
                  <item.icon
                    size={15}
                    style={{
                      color: isActive ? "#7EC8CA" : "#6B9B99",
                      flexShrink: 0,
                    }}
                  />
                  {/* Label — single line, no agent subtitle */}
                  <span
                    className="text-[12px] font-medium leading-tight truncate"
                    style={{ color: isActive ? "#FFFFFF" : "#B8D4D3" }}
                  >
                    {item.label}
                  </span>

                  {/* Agent tooltip on hover */}
                  {isHovered && (
                    <span
                      className="absolute left-full ml-2 px-2 py-1 rounded text-[9px] font-medium whitespace-nowrap z-50"
                      style={{
                        backgroundColor: "#1a3a38",
                        color: "#5A9E9C",
                        border: "1px solid #2D5A58",
                      }}
                    >
                      {item.agent}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ─── Bottom Bar ─── */}
      <div className="flex-shrink-0" style={{ borderTop: "1px solid #1e403e" }}>
        {/* Bottom nav items: Settings, Personas */}
        <div className="px-3 pt-2 pb-1">
          {visibleBottomItems.map((item) => {
            const isActive = currentPath === item.href;
            return (
              <button
                key={item.href}
                className="w-full flex items-center gap-2.5 rounded-md px-3 py-[7px] mb-[1px] transition-colors duration-150 text-left border-none"
                style={{
                  backgroundColor: isActive ? "rgba(36,92,90,0.15)" : "transparent",
                  borderLeft: isActive ? "2px solid #7EC8CA" : "2px solid transparent",
                  cursor: "pointer",
                }}
                onClick={handleNavClick(item.href)}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <item.icon size={14} style={{ color: isActive ? "#7EC8CA" : "#5A7A78" }} />
                <span className="text-[11px] font-medium truncate" style={{ color: isActive ? "#FFFFFF" : "#6B8B88" }}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Logout */}
        <div className="px-3 pb-3 pt-1">
          <button
            className="flex items-center gap-2.5 w-full px-3 py-[7px] rounded-md transition-colors duration-100 border-none"
            style={{ color: "#5A7A78", cursor: "pointer", background: "transparent" }}
            onClick={logout}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)";
              e.currentTarget.style.color = "#B8D4D3";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#5A7A78";
            }}
          >
            <LogOut size={14} />
            <span className="text-[11px] font-medium">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Role Switcher Dropdown
   ═══════════════════════════════════════════════════════════════ */

interface RoleSwitcherProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  roles: UserRole[];
}

function RoleSwitcher({ currentRole, onRoleChange, roles }: RoleSwitcherProps) {
  const [open, setOpen] = useState(false);
  const currentDef = ROLE_DEFINITIONS.find((r) => r.id === currentRole) ?? ROLE_DEFINITIONS[0];
  const currentDiv = DIVISIONS[currentDef.division];
  const currentCat = getDivisionCategory(currentRole);

  return (
    <div className="px-4 pt-3 pb-2 flex-shrink-0 relative">
      <button
        className="w-full rounded-lg px-3 py-2 flex items-center gap-2 transition-colors duration-150 border-none text-left"
        style={{
          backgroundColor: currentDef.badgeColor + "18",
          border: `1px solid ${currentDef.badgeColor}33`,
          cursor: "pointer",
        }}
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: currentDef.badgeColor }} />
        <span className="text-white font-medium text-[12px] truncate flex-1">{currentDef.label}</span>
        <span
          className="text-[8px] font-bold px-1 py-[1px] rounded-[2px] leading-none flex-shrink-0"
          style={{
            backgroundColor: currentDiv.color + "22",
            color: currentDiv.color,
            border: `1px solid ${currentDiv.color}44`,
          }}
          title={currentCat === "profit-center" ? "Profit Center" : "Corporate Office"}
        >
          {currentDiv.code}
        </span>
        <ChevronDown size={12} style={{ color: currentDef.badgeColor, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <div
          className="absolute left-4 right-4 top-full mt-1 rounded-lg py-1 z-50"
          style={{
            backgroundColor: "#1a3a38",
            border: "1px solid #2D5A58",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <p className="px-3 py-1 text-[9px] font-semibold uppercase tracking-[1px]" style={{ color: "#4A7A78" }}>
            Switch Role
          </p>
          {roles.map((roleId) => {
            const def = ROLE_DEFINITIONS.find((r) => r.id === roleId)!;
            const isActive = roleId === currentRole;
            const divCat = getDivisionCategory(roleId);
            const divInfo = DIVISIONS[def.division];
            return (
              <button
                key={roleId}
                className="w-full flex items-center gap-2 px-3 py-[6px] border-none text-left transition-colors duration-100"
                style={{
                  backgroundColor: isActive ? divInfo.color + "18" : "transparent",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = "transparent"; }}
                onClick={() => { onRoleChange(roleId); setOpen(false); }}
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: def.badgeColor }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-medium block truncate" style={{ color: isActive ? "#FFFFFF" : "#B8D4D3" }}>
                      {def.label}
                    </span>
                    <span
                      className="text-[7px] font-bold px-[3px] py-[1px] rounded-[2px] leading-none flex-shrink-0"
                      style={{
                        backgroundColor: divInfo.color + "22",
                        color: divInfo.color,
                        border: `1px solid ${divInfo.color}44`,
                      }}
                      title={divCat === "profit-center" ? "Profit Center" : "Corporate Office"}
                    >
                      {divInfo.code}
                    </span>
                  </div>
                  <span className="text-[9px] block truncate" style={{ color: "#4A7A78" }}>
                    {def.department}
                  </span>
                </div>
                {isActive && <Shield size={10} style={{ color: "#7EC8CA", flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
