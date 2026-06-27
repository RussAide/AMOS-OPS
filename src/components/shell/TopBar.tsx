import { useState, useRef, useEffect } from "react";
import { Search, Bell, BellRing, CheckCheck, User, LogOut, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications, formatTimeAgo, getNotificationColor, getNotificationBg } from "@/context/NotificationContext";

const ROLE_COLOR: Record<string, string> = {
  admin: "#DC2626", supervisor: "#2563EB", clinician: "#059669",
  hr_admin: "#7C3AED", staff: "#6B7280",
};

export function TopBar() {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const roleColor = ROLE_COLOR[user?.role ?? "staff"] ?? "#6B7280";
  const roleLabel = user?.role ? user.role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "Guest";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header
      className="h-[56px] flex items-center justify-between px-6 sticky top-0 z-40"
      style={{
        backgroundColor: "var(--topbar-bg)",
        borderBottom: "1px solid var(--topbar-border)",
      }}
    >
      {/* ─── Left: Branding ─── */}
      <div className="flex flex-col">
        <span className="text-[16px] font-semibold leading-tight" style={{ color: "var(--topbar-title)" }}>
          AMOS Intranet
        </span>
        <span className="text-[13px] leading-tight" style={{ color: "var(--topbar-subtitle)" }}>
          {user?.department ?? "Behavioral Health Center"}
        </span>
      </div>

      {/* ─── Center: Role badge ─── */}
      <div className="hidden lg:flex items-center gap-2">
        <span
          className="px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
          style={{ backgroundColor: roleColor + "15", color: roleColor, border: `1px solid ${roleColor}30` }}
        >
          {roleLabel}
        </span>
      </div>

      {/* ─── Right: Notifications + Search + User ─── */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={() => { setShowNotifMenu(!showNotifMenu); }}
            className="relative flex items-center justify-center w-9 h-9 rounded-lg border transition-all"
            style={{
              backgroundColor: showNotifMenu ? "#F0FDFA" : "var(--role-badge-bg, #FFFFFF)",
              borderColor: showNotifMenu ? "#245C5A" : "var(--role-badge-border, #E2E8F0)",
            }}
          >
            {unreadCount > 0 ? (
              <BellRing size={16} style={{ color: "#DC2626" }} />
            ) : (
              <Bell size={16} style={{ color: "#94A3B8" }} />
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1" style={{ backgroundColor: "#DC2626" }}>
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 top-full mt-1 w-[380px] max-h-[480px] rounded-lg border shadow-lg overflow-hidden flex flex-col"
              style={{ backgroundColor: "var(--card-bg, #FFFFFF)", borderColor: "var(--card-border, #E2E8F0)", zIndex: 50 }}>
              <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--card-border, #E2E8F0)" }}>
                <div className="flex items-center gap-2">
                  <Bell size={15} style={{ color: "#245C5A" }} />
                  <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>Notifications</p>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: "#DC2626" }}>{unreadCount}</span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:opacity-70" style={{ color: "#245C5A" }}>
                    <CheckCheck size={12} /> Mark all read
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Bell size={24} style={{ color: "#CBD5E1" }} />
                    <p className="text-[12px] mt-2" style={{ color: "#94A3B8" }}>No notifications</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id}
                      className="flex items-start gap-3 px-4 py-3 border-b cursor-pointer transition-all hover:bg-gray-50"
                      style={{ borderColor: "var(--card-border, #E2E8F0)", backgroundColor: n.read ? "transparent" : getNotificationBg(n.type) }}
                      onClick={() => markAsRead(n.id)}>
                      <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: getNotificationColor(n.type) }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[12px] font-semibold" style={{ color: n.read ? "var(--topbar-title)" : "#245C5A" }}>{n.title}</p>
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#245C5A" }} />}
                        </div>
                        <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--topbar-subtitle)" }}>{n.message}</p>
                        <p className="text-[10px] mt-1" style={{ color: "#94A3B8" }}>{formatTimeAgo(n.timestamp)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 py-2 border-t flex-shrink-0 text-center" style={{ borderColor: "var(--card-border, #E2E8F0)", backgroundColor: "#F8FAFC" }}>
                <p className="text-[10px]" style={{ color: "#94A3B8" }}>{notifications.filter(n => !n.read).length} unread of {notifications.length} total</p>
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="hidden md:flex items-center gap-2 px-4 py-[8px] rounded-lg w-[260px]" style={{ backgroundColor: "var(--search-bg)" }}>
          <Search size={16} style={{ color: "var(--search-text)" }} />
          <span className="text-[14px] flex-1" style={{ color: "var(--search-text)" }}>Search workspaces</span>
          <kbd className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "#E2E8F0", color: "#64748B" }}>Ctrl K</kbd>
        </div>

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifMenu(false); }}
            className="flex items-center justify-center w-9 h-9 rounded-lg border transition-all"
            style={{
              backgroundColor: showUserMenu ? "#F0FDFA" : "var(--role-badge-bg, #FFFFFF)",
              borderColor: showUserMenu ? "#245C5A" : "var(--role-badge-border, #E2E8F0)",
            }}
          >
            <User size={16} style={{ color: user ? "#245C5A" : "#94A3B8" }} />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-1 w-[240px] rounded-lg border shadow-lg overflow-hidden"
              style={{ backgroundColor: "var(--card-bg, #FFFFFF)", borderColor: "var(--card-border, #E2E8F0)", zIndex: 50 }}>
              {user ? (
                <>
                  <div className="px-4 py-3 border-b" style={{ borderColor: "var(--card-border, #E2E8F0)", backgroundColor: "#F8FAFC" }}>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{user.firstName} {user.lastName}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>{user.email}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: roleColor }} />
                      <span className="text-[10px] font-medium" style={{ color: roleColor }}>{roleLabel}</span>
                    </div>
                  </div>
                  <button onClick={() => { logout(); setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-all hover:bg-red-50">
                    <LogOut size={14} style={{ color: "#DC2626" }} />
                    <span className="text-[13px] font-medium" style={{ color: "#DC2626" }}>Sign Out</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="px-4 py-3 border-b" style={{ borderColor: "var(--card-border, #E2E8F0)", backgroundColor: "#F8FAFC" }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#94A3B8" }}>Not Signed In</p>
                  </div>
                  <button onClick={() => { window.location.hash = "/login"; setShowUserMenu(false); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-all hover:bg-[#F0FDFA]">
                    <LogIn size={14} style={{ color: "#245C5A" }} />
                    <span className="text-[13px] font-medium" style={{ color: "#245C5A" }}>Sign In</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
