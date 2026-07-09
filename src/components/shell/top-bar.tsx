import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Bell, BellRing, CheckCheck, User, LogOut, LogIn, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications, formatTimeAgo, getNotificationColor, getNotificationBg } from "@/context/notification-context";

const ROLE_COLOR: Record<string, string> = {
  administrator: "#DC2626",
  "clinical-director": "#2563EB",
  supervisor: "#D97706",
  "hr-director": "#245C5A",
  "qa-officer": "#7C3AED",
  "gro-staff": "#059669",
  "training-coordinator": "#0891B2",
  "operations-manager": "#EA580C",
};

interface TopBarProps {
  onMenuToggle?: () => void;
  menuOpen?: boolean;
}

/* ─── Safe notification item renderer ─── */
function SafeNotificationItem({
  n,
  onMarkRead,
}: {
  n: Record<string, any>
  onMarkRead: (id: string) => void
}) {
  try {
    const id = n?.id || "unknown"
    const type = n?.type || "system"
    const title = n?.title || "Notification"
    const message = n?.message || ""
    const read = !!n?.read
    const timestamp = n?.timestamp || new Date().toISOString()

    return (
      <div
        key={id}
        className="flex items-start gap-3 px-4 py-3 border-b cursor-pointer transition-all hover:bg-gray-50"
        style={{
          borderColor: "var(--card-border, #E2E8F0)",
          backgroundColor: read ? "transparent" : getNotificationBg(type),
        }}
        onClick={() => onMarkRead(String(id))}
      >
        <div
          className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
          style={{ backgroundColor: getNotificationColor(type) }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className="text-[12px] font-semibold"
              style={{ color: read ? "var(--topbar-title)" : "#245C5A" }}
            >
              {title}
            </p>
            {!read && (
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: "#245C5A" }}
              />
            )}
          </div>
          {message && (
            <p
              className="text-[11px] mt-0.5 leading-relaxed"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              {message}
            </p>
          )}
          <p className="text-[10px] mt-1" style={{ color: "#94A3B8" }}>
            {formatTimeAgo(timestamp)}
          </p>
        </div>
      </div>
    )
  } catch {
    // If a single notification fails to render, skip it
    return null
  }
}

