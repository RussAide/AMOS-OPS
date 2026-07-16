import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, LogOut, Shield } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { bottomNavItems } from "@/data/navData";
import {
  flattenSidebarLinks,
  getSidebarNavigation,
  type SidebarNavGroup,
  type SidebarNavLink,
  type SidebarNavNode,
} from "@/data/sidebar-navigation";
import { runtimeConfig } from "@/config/runtime";
import { useAuth } from "@/hooks/use-auth";
import {
  DIVISIONS,
  ROLE_DEFINITIONS,
  getDivisionCategory,
  type UserRole,
} from "@/constants/roles";

interface AppSidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

function pathMatches(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function findActiveHref(
  nodes: readonly SidebarNavNode[],
  pathname: string,
): string | null {
  return (
    flattenSidebarLinks(nodes)
      .filter((link) => pathMatches(link.href, pathname))
      .sort((left, right) => right.href.length - left.href.length)[0]?.href ??
    null
  );
}

function containsHref(group: SidebarNavGroup, href: string | null): boolean {
  return (
    href !== null &&
    flattenSidebarLinks(group.children).some((link) => link.href === href)
  );
}

export function AppSidebar({ mobile = false, onNavigate }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, currentRole, setRole, permissions, workspace } = useAuth();
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const runtimeMode = workspace === "training" ? "demo" : "production";
  const navigation = useMemo(
    () => getSidebarNavigation(currentRole, runtimeMode),
    [currentRole, runtimeMode],
  );
  const activeHref = useMemo(
    () => findActiveHref(navigation, location.pathname),
    [navigation, location.pathname],
  );

  const primaryRoles: UserRole[] = [
    "administrator",
    "bhc-director",
    "gro-administrator",
    "hr-director",
    "clinical-director",
    "ccmg-program-director",
    "rcs-day",
  ];

  const visibleBottomItems = bottomNavItems.filter((item) => {
    if (item.href === "/admin/settings") return permissions.canViewAdmin;
    if (item.href === "/personas") return permissions.canEditAdmin;
    return true;
  });

  const handleNavClick = (href: string) => {
    navigate(href);
    onNavigate?.();
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderLink = (link: SidebarNavLink, depth: number) => {
    const isActive = activeHref === link.href;
    const Icon = link.icon;
    return (
      <button
        key={link.id}
        type="button"
        aria-current={isActive ? "page" : undefined}
        className="mb-px flex w-full items-center gap-2 rounded-md border-none py-2 pr-2 text-left transition-colors duration-150 hover:bg-white/[0.04]"
        style={{
          paddingLeft: 12 + depth * 13,
          backgroundColor: isActive ? "rgba(126,200,202,0.12)" : "transparent",
          borderLeft: isActive ? "2px solid #7EC8CA" : "2px solid transparent",
          cursor: "pointer",
        }}
        onClick={() => handleNavClick(link.href)}
      >
        <Icon
          size={depth === 0 ? 16 : 14}
          style={{ color: isActive ? "#7EC8CA" : "#6B9B99", flexShrink: 0 }}
        />
        <span
          className={`${depth === 0 ? "text-[12px]" : "text-[11px]"} min-w-0 flex-1 truncate font-medium leading-tight`}
          style={{ color: isActive ? "#FFFFFF" : "#B8D4D3" }}
        >
          {link.label}
        </span>
      </button>
    );
  };

  const renderGroup = (group: SidebarNavGroup, depth: number) => {
    const branchActive = containsHref(group, activeHref);
    const isOpen = branchActive || expandedGroups.has(group.id);
    const Icon = group.icon;
    const division = group.division ? DIVISIONS[group.division] : null;
    return (
      <div key={group.id} className={depth === 0 ? "mb-1" : "mb-px"}>
        <button
          type="button"
          aria-expanded={isOpen}
          className="flex w-full items-center gap-2 rounded-md border-none py-2 pr-2 text-left transition-colors duration-150 hover:bg-white/[0.04]"
          style={{
            paddingLeft: 12 + depth * 13,
            backgroundColor: branchActive
              ? "rgba(255,255,255,0.035)"
              : "transparent",
            cursor: "pointer",
          }}
          onClick={() => toggleGroup(group.id)}
        >
          <Icon
            size={depth === 0 ? 16 : 14}
            style={{
              color: branchActive ? "#7EC8CA" : "#6B9B99",
              flexShrink: 0,
            }}
          />
          <span
            className={`${depth === 0 ? "text-[12px]" : "text-[11px]"} min-w-0 flex-1 truncate font-semibold leading-tight`}
            style={{ color: branchActive ? "#FFFFFF" : "#B8D4D3" }}
          >
            {group.label}
          </span>
          {division && depth === 0 && (
            <span
              className="flex-shrink-0 rounded px-1 py-0.5 text-[7px] font-bold leading-none"
              style={{
                backgroundColor: `${division.color}22`,
                color: division.color,
                border: `1px solid ${division.color}44`,
              }}
              title={`${division.code} — ${division.category === "profit-center" ? "Profit Center" : "Corporate Office"}`}
            >
              {division.code} · {division.categoryTag}
            </span>
          )}
          {isOpen ? (
            <ChevronDown
              size={13}
              style={{ color: "#6B9B99", flexShrink: 0 }}
            />
          ) : (
            <ChevronRight
              size={13}
              style={{ color: "#6B9B99", flexShrink: 0 }}
            />
          )}
        </button>
        {isOpen && (
          <div
            className="ml-3"
            style={{ borderLeft: depth < 2 ? "1px solid #1e403e" : undefined }}
          >
            {group.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderNode = (node: SidebarNavNode, depth = 0): React.ReactNode =>
    node.type === "link" ? renderLink(node, depth) : renderGroup(node, depth);

  return (
    <aside
      className={`z-50 flex h-screen flex-col overflow-hidden ${
        mobile ? "fixed left-0 top-0 w-[280px]" : "w-[272px] flex-shrink-0"
      }`}
      style={{
        background:
          "linear-gradient(180deg, #0f2524 0%, #142E2D 50%, #0f2524 100%)",
      }}
    >
      <div className="flex-shrink-0 pb-2 pt-5">
        <img
          src="/assets/AMOS-OPS_Logo_Vertical_Dark.png"
          alt="AMOS-OPS"
          className="mx-auto w-[200px]"
          draggable={false}
        />
      </div>

      <div
        className="mx-4 h-px flex-shrink-0"
        style={{ backgroundColor: "#1e403e" }}
      />

      {runtimeConfig.evaluationMode ? (
        <RoleSwitcher
          currentRole={currentRole}
          onRoleChange={setRole}
          roles={primaryRoles}
        />
      ) : (
        <CurrentRoleCard currentRole={currentRole} />
      )}

      <nav
        aria-label="AMOS workspace"
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-1"
      >
        {navigation.map((node) => renderNode(node))}
      </nav>

      <div className="flex-shrink-0" style={{ borderTop: "1px solid #1e403e" }}>
        {visibleBottomItems.length > 0 && (
          <div className="px-3 pb-1 pt-2">
            {visibleBottomItems.map((item) => {
              const isActive = activeHref === item.href;
              return (
                <button
                  key={item.href}
                  type="button"
                  className="mb-px flex w-full items-center gap-2.5 rounded-md border-none px-3 py-2 text-left transition-colors duration-150 hover:bg-white/[0.04]"
                  style={{
                    backgroundColor: isActive
                      ? "rgba(126,200,202,0.12)"
                      : "transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => handleNavClick(item.href)}
                >
                  <item.icon
                    size={14}
                    style={{ color: isActive ? "#7EC8CA" : "#5A7A78" }}
                  />
                  <span
                    className="truncate text-[11px] font-medium"
                    style={{ color: isActive ? "#FFFFFF" : "#6B8B88" }}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="px-3 pb-3 pt-1">
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-md border-none px-3 py-2 transition-colors duration-150 hover:bg-white/[0.04]"
            style={{
              color: "#6B8B88",
              cursor: "pointer",
              background: "transparent",
            }}
            onClick={logout}
          >
            <LogOut size={14} />
            <span className="text-[11px] font-medium">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

function CurrentRoleCard({ currentRole }: { currentRole: UserRole }) {
  const currentDef =
    ROLE_DEFINITIONS.find((role) => role.id === currentRole) ??
    ROLE_DEFINITIONS[0];
  const division = DIVISIONS[currentDef.division];
  return (
    <div className="flex-shrink-0 px-4 py-3">
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2"
        style={{
          backgroundColor: `${currentDef.badgeColor}14`,
          border: `1px solid ${currentDef.badgeColor}2E`,
        }}
      >
        <div
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ backgroundColor: currentDef.badgeColor }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium text-white">
            {currentDef.label}
          </div>
          <div className="truncate text-[9px]" style={{ color: "#6B9B99" }}>
            {currentDef.department}
          </div>
        </div>
        <span
          className="flex-shrink-0 rounded px-1 py-0.5 text-[7px] font-bold leading-none"
          style={{
            backgroundColor: `${division.color}22`,
            color: division.color,
            border: `1px solid ${division.color}44`,
          }}
          title={division.name}
        >
          {division.code}
        </span>
      </div>
    </div>
  );
}

interface RoleSwitcherProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  roles: UserRole[];
}

function RoleSwitcher({ currentRole, onRoleChange, roles }: RoleSwitcherProps) {
  const [open, setOpen] = useState(false);
  const currentDef =
    ROLE_DEFINITIONS.find((role) => role.id === currentRole) ??
    ROLE_DEFINITIONS[0];
  const currentDivision = DIVISIONS[currentDef.division];

  return (
    <div className="relative flex-shrink-0 px-4 pb-2 pt-3">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg border-none px-3 py-2 text-left transition-colors duration-150"
        style={{
          backgroundColor: `${currentDef.badgeColor}18`,
          border: `1px solid ${currentDef.badgeColor}33`,
          cursor: "pointer",
        }}
        onClick={() => setOpen((value) => !value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      >
        <div
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ backgroundColor: currentDef.badgeColor }}
        />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-white">
          {currentDef.label}
        </span>
        <span
          className="flex-shrink-0 rounded px-1 py-0.5 text-[7px] font-bold leading-none"
          style={{
            backgroundColor: `${currentDivision.color}22`,
            color: currentDivision.color,
            border: `1px solid ${currentDivision.color}44`,
          }}
        >
          {currentDivision.code}
        </span>
        <ChevronDown
          size={12}
          style={{
            color: currentDef.badgeColor,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 0.15s",
          }}
        />
      </button>

      {open && (
        <div
          className="absolute left-4 right-4 top-full z-50 mt-1 rounded-lg py-1"
          style={{
            backgroundColor: "#1a3a38",
            border: "1px solid #2D5A58",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          <p
            className="px-3 py-1 text-[9px] font-semibold uppercase tracking-[1px]"
            style={{ color: "#4A7A78" }}
          >
            Preview role
          </p>
          {roles.map((roleId) => {
            const definition = ROLE_DEFINITIONS.find(
              (role) => role.id === roleId,
            )!;
            const isActive = roleId === currentRole;
            const divisionCategory = getDivisionCategory(roleId);
            const division = DIVISIONS[definition.division];
            return (
              <button
                key={roleId}
                type="button"
                className="flex w-full items-center gap-2 border-none px-3 py-1.5 text-left transition-colors duration-100 hover:bg-white/[0.04]"
                style={{
                  backgroundColor: isActive
                    ? `${division.color}18`
                    : "transparent",
                  cursor: "pointer",
                }}
                onClick={() => {
                  onRoleChange(roleId);
                  setOpen(false);
                }}
              >
                <div
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: definition.badgeColor }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span
                      className="block truncate text-[11px] font-medium"
                      style={{ color: isActive ? "#FFFFFF" : "#B8D4D3" }}
                    >
                      {definition.label}
                    </span>
                    <span
                      className="flex-shrink-0 rounded px-1 py-0.5 text-[7px] font-bold leading-none"
                      style={{
                        backgroundColor: `${division.color}22`,
                        color: division.color,
                        border: `1px solid ${division.color}44`,
                      }}
                      title={
                        divisionCategory === "profit-center"
                          ? "Profit Center"
                          : "Corporate Office"
                      }
                    >
                      {division.code}
                    </span>
                  </div>
                  <span
                    className="block truncate text-[9px]"
                    style={{ color: "#4A7A78" }}
                  >
                    {definition.department}
                  </span>
                </div>
                {isActive && (
                  <Shield
                    size={10}
                    style={{ color: "#7EC8CA", flexShrink: 0 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
