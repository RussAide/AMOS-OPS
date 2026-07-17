import {
  createContext,
  createElement,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { runtimeConfig } from "@/config/runtime";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/use-auth";

// ─── Types ────────────────────────────────────────────────────

export type NotificationType =
  "status-change" | "alert" | "document" | "training" | "system";

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

export function mayUseNotificationDemoData(
  evaluationMode: boolean,
  workspace: string | null,
): boolean {
  return evaluationMode || workspace === "training";
}

export function resolveNotificationCollection<T>(
  authoritative: T[] | undefined,
  demo: T[],
  demoAllowed: boolean,
): T[] {
  if (!demoAllowed) return authoritative ?? [];
  return authoritative && authoritative.length > 0 ? authoritative : demo;
}

function notificationDemoDataAllowed(
  workspace: "training" | "operational",
): boolean {
  return mayUseNotificationDemoData(runtimeConfig.evaluationMode, workspace);
}

// ─── Demo Notifications (isolated evaluation/training fallback) ─────

const DEMO_NOTIFICATIONS: AppNotification[] = [
  {
    id: "notif-001",
    type: "status-change",
    title: "Status Updated",
    message: "David Chen moved from Screening to Offers & Pre-Employment",
    personName: "David Chen",
    moduleName: "Offers & Pre-Employment",
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    read: false,
    actionHref: "#/hr/offers",
  },
  {
    id: "notif-002",
    type: "alert",
    title: "Active Without Clearance",
    message: "6 employees are active but have not completed clearance review",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    read: false,
    actionHref: "#/hr/clearance",
  },
  {
    id: "notif-003",
    type: "document",
    title: "Credential Expiring",
    message: "Aisha Johnson's CPR certification has expired (due: Jun 1, 2025)",
    personName: "Aisha Johnson",
    moduleName: "Credentials & Training",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    read: false,
    actionHref: "#/hr/credentials",
  },
  {
    id: "notif-004",
    type: "training",
    title: "Supervisor Competency Pending",
    message: "James Park's 90-day review is ready for supervisor sign-off",
    personName: "James Park",
    moduleName: "Performance & Corrective Action",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    read: true,
    actionHref: "#/hr/performance",
  },
  {
    id: "notif-005",
    type: "system",
    title: "Training Module Added",
    message:
      "New module 'Youth Supervision, Rights, Dignity & Boundaries' is now available in GRO Residential Track",
    moduleName: "Onboarding Academy",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    read: true,
    actionHref: "#/onboarding",
  },
  {
    id: "notif-006",
    type: "status-change",
    title: "Offer Accepted",
    message:
      "Christopher Lee has signed and returned the offer acceptance letter",
    personName: "Christopher Lee",
    moduleName: "Offers & Pre-Employment",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    read: true,
    actionHref: "#/hr/offers",
  },
  {
    id: "notif-007",
    type: "alert",
    title: "Missing Documents",
    message: "3 employees are missing required personnel file documents",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    read: true,
    actionHref: "#/hr/personnel-files",
  },
];

// ─── Context ──────────────────────────────────────────────────

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  isUnavailable: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  addNotification: (
    notif: Omit<AppNotification, "id" | "timestamp" | "read">,
  ) => void;
}

const NotificationContext = createContext<NotificationState | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { workspace } = useAuth();
  const demoAllowed = notificationDemoDataAllowed(workspace);
  const [localNotifications, setLocalNotifications] = useState<
    AppNotification[]
  >(() => {
    if (!demoAllowed || typeof localStorage === "undefined") return [];
    // Safe initialization: if localStorage has corrupted notification data, ignore it
    try {
      const stored = localStorage.getItem("amos_notifications");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0)
          return parsed as AppNotification[];
      }
    } catch {
      // Corrupted data — fall through to defaults
      localStorage.removeItem("amos_notifications");
    }
    return DEMO_NOTIFICATIONS;
  });

  // The fixed demo-user query remains disabled. Until an authenticated-user
  // query is wired, Production intentionally reports unavailable with no rows.
  const notificationQuery = trpc.notifications.list.useQuery(
    { userId: "demo-user" },
    { enabled: false, retry: false }, // Disabled by default - use demo data until auth is fully wired
  );
  const apiNotifications = notificationQuery.data;

  const markAsReadMutation = trpc.notifications.markAsRead.useMutation();
  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation();
  const createMutation = trpc.notifications.create.useMutation();
  const utils = trpc.useUtils();

  const authoritativeNotifications: AppNotification[] | undefined =
    apiNotifications?.map((notification) => ({
      id: notification.id,
      type: notification.type as NotificationType,
      title: notification.title,
      message: notification.message,
      personName: notification.personName || undefined,
      moduleName: notification.moduleName || undefined,
      timestamp: notification.createdAt ?? new Date().toISOString(),
      read: !!notification.isRead,
      actionHref: notification.actionHref || undefined,
    }));
  const notifications = resolveNotificationCollection(
    authoritativeNotifications,
    localNotifications,
    demoAllowed,
  );
  const isUnavailable =
    !demoAllowed && (!notificationQuery.isFetched || notificationQuery.isError);

  const unreadCount = notifications.filter(
    (notification) => !notification.read,
  ).length;

  const markAsRead = useCallback(
    async (id: string) => {
      if (!mayUseNotificationDemoData(runtimeConfig.evaluationMode, workspace))
        return;
      setLocalNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      try {
        await markAsReadMutation.mutateAsync({ id });
        utils.notifications.list.invalidate();
      } catch {
        // Local update already applied
      }
    },
    [markAsReadMutation, utils, workspace],
  );

  const markAllAsRead = useCallback(async () => {
    if (!mayUseNotificationDemoData(runtimeConfig.evaluationMode, workspace))
      return;
    setLocalNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllAsReadMutation.mutateAsync({ userId: "demo-user" });
      utils.notifications.list.invalidate();
    } catch {
      // Local update already applied
    }
  }, [markAllAsReadMutation, utils, workspace]);

  const addNotification = useCallback(
    async (notif: Omit<AppNotification, "id" | "timestamp" | "read">) => {
      if (!mayUseNotificationDemoData(runtimeConfig.evaluationMode, workspace))
        return;
      const newNotif: AppNotification = {
        ...notif,
        id: `notif-${Date.now()}`,
        timestamp: new Date().toISOString(),
        read: false,
      };
      setLocalNotifications((prev) => [newNotif, ...prev]);

      try {
        await createMutation.mutateAsync({
          userId: "demo-user",
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
    [createMutation, utils, workspace],
  );

  return createElement(
    NotificationContext.Provider,
    {
      value: {
        notifications,
        unreadCount,
        isUnavailable,
        markAsRead,
        markAllAsRead,
        addNotification,
      },
    },
    children,
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error(
      "useNotifications must be used within NotificationProvider",
    );
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
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case "status-change":
      return "#245C5A";
    case "alert":
      return "#DC2626";
    case "document":
      return "#D97706";
    case "training":
      return "#2563EB";
    case "system":
      return "#6B7280";
    default:
      return "#6B7280";
  }
}

export function getNotificationBg(type: NotificationType): string {
  switch (type) {
    case "status-change":
      return "#F0FDFA";
    case "alert":
      return "#FEF2F2";
    case "document":
      return "#FFFBEB";
    case "training":
      return "#EFF6FF";
    case "system":
      return "#F3F4F6";
    default:
      return "#F3F4F6";
  }
}
