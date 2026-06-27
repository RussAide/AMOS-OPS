import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { trpc } from "@/providers/trpc";

// ─── Types ────────────────────────────────────────────────────

export type NotificationType = "status-change" | "alert" | "document" | "training" | "system";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  personName?: string;
  moduleName?: string;
  timestamp: string;
  read: boolean;
  actionHref?: string;
}

// ─── Notifications ────────────────────────────────────────────

const INITIAL_NOTIFICATIONS: AppNotification[] = [];

// ─── Context ──────────────────────────────────────────────────

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (notif: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
}

const NotificationContext = createContext<NotificationState | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [localNotifications, setLocalNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);

  // Fetch notifications from API when authenticated
  const { data: apiNotifications } = trpc.notifications.list.useQuery(
    { userId: "current" },
    { enabled: false }
  );

  const markAsReadMutation = trpc.notifications.markAsRead.useMutation();
  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation();
  const createMutation = trpc.notifications.create.useMutation();
  const utils = trpc.useUtils();

  // Sync API notifications if available
  useEffect(() => {
    if (apiNotifications && apiNotifications.length > 0) {
      setLocalNotifications(
        apiNotifications.map((n: any) => ({
          id: n.id,
          type: n.type as NotificationType,
          title: n.title,
          message: n.message,
          personName: n.personName || undefined,
          moduleName: n.moduleName || undefined,
          timestamp: n.createdAt,
          read: !!n.isRead,
          actionHref: n.actionHref || undefined,
        }))
      );
    }
  }, [apiNotifications]);

  const unreadCount = localNotifications.filter((n) => !n.read).length;

  const markAsRead = useCallback(
    async (id: string) => {
      setLocalNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      try {
        await markAsReadMutation.mutateAsync({ id });
        utils.notifications.list.invalidate();
      } catch {
        // Local update already applied
      }
    },
    [markAsReadMutation, utils]
  );

  const markAllAsRead = useCallback(async () => {
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllAsReadMutation.mutateAsync({ userId: "current" });
      utils.notifications.list.invalidate();
    } catch {
      // Local update already applied
    }
  }, [markAllAsReadMutation, utils]);

  const addNotification = useCallback(
    async (notif: Omit<AppNotification, "id" | "timestamp" | "read">) => {
      const newNotif: AppNotification = {
        ...notif,
        id: `notif-${Date.now()}`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      setLocalNotifications((prev) => [newNotif, ...prev]);

      try {
        await createMutation.mutateAsync({
          userId: "current",
          type: notif.type,
          title: notif.title,
          message: notif.message,
          personName: notif.personName,
          moduleName: notif.moduleName,
          actionHref: notif.actionHref,
        });
        utils.notifications.list.invalidate();
      } catch {
        // Local update already applied
      }
    },
    [createMutation, utils]
  );

  return (
    <NotificationContext.Provider
      value={{ notifications: localNotifications, unreadCount, markAsRead, markAllAsRead, addNotification }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}

// ─── Helpers ──────────────────────────────────────────────────

export function formatTimeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case "status-change": return "#245C5A";
    case "alert": return "#DC2626";
    case "document": return "#D97706";
    case "training": return "#2563EB";
    case "system": return "#6B7280";
    default: return "#6B7280";
  }
}

export function getNotificationBg(type: NotificationType): string {
  switch (type) {
    case "status-change": return "#F0FDFA";
    case "alert": return "#FEF2F2";
    case "document": return "#FFFBEB";
    case "training": return "#EFF6FF";
    case "system": return "#F3F4F6";
    default: return "#F3F4F6";
  }
}