export function TopBar({ onMenuToggle, menuOpen }: TopBarProps) {
  const { user, logout } = useAuth()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [showNotifMenu, setShowNotifMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const notifMenuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const roleColor = ROLE_COLOR[user?.role ?? "staff"] ?? "#6B7280"
  const roleLabel = user?.role
    ? user.role.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())
    : "Guest"

  // Close menus on escape key
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowNotifMenu(false)
        setShowUserMenu(false)
      }
    }
    document.addEventListener("keydown", handleEsc)
    return () => document.removeEventListener("keydown", handleEsc)
  }, [])

  // Click-outside handler — wrapped in useCallback to avoid re-registers
  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as Node
    if (notifMenuRef.current && !notifMenuRef.current.contains(target)) {
      setShowNotifMenu(false)
    }
    if (userMenuRef.current && !userMenuRef.current.contains(target)) {
      setShowUserMenu(false)
    }
  }, [])

  useEffect(() => {
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [handleClickOutside])

  // Defensive: ensure notifications is always an array
  const safeNotifications = Array.isArray(notifications) ? notifications : []
  const safeUnreadCount = typeof unreadCount === "number" ? unreadCount : 0

  const handleToggleNotif = useCallback(() => {
    setShowNotifMenu((prev) => !prev)
    setShowUserMenu(false)
  }, [])

  const handleToggleUser = useCallback(() => {
    setShowUserMenu((prev) => !prev)
    setShowNotifMenu(false)
  }, [])

  const handleMarkRead = useCallback(
    (id: string) => {
      try {
        markAsRead(id)
      } catch (err) {
        console.error("[TopBar] markAsRead failed:", err)
      }
      setShowNotifMenu(false)
    },
    [markAsRead]
  )

  const handleMarkAllRead = useCallback(() => {
    try {
      markAllAsRead()
    } catch (err) {
      console.error("[TopBar] markAllAsRead failed:", err)
    }
  }, [markAllAsRead])

  return (
    <header
      className="h-[56px] flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40"
      style={{
        backgroundColor: "var(--topbar-bg)",
        borderBottom: "1px solid var(--topbar-border)",
      }}
    >
      {/* ─── Left: Hamburger (mobile) + Branding ─── */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          onClick={onMenuToggle}
          className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg border transition-all flex-shrink-0"
          style={{
            backgroundColor: menuOpen ? "#F0FDFA" : "var(--role-badge-bg, #FFFFFF)",
            borderColor: menuOpen ? "#245C5A" : "var(--role-badge-border, #E2E8F0)",
          }}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={18} style={{ color: "#245C5A" }} /> : <Menu size={18} style={{ color: "#64748B" }} />}
        </button>

        <div className="flex flex-col min-w-0">
          <span className="text-[16px] font-semibold leading-tight truncate" style={{ color: "var(--topbar-title)" }}>
            AMOS Intranet
          </span>
          <span className="text-[13px] leading-tight truncate hidden sm:block" style={{ color: "var(--topbar-subtitle)" }}>
            {user?.department ?? "Behavioral Health Center"}
          </span>
        </div>
      </div>

      {/* ─── Center: Role badge ─── */}
      <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
        <span
          className="px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide"
          style={{ backgroundColor: roleColor + "15", color: roleColor, border: `1px solid ${roleColor}30` }}
        >
          {roleLabel}
        </span>
      </div>

      {/* ─── Right: Notifications + Search + User ─── */}
      <div className="flex items-center gap-2 lg:gap-3 flex-shrink-0">
        {/* Notification Bell */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={handleToggleNotif}
            className="relative flex items-center justify-center w-9 h-9 lg:w-10 lg:h-10 rounded-lg border transition-all"
            style={{
              backgroundColor: showNotifMenu ? "#F0FDFA" : "var(--role-badge-bg, #FFFFFF)",
              borderColor: showNotifMenu ? "#245C5A" : "var(--role-badge-border, #E2E8F0)",
            }}
          >
            {safeUnreadCount > 0 ? (
              <BellRing size={16} style={{ color: "#DC2626" }} />
            ) : (
              <Bell size={16} style={{ color: "#94A3B8" }} />
            )}
            {safeUnreadCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white px-1"
                style={{ backgroundColor: "#DC2626" }}
              >
                {safeUnreadCount > 99 ? "99+" : safeUnreadCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div
              className="absolute right-0 top-full mt-1 w-[340px] sm:w-[380px] max-h-[480px] rounded-lg border shadow-lg overflow-hidden flex flex-col"
              style={{
                backgroundColor: "var(--card-bg, #FFFFFF)",
                borderColor: "var(--card-border, #E2E8F0)",
                zIndex: 50,
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
                style={{ borderColor: "var(--card-border, #E2E8F0)" }}
              >
                <div className="flex items-center gap-2">
                  <Bell size={15} style={{ color: "#245C5A" }} />
                  <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                    Notifications
                  </p>
                  {safeUnreadCount > 0 && (
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
                      style={{ backgroundColor: "#DC2626" }}
                    >
                      {safeUnreadCount}
                    </span>
                  )}
                </div>
                {safeUnreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:opacity-70"
                    style={{ color: "#245C5A" }}
                  >
                    <CheckCheck size={12} /> Mark all read
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto">
                {safeNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Bell size={24} style={{ color: "#CBD5E1" }} />
                    <p className="text-[12px] mt-2" style={{ color: "#94A3B8" }}>
                      No notifications
                    </p>
                  </div>
                ) : (
                  safeNotifications.map((n, i) => (
                    <SafeNotificationItem key={n?.id ?? i} n={n} onMarkRead={handleMarkRead} />
                  ))
                )}
              </div>
              <div
                className="px-4 py-2 border-t flex-shrink-0 text-center"
                style={{ borderColor: "var(--card-border, #E2E8F0)", backgroundColor: "#F8FAFC" }}
              >
                <p className="text-[10px]" style={{ color: "#94A3B8" }}>
                  {safeNotifications.filter((n) => !n?.read).length} unread of {safeNotifications.length} total
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div
          className="hidden md:flex items-center gap-2 px-4 py-[8px] rounded-lg w-[260px]"
          style={{ backgroundColor: "var(--search-bg)" }}
        >
          <Search size={16} style={{ color: "var(--search-text)" }} />
          <span className="text-[14px] flex-1" style={{ color: "var(--search-text)" }}>
            Search workspaces
          </span>
          <kbd
            className="text-[11px] px-1.5 py-0.5 rounded font-medium"
            style={{ backgroundColor: "#E2E8F0", color: "#64748B" }}
          >
            Ctrl K
          </kbd>
        </div>

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={handleToggleUser}
            className="flex items-center justify-center w-9 h-9 lg:w-10 lg:h-10 rounded-lg border transition-all"
            style={{
              backgroundColor: showUserMenu ? "#F0FDFA" : "var(--role-badge-bg, #FFFFFF)",
              borderColor: showUserMenu ? "#245C5A" : "var(--role-badge-border, #E2E8F0)",
            }}
          >
            <User size={16} style={{ color: user ? "#245C5A" : "#94A3B8" }} />
          </button>

          {showUserMenu && (
            <div
              className="absolute right-0 top-full mt-1 w-[240px] rounded-lg border shadow-lg overflow-hidden"
              style={{
                backgroundColor: "var(--card-bg, #FFFFFF)",
                borderColor: "var(--card-border, #E2E8F0)",
                zIndex: 50,
              }}
            >
              {user ? (
                <>
                  <div
                    className="px-4 py-3 border-b"
                    style={{ borderColor: "var(--card-border, #E2E8F0)", backgroundColor: "#F8FAFC" }}
                  >
                    <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--topbar-subtitle)" }}>
                      {user.email}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: roleColor }} />
                      <span className="text-[10px] font-medium" style={{ color: roleColor }}>
                        {roleLabel}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      logout()
                      setShowUserMenu(false)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-all hover:bg-red-50"
                  >
                    <LogOut size={14} style={{ color: "#DC2626" }} />
                    <span className="text-[13px] font-medium" style={{ color: "#DC2626" }}>
                      Sign Out
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <div
                    className="px-4 py-3 border-b"
                    style={{ borderColor: "var(--card-border, #E2E8F0)", backgroundColor: "#F8FAFC" }}
                  >
                    <p
                      className="text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: "#94A3B8" }}
                    >
                      Not Signed In
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      window.location.hash = "/login"
                      setShowUserMenu(false)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-all hover:bg-[#F0FDFA]"
                  >
                    <LogIn size={14} style={{ color: "#245C5A" }} />
                    <span className="text-[13px] font-medium" style={{ color: "#245C5A" }}>
                      Sign In
                    </span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
