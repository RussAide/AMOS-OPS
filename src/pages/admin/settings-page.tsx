import { useState } from "react";
import { ROLE_DEFINITIONS, useAuth } from "@/hooks/use-auth";
import { trpc } from "@/providers/trpc";
import {
  Settings,
  Users,
  ShieldCheck,
  Bell,
  Plug,
  Palette,
  Save,
  Building2,
  Lock,
  Clock,
  Mail,
  MessageSquare,
  Smartphone,
  CheckCircle,
  XCircle,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: "active" | "inactive";
  lastLogin: string;
  accessStatus: "training" | "cleared" | "suspended" | "deactivated";
  identityType: "workforce" | "external_guest";
  trainingAccess: boolean;
  sponsorName: string | null;
  accessExpiresAt: string | null;
}

const THEME_OPTIONS = ["Light", "Dark", "System Default"];
const SIDEBAR_OPTIONS = ["Expanded", "Collapsed", "Auto-hide"];

function formatTimestamp(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Never";
}

// ─── Toggle Switch Component ──────────────────────────────────
function ToggleSwitch({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: () => void;
  label?: string;
}) {
  return (
    <button
      onClick={onChange}
      className="flex items-center gap-2 cursor-pointer"
      title={label}
    >
      {enabled ? (
        <ToggleRight size={28} style={{ color: "#245C5A" }} />
      ) : (
        <ToggleLeft size={28} style={{ color: "#9CA3AF" }} />
      )}
      {label && (
        <span
          className="text-[12px] font-medium"
          style={{ color: enabled ? "#245C5A" : "#6B7280" }}
        >
          {enabled ? "On" : "Off"}
        </span>
      )}
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    | "organization"
    | "users"
    | "security"
    | "notifications"
    | "integrations"
    | "appearance"
  >("organization");
  const [savedMessage, setSavedMessage] = useState(false);
  const { user: currentUser } = useAuth();
  const trpcUtils = trpc.useUtils();

  // Organization state
  const [facilityName, setFacilityName] = useState(
    "Adolescent Behavioral Care - Houston Campus",
  );
  const [facilityAddress, setFacilityAddress] = useState(
    "2450 Fondren Road, Houston, TX 77063",
  );
  const [licenseNumber, setLicenseNumber] = useState("TX-BH-2024-0847");
  const [stateCode, setStateCode] = useState("TX");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [adminEmail, setAdminEmail] = useState("admin@example.invalid");

  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editAccessStatus, setEditAccessStatus] =
    useState<User["accessStatus"]>("training");
  const [editIdentityType, setEditIdentityType] =
    useState<User["identityType"]>("workforce");
  const [editTrainingAccess, setEditTrainingAccess] = useState(false);

  const identityPanelEnabled =
    activeTab === "users" || activeTab === "security";
  const policyQuery = trpc.auth.policy.useQuery(undefined, {
    enabled: activeTab === "security",
  });
  const usersQuery = trpc.auth.listUsers.useQuery(undefined, {
    enabled: identityPanelEnabled,
    retry: false,
  });
  const sessionsQuery = trpc.auth.listSessions.useQuery(undefined, {
    enabled: identityPanelEnabled,
    retry: false,
  });
  const reviewsQuery = trpc.auth.listAccessReviews.useQuery(undefined, {
    enabled: activeTab === "security",
    retry: false,
  });
  const updateUserMutation = trpc.auth.updateUser.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.auth.listUsers.invalidate(),
        trpcUtils.auth.listAccessReviews.invalidate(),
      ]);
    },
  });
  const createTrainingAccountMutation =
    trpc.auth.createTrainingAccount.useMutation({
      onSuccess: async () => trpcUtils.auth.listUsers.invalidate(),
    });
  const setMfaMutation = trpc.auth.setMfa.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.auth.me.invalidate(),
        trpcUtils.auth.listUsers.invalidate(),
      ]);
    },
  });
  const completeReviewMutation = trpc.auth.completeAccessReview.useMutation({
    onSuccess: async () => {
      await Promise.all([
        trpcUtils.auth.listAccessReviews.invalidate(),
        trpcUtils.auth.listUsers.invalidate(),
      ]);
    },
  });

  // Notifications state
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [alertCritical, setAlertCritical] = useState(true);
  const [alertCompliance, setAlertCompliance] = useState(true);
  const [alertSystem, setAlertSystem] = useState(true);
  const [alertUpdates, setAlertUpdates] = useState(false);

  // Integration state
  const [entraStatus, setEntraStatus] = useState<"connected" | "disconnected">(
    "connected",
  );
  const [netlifyStatus, setNetlifyStatus] = useState<
    "connected" | "disconnected"
  >("connected");
  const [railwayStatus, setRailwayStatus] = useState<
    "connected" | "disconnected"
  >("connected");

  // Appearance state
  const [theme, setTheme] = useState("Light");
  const [sidebarMode, setSidebarMode] = useState("Expanded");
  const [compactMode, setCompactMode] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  const users: User[] = (usersQuery.data ?? []).map((directoryUser) => ({
    id: directoryUser.id,
    name: `${directoryUser.firstName} ${directoryUser.lastName}`,
    email: directoryUser.email,
    role: directoryUser.role,
    department: directoryUser.department ?? "Unassigned",
    status: directoryUser.isActive ? "active" : "inactive",
    lastLogin: formatTimestamp(directoryUser.lastLoginAt),
    accessStatus: directoryUser.accessStatus,
    identityType: directoryUser.identityType,
    trainingAccess: directoryUser.trainingAccess,
    sponsorName: directoryUser.sponsorName,
    accessExpiresAt: directoryUser.accessExpiresAt,
  }));
  const activeSessions = (sessionsQuery.data ?? []).filter(
    (session) => !session.revokedAt,
  ).length;
  const totalUsers = users.length;
  const departmentCount = new Set(
    users.map((directoryUser) => directoryUser.department),
  ).size;

  // ─── Handlers ────────────────────────────────────────────────
  const handleEdit = (u: User) => {
    setEditingUser(u.id);
    setEditRole(u.role);
    setEditAccessStatus(u.accessStatus);
    setEditIdentityType(u.identityType);
    setEditTrainingAccess(u.trainingAccess);
  };

  const handleSaveUser = async (directoryUser: User) => {
    const profileChanged =
      directoryUser.accessStatus !== editAccessStatus ||
      directoryUser.identityType !== editIdentityType ||
      directoryUser.trainingAccess !== editTrainingAccess;
    const rationale = profileChanged
      ? window.prompt("Reason for this access profile change:")?.trim()
      : undefined;
    if (profileChanged && !rationale) return;
    const evidenceReference =
      editAccessStatus === "cleared" && directoryUser.accessStatus !== "cleared"
        ? window.prompt("Clearance evidence reference:")?.trim()
        : undefined;
    if (
      editAccessStatus === "cleared" &&
      directoryUser.accessStatus !== "cleared" &&
      !evidenceReference
    )
      return;
    await updateUserMutation.mutateAsync({
      id: directoryUser.id,
      role: editRole,
      accessStatus: editAccessStatus,
      identityType: editIdentityType,
      trainingAccess: editTrainingAccess,
      rationale,
      evidenceReference,
    });
    setEditingUser(null);
  };

  const handleToggleStatus = async (directoryUser: User) => {
    await updateUserMutation.mutateAsync({
      id: directoryUser.id,
      isActive: directoryUser.status !== "active",
    });
  };

  const handleCreateTrainingAccount = async () => {
    const email = window.prompt("Training user email:")?.trim();
    if (!email) return;
    const firstName = window.prompt("First name:")?.trim();
    if (!firstName) return;
    const lastName = window.prompt("Last name:")?.trim();
    if (!lastName) return;
    const sponsorName = window.prompt("Adolbi sponsor:")?.trim();
    if (!sponsorName) return;
    const external = window.confirm("Is this person an external stakeholder?");
    const result = await createTrainingAccountMutation.mutateAsync({
      email,
      firstName,
      lastName,
      role: "rcs-day",
      identityType: external ? "external_guest" : "workforce",
      sponsorName,
      rationale: external
        ? "Authorized stakeholder Training access."
        : "Pre-clearance workforce Training access.",
    });
    const invitationUrl = `${window.location.origin}/login?invite=${encodeURIComponent(result.invitationToken)}`;
    await navigator.clipboard?.writeText(invitationUrl);
    window.prompt(
      "Invitation link (copied when browser permissions allow):",
      invitationUrl,
    );
  };

  const handleAccessReview = async (
    reviewId: string,
    decision: "retain" | "modify" | "revoke",
  ) => {
    if (
      decision === "revoke" &&
      !window.confirm("Revoke this account and all of its active sessions?")
    ) {
      return;
    }
    await completeReviewMutation.mutateAsync({
      reviewId,
      decision,
      rationale: `Periodic access review decision: ${decision}.`,
    });
  };

  const handleSaveAll = () => {
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  };

  const tabConfig = [
    { key: "organization" as const, label: "Organization", icon: Building2 },
    { key: "users" as const, label: "Users", icon: Users },
    { key: "security" as const, label: "Security", icon: ShieldCheck },
    { key: "notifications" as const, label: "Notifications", icon: Bell },
    { key: "integrations" as const, label: "Integrations", icon: Plug },
    { key: "appearance" as const, label: "Appearance", icon: Palette },
  ];

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "#245C5A" }}
          >
            <Settings size={20} color="white" />
          </div>
          <div>
            <h1
              className="text-[22px] font-bold"
              style={{ color: "var(--topbar-title)" }}
            >
              System Settings
            </h1>
            <p
              className="text-[13px]"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              Manage organization configuration, users, security, and
              preferences
            </p>
          </div>
        </div>
        {savedMessage && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ backgroundColor: "#ECFDF5", color: "#059669" }}
          >
            <CheckCircle size={14} />
            <span className="text-[12px] font-medium">
              Settings saved successfully
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 mb-6 border-b"
        style={{ borderColor: "var(--card-border)" }}
      >
        {tabConfig.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-4 py-2 text-[13px] font-medium capitalize rounded-t-lg flex items-center gap-2"
              style={{
                color:
                  activeTab === tab.key ? "#245C5A" : "var(--topbar-subtitle)",
                borderBottom:
                  activeTab === tab.key
                    ? "2px solid #245C5A"
                    : "2px solid transparent",
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── ORGANIZATION TAB ─────────────────────────────────── */}
      {activeTab === "organization" && (
        <div
          className="rounded-lg border p-6"
          style={{
            borderColor: "var(--card-border)",
            backgroundColor: "var(--card-bg)",
          }}
        >
          <h3
            className="text-[16px] font-semibold mb-1"
            style={{ color: "var(--topbar-title)" }}
          >
            Organization Settings
          </h3>
          <p
            className="text-[12px] mb-6"
            style={{ color: "var(--topbar-subtitle)" }}
          >
            Configure your facility details and operational parameters
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label
                className="text-[11px] font-semibold mb-1.5 block"
                style={{ color: "var(--topbar-title)" }}
              >
                Facility Name
              </label>
              <input
                type="text"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                className="w-full text-[12px] rounded-md border px-3 py-2"
                style={{ borderColor: "var(--card-border)" }}
              />
            </div>
            <div>
              <label
                className="text-[11px] font-semibold mb-1.5 block"
                style={{ color: "var(--topbar-title)" }}
              >
                License Number
              </label>
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="w-full text-[12px] rounded-md border px-3 py-2"
                style={{ borderColor: "var(--card-border)" }}
              />
            </div>
            <div className="md:col-span-2">
              <label
                className="text-[11px] font-semibold mb-1.5 block"
                style={{ color: "var(--topbar-title)" }}
              >
                Facility Address
              </label>
              <input
                type="text"
                value={facilityAddress}
                onChange={(e) => setFacilityAddress(e.target.value)}
                className="w-full text-[12px] rounded-md border px-3 py-2"
                style={{ borderColor: "var(--card-border)" }}
              />
            </div>
            <div>
              <label
                className="text-[11px] font-semibold mb-1.5 block"
                style={{ color: "var(--topbar-title)" }}
              >
                State
              </label>
              <select
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="w-full text-[12px] rounded-md border px-3 py-2 bg-transparent"
                style={{ borderColor: "var(--card-border)" }}
              >
                <option value="TX">Texas</option>
                <option value="CA">California</option>
                <option value="FL">Florida</option>
                <option value="NY">New York</option>
              </select>
            </div>
            <div>
              <label
                className="text-[11px] font-semibold mb-1.5 block"
                style={{ color: "var(--topbar-title)" }}
              >
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full text-[12px] rounded-md border px-3 py-2 bg-transparent"
                style={{ borderColor: "var(--card-border)" }}
              >
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
              </select>
            </div>
            <div>
              <label
                className="text-[11px] font-semibold mb-1.5 block"
                style={{ color: "var(--topbar-title)" }}
              >
                Administrator Email
              </label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full text-[12px] rounded-md border px-3 py-2"
                style={{ borderColor: "var(--card-border)" }}
              />
            </div>
            <div>
              <label
                className="text-[11px] font-semibold mb-1.5 block"
                style={{ color: "var(--topbar-title)" }}
              >
                Bed Capacity
              </label>
              <input
                type="text"
                value="12"
                readOnly
                className="w-full text-[12px] rounded-md border px-3 py-2 bg-gray-50"
                style={{ borderColor: "var(--card-border)", color: "#6B7280" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── USERS TAB ────────────────────────────────────────── */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div
              className="rounded-lg border p-3"
              style={{
                borderColor: "var(--card-border)",
                backgroundColor: "var(--card-bg)",
              }}
            >
              <p
                className="text-[11px] uppercase tracking-wide"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                Total Users
              </p>
              <p className="text-[22px] font-bold" style={{ color: "#245C5A" }}>
                {totalUsers}
              </p>
            </div>
            <div
              className="rounded-lg border p-3"
              style={{
                borderColor: "var(--card-border)",
                backgroundColor: "var(--card-bg)",
              }}
            >
              <p
                className="text-[11px] uppercase tracking-wide"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                Active Users
              </p>
              <p className="text-[22px] font-bold" style={{ color: "#059669" }}>
                {users.filter((u) => u.status === "active").length}
              </p>
            </div>
            <div
              className="rounded-lg border p-3"
              style={{
                borderColor: "var(--card-border)",
                backgroundColor: "var(--card-bg)",
              }}
            >
              <p
                className="text-[11px] uppercase tracking-wide"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                Active Sessions
              </p>
              <p className="text-[22px] font-bold" style={{ color: "#2563EB" }}>
                {activeSessions}
              </p>
            </div>
            <div
              className="rounded-lg border p-3"
              style={{
                borderColor: "var(--card-border)",
                backgroundColor: "var(--card-bg)",
              }}
            >
              <p
                className="text-[11px] uppercase tracking-wide"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                Departments
              </p>
              <p className="text-[22px] font-bold" style={{ color: "#7C3AED" }}>
                {departmentCount}
              </p>
            </div>
          </div>

          {/* Users Table */}
          <div
            className="rounded-lg border"
            style={{
              borderColor: "var(--card-border)",
              backgroundColor: "var(--card-bg)",
            }}
          >
            <div
              className="p-4 border-b flex items-center justify-between"
              style={{ borderColor: "var(--card-border)" }}
            >
              <h3
                className="text-[15px] font-semibold"
                style={{ color: "var(--topbar-title)" }}
              >
                User Management
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCreateTrainingAccount()}
                  disabled={createTrainingAccountMutation.isPending}
                  className="rounded bg-[#245C5A] px-3 py-1.5 text-[11px] font-semibold text-white"
                >
                  Add Training User
                </button>
                <span
                  className="text-[11px] px-2 py-1 rounded"
                  style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}
                >
                  {users.length} accounts
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr
                    style={{
                      borderBottom: "2px solid var(--card-border)",
                      backgroundColor: "rgba(36,92,90,0.03)",
                    }}
                  >
                    <th
                      className="text-left py-2.5 px-3 font-semibold"
                      style={{ color: "var(--topbar-subtitle)" }}
                    >
                      Name
                    </th>
                    <th
                      className="text-left py-2.5 px-3 font-semibold"
                      style={{ color: "var(--topbar-subtitle)" }}
                    >
                      Email
                    </th>
                    <th
                      className="text-left py-2.5 px-3 font-semibold"
                      style={{ color: "var(--topbar-subtitle)" }}
                    >
                      Role
                    </th>
                    <th
                      className="text-left py-2.5 px-3 font-semibold"
                      style={{ color: "var(--topbar-subtitle)" }}
                    >
                      Access Profile
                    </th>
                    <th
                      className="text-left py-2.5 px-3 font-semibold"
                      style={{ color: "var(--topbar-subtitle)" }}
                    >
                      Department
                    </th>
                    <th
                      className="text-left py-2.5 px-3 font-semibold"
                      style={{ color: "var(--topbar-subtitle)" }}
                    >
                      Status
                    </th>
                    <th
                      className="text-left py-2.5 px-3 font-semibold"
                      style={{ color: "var(--topbar-subtitle)" }}
                    >
                      Last Login
                    </th>
                    <th
                      className="text-left py-2.5 px-3 font-semibold"
                      style={{ color: "var(--topbar-subtitle)" }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b hover:bg-black/[0.02]"
                      style={{ borderColor: "var(--card-border)" }}
                    >
                      <td
                        className="py-2.5 px-3 font-medium"
                        style={{ color: "var(--topbar-title)" }}
                      >
                        {u.name}
                      </td>
                      <td
                        className="py-2.5 px-3"
                        style={{ color: "var(--topbar-subtitle)" }}
                      >
                        {u.email}
                      </td>
                      <td className="py-2.5 px-3">
                        {editingUser === u.id ? (
                          <select
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value)}
                            className="text-[11px] rounded border px-1.5 py-1 bg-transparent"
                            style={{ borderColor: "var(--card-border)" }}
                          >
                            {ROLE_DEFINITIONS.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[11px]">{u.role}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {editingUser === u.id ? (
                          <div className="flex min-w-[170px] flex-col gap-1">
                            <select
                              value={editAccessStatus}
                              onChange={(event) =>
                                setEditAccessStatus(
                                  event.target.value as User["accessStatus"],
                                )
                              }
                              className="rounded border bg-transparent px-1.5 py-1 text-[11px]"
                              style={{ borderColor: "var(--card-border)" }}
                            >
                              <option value="training">Training</option>
                              <option value="cleared">
                                Operational — Cleared
                              </option>
                              <option value="suspended">Suspended</option>
                              <option value="deactivated">Deactivated</option>
                            </select>
                            <select
                              value={editIdentityType}
                              onChange={(event) =>
                                setEditIdentityType(
                                  event.target.value as User["identityType"],
                                )
                              }
                              className="rounded border bg-transparent px-1.5 py-1 text-[11px]"
                              style={{ borderColor: "var(--card-border)" }}
                            >
                              <option value="workforce">Workforce</option>
                              <option value="external_guest">
                                External stakeholder
                              </option>
                            </select>
                            <label className="flex items-center gap-1 text-[10px] text-slate-600">
                              <input
                                type="checkbox"
                                checked={editTrainingAccess}
                                onChange={(event) =>
                                  setEditTrainingAccess(event.target.checked)
                                }
                              />
                              May use Training workspace
                            </label>
                          </div>
                        ) : (
                          <div className="flex min-w-[130px] flex-col gap-1">
                            <span
                              className="w-fit rounded px-2 py-0.5 text-[10px] font-semibold uppercase"
                              style={{
                                backgroundColor:
                                  u.accessStatus === "training"
                                    ? "#FEF3C7"
                                    : u.accessStatus === "cleared"
                                      ? "#ECFDF5"
                                      : "#FEE2E2",
                                color:
                                  u.accessStatus === "training"
                                    ? "#92400E"
                                    : u.accessStatus === "cleared"
                                      ? "#047857"
                                      : "#B91C1C",
                              }}
                            >
                              {u.accessStatus === "cleared"
                                ? "Operational"
                                : u.accessStatus}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {u.identityType === "external_guest"
                                ? "External stakeholder"
                                : "Workforce"}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className="text-[11px]"
                          style={{ color: "var(--topbar-subtitle)" }}
                        >
                          {u.department}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => void handleToggleStatus(u)}
                          disabled={updateUserMutation.isPending}
                          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium cursor-pointer"
                          style={{
                            backgroundColor:
                              u.status === "active" ? "#ECFDF5" : "#F3F4F6",
                            color:
                              u.status === "active" ? "#059669" : "#6B7280",
                          }}
                        >
                          {u.status === "active" ? (
                            <CheckCircle size={10} />
                          ) : (
                            <XCircle size={10} />
                          )}
                          {u.status === "active" ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td
                        className="py-2.5 px-3"
                        style={{ color: "var(--topbar-subtitle)" }}
                      >
                        {u.lastLogin}
                      </td>
                      <td className="py-2.5 px-3">
                        {editingUser === u.id ? (
                          <button
                            onClick={() => void handleSaveUser(u)}
                            disabled={updateUserMutation.isPending}
                            className="text-[10px] px-2 py-1 rounded font-medium"
                            style={{
                              backgroundColor: "#ECFDF5",
                              color: "#059669",
                            }}
                          >
                            Save
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEdit(u)}
                            className="text-[10px] px-2 py-1 rounded font-medium"
                            style={{
                              backgroundColor: "#F3F4F6",
                              color: "#6B7280",
                            }}
                          >
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!usersQuery.isLoading && users.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-6 px-3 text-center"
                        style={{ color: "var(--topbar-subtitle)" }}
                      >
                        {usersQuery.isError
                          ? "An authorized administrator session is required to load the directory."
                          : "No identity records are available."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── SECURITY TAB ─────────────────────────────────────── */}
      {activeTab === "security" && (
        <div
          className="rounded-lg border p-6"
          style={{
            borderColor: "var(--card-border)",
            backgroundColor: "var(--card-bg)",
          }}
        >
          <h3
            className="text-[16px] font-semibold mb-1"
            style={{ color: "var(--topbar-title)" }}
          >
            Security Settings
          </h3>
          <p
            className="text-[12px] mb-6"
            style={{ color: "var(--topbar-subtitle)" }}
          >
            Identity policy, account access profiles, sessions, and periodic
            reviews
          </p>

          <div className="space-y-6">
            <div
              className="border-b pb-5"
              style={{ borderColor: "var(--card-border)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Lock size={14} style={{ color: "#245C5A" }} />
                <h4
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--topbar-title)" }}
                >
                  Enforced Identity Policy
                </h4>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  [
                    "Password",
                    policyQuery.data
                      ? `${policyQuery.data.passwordMinimumLength}+ characters`
                      : "Loading",
                  ],
                  [
                    "Lockout",
                    policyQuery.data
                      ? `${policyQuery.data.maximumFailedLogins} failures / ${policyQuery.data.lockoutMinutes} min`
                      : "Loading",
                  ],
                  [
                    "Session",
                    policyQuery.data
                      ? `${policyQuery.data.sessionIdleMinutes} min idle / ${policyQuery.data.sessionAbsoluteMinutes / 60} hr max`
                      : "Loading",
                  ],
                  [
                    "Access review",
                    policyQuery.data
                      ? `Every ${policyQuery.data.accessReviewDays} days`
                      : "Loading",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border p-3"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    <p
                      className="text-[10px] uppercase tracking-wide"
                      style={{ color: "var(--topbar-subtitle)" }}
                    >
                      {label}
                    </p>
                    <p
                      className="text-[12px] font-semibold mt-1"
                      style={{ color: "var(--topbar-title)" }}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="border-b pb-5"
              style={{ borderColor: "var(--card-border)" }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} style={{ color: "#245C5A" }} />
                    <h4
                      className="text-[13px] font-semibold"
                      style={{ color: "var(--topbar-title)" }}
                    >
                      Current-user MFA
                    </h4>
                  </div>
                  <p
                    className="text-[11px] mt-1"
                    style={{ color: "var(--topbar-subtitle)" }}
                  >
                    Policy: {policyQuery.data?.mfaPolicy ?? "Loading"}. Account:{" "}
                    {currentUser?.mfaEnabled ? "enabled" : "not enabled"}.
                  </p>
                </div>
                <button
                  onClick={() =>
                    setMfaMutation.mutate({ enabled: !currentUser?.mfaEnabled })
                  }
                  disabled={!currentUser || setMfaMutation.isPending}
                  className="text-[11px] px-3 py-2 rounded-md font-medium text-white disabled:opacity-50"
                  style={{ backgroundColor: "#245C5A" }}
                >
                  {currentUser?.mfaEnabled ? "Disable MFA" : "Enable MFA"}
                </button>
              </div>
            </div>

            <div
              className="border-b pb-5"
              style={{ borderColor: "var(--card-border)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} style={{ color: "#245C5A" }} />
                <h4
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--topbar-title)" }}
                >
                  Your Sessions ({activeSessions} active)
                </h4>
              </div>
              <div className="space-y-2">
                {(sessionsQuery.data ?? []).slice(0, 5).map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    <div>
                      <p
                        className="text-[11px] font-medium"
                        style={{ color: "var(--topbar-title)" }}
                      >
                        {session.userAgent ?? "Unknown client"}
                      </p>
                      <p
                        className="text-[10px]"
                        style={{ color: "var(--topbar-subtitle)" }}
                      >
                        Last activity {formatTimestamp(session.lastSeenAt)} ·{" "}
                        {session.ipAddress ?? "Unknown address"}
                      </p>
                    </div>
                    <span
                      className="text-[10px] px-2 py-1 rounded"
                      style={{
                        backgroundColor: session.revokedAt
                          ? "#F3F4F6"
                          : "#ECFDF5",
                        color: session.revokedAt ? "#6B7280" : "#059669",
                      }}
                    >
                      {session.revokedAt
                        ? "Revoked"
                        : session.mfaVerified
                          ? "Active · MFA"
                          : "Active"}
                    </span>
                  </div>
                ))}
                {!sessionsQuery.isLoading &&
                  (sessionsQuery.data ?? []).length === 0 && (
                    <p
                      className="text-[11px]"
                      style={{ color: "var(--topbar-subtitle)" }}
                    >
                      No session records are available.
                    </p>
                  )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <Users size={14} style={{ color: "#245C5A" }} />
                  <h4
                    className="text-[13px] font-semibold"
                    style={{ color: "var(--topbar-title)" }}
                  >
                    Pending Access Reviews
                  </h4>
                </div>
                <span
                  className="text-[10px] px-2 py-1 rounded"
                  style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}
                >
                  {(reviewsQuery.data ?? []).length} pending
                </span>
              </div>
              <div className="space-y-2">
                {(reviewsQuery.data ?? []).map((review) => (
                  <div
                    key={review.id}
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-lg border p-3"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    <div>
                      <p
                        className="text-[11px] font-semibold"
                        style={{ color: "var(--topbar-title)" }}
                      >
                        {review.firstName} {review.lastName} · {review.role}
                      </p>
                      <p
                        className="text-[10px]"
                        style={{ color: "var(--topbar-subtitle)" }}
                      >
                        {review.email} · Due {formatTimestamp(review.dueAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {(["retain", "modify", "revoke"] as const).map(
                        (decision) => (
                          <button
                            key={decision}
                            onClick={() =>
                              void handleAccessReview(review.id, decision)
                            }
                            disabled={completeReviewMutation.isPending}
                            className="text-[10px] px-2.5 py-1.5 rounded font-medium capitalize disabled:opacity-50"
                            style={{
                              backgroundColor:
                                decision === "revoke" ? "#FEF2F2" : "#F3F4F6",
                              color:
                                decision === "revoke" ? "#DC2626" : "#374151",
                            }}
                          >
                            {decision}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                ))}
                {!reviewsQuery.isLoading &&
                  (reviewsQuery.data ?? []).length === 0 && (
                    <p
                      className="text-[11px]"
                      style={{ color: "var(--topbar-subtitle)" }}
                    >
                      {reviewsQuery.isError
                        ? "An authorized administrator session is required to load access reviews."
                        : "No access reviews are pending."}
                    </p>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── NOTIFICATIONS TAB ────────────────────────────────── */}
      {activeTab === "notifications" && (
        <div
          className="rounded-lg border p-6"
          style={{
            borderColor: "var(--card-border)",
            backgroundColor: "var(--card-bg)",
          }}
        >
          <h3
            className="text-[16px] font-semibold mb-1"
            style={{ color: "var(--topbar-title)" }}
          >
            Notification Preferences
          </h3>
          <p
            className="text-[12px] mb-6"
            style={{ color: "var(--topbar-subtitle)" }}
          >
            Control how and when you receive system notifications
          </p>

          <div className="space-y-6">
            {/* Channels */}
            <div
              className="border-b pb-5"
              style={{ borderColor: "var(--card-border)" }}
            >
              <h4
                className="text-[13px] font-semibold mb-3"
                style={{ color: "var(--topbar-title)" }}
              >
                Notification Channels
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div
                  className="flex items-center justify-between p-3 rounded-lg border"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  <div className="flex items-center gap-2">
                    <Mail size={14} style={{ color: "#245C5A" }} />
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: "var(--topbar-title)" }}
                    >
                      Email
                    </span>
                  </div>
                  <ToggleSwitch
                    enabled={emailEnabled}
                    onChange={() => setEmailEnabled(!emailEnabled)}
                  />
                </div>
                <div
                  className="flex items-center justify-between p-3 rounded-lg border"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} style={{ color: "#2563EB" }} />
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: "var(--topbar-title)" }}
                    >
                      In-App
                    </span>
                  </div>
                  <ToggleSwitch
                    enabled={inAppEnabled}
                    onChange={() => setInAppEnabled(!inAppEnabled)}
                  />
                </div>
                <div
                  className="flex items-center justify-between p-3 rounded-lg border"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  <div className="flex items-center gap-2">
                    <Smartphone size={14} style={{ color: "#7C3AED" }} />
                    <span
                      className="text-[12px] font-medium"
                      style={{ color: "var(--topbar-title)" }}
                    >
                      SMS
                    </span>
                  </div>
                  <ToggleSwitch
                    enabled={smsEnabled}
                    onChange={() => setSmsEnabled(!smsEnabled)}
                  />
                </div>
              </div>
            </div>

            {/* Alert Types */}
            <div>
              <h4
                className="text-[13px] font-semibold mb-3"
                style={{ color: "var(--topbar-title)" }}
              >
                Alert Types
              </h4>
              <div className="space-y-2">
                {[
                  {
                    key: "critical",
                    label: "Critical Alerts",
                    desc: "System failures, security breaches",
                    state: alertCritical,
                    set: setAlertCritical,
                  },
                  {
                    key: "compliance",
                    label: "Compliance Alerts",
                    desc: "Audit findings, policy violations",
                    state: alertCompliance,
                    set: setAlertCompliance,
                  },
                  {
                    key: "system",
                    label: "System Updates",
                    desc: "Maintenance windows, new features",
                    state: alertSystem,
                    set: setAlertSystem,
                  },
                  {
                    key: "updates",
                    label: "Enhancement Updates",
                    desc: "New releases, roadmap changes",
                    state: alertUpdates,
                    set: setAlertUpdates,
                  },
                ].map((alert) => (
                  <div
                    key={alert.key}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    <div>
                      <p
                        className="text-[12px] font-medium"
                        style={{ color: "var(--topbar-title)" }}
                      >
                        {alert.label}
                      </p>
                      <p
                        className="text-[10px]"
                        style={{ color: "var(--topbar-subtitle)" }}
                      >
                        {alert.desc}
                      </p>
                    </div>
                    <ToggleSwitch
                      enabled={alert.state}
                      onChange={() => alert.set(!alert.state)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── INTEGRATIONS TAB ─────────────────────────────────── */}
      {activeTab === "integrations" && (
        <div
          className="rounded-lg border p-6"
          style={{
            borderColor: "var(--card-border)",
            backgroundColor: "var(--card-bg)",
          }}
        >
          <h3
            className="text-[16px] font-semibold mb-1"
            style={{ color: "var(--topbar-title)" }}
          >
            Integration Settings
          </h3>
          <p
            className="text-[12px] mb-6"
            style={{ color: "var(--topbar-subtitle)" }}
          >
            Manage external system connections and API access
          </p>

          <div className="space-y-4">
            {/* Entra ID */}
            <div
              className="flex items-center justify-between p-4 rounded-lg border"
              style={{ borderColor: "var(--card-border)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: "#EFF6FF" }}
                >
                  <ShieldCheck size={18} style={{ color: "#2563EB" }} />
                </div>
                <div>
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: "var(--topbar-title)" }}
                  >
                    Microsoft Entra ID
                  </p>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--topbar-subtitle)" }}
                  >
                    SSO and user directory synchronization
                  </p>
                  {entraStatus === "connected" && (
                    <p
                      className="text-[10px] mt-0.5"
                      style={{ color: "#059669" }}
                    >
                      Last sync: 2026-07-08 10:15 AM
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium"
                  style={{
                    backgroundColor:
                      entraStatus === "connected" ? "#ECFDF5" : "#F3F4F6",
                    color: entraStatus === "connected" ? "#059669" : "#6B7280",
                  }}
                >
                  {entraStatus === "connected" ? (
                    <CheckCircle size={10} />
                  ) : (
                    <XCircle size={10} />
                  )}
                  {entraStatus === "connected" ? "Connected" : "Disconnected"}
                </span>
                <button
                  onClick={() =>
                    setEntraStatus(
                      entraStatus === "connected"
                        ? "disconnected"
                        : "connected",
                    )
                  }
                  className="text-[11px] px-3 py-1.5 rounded-md font-medium border cursor-pointer"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  {entraStatus === "connected" ? "Disconnect" : "Connect"}
                </button>
              </div>
            </div>

            {/* Netlify */}
            <div
              className="flex items-center justify-between p-4 rounded-lg border"
              style={{ borderColor: "var(--card-border)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: "#F0FDFA" }}
                >
                  <RefreshCw size={18} style={{ color: "#245C5A" }} />
                </div>
                <div>
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: "var(--topbar-title)" }}
                  >
                    Netlify
                  </p>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--topbar-subtitle)" }}
                  >
                    Frontend deployment and hosting
                  </p>
                  {netlifyStatus === "connected" && (
                    <p
                      className="text-[10px] mt-0.5"
                      style={{ color: "#059669" }}
                    >
                      Last deploy: 2026-07-08 06:30 AM
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium"
                  style={{
                    backgroundColor:
                      netlifyStatus === "connected" ? "#ECFDF5" : "#F3F4F6",
                    color:
                      netlifyStatus === "connected" ? "#059669" : "#6B7280",
                  }}
                >
                  {netlifyStatus === "connected" ? (
                    <CheckCircle size={10} />
                  ) : (
                    <XCircle size={10} />
                  )}
                  {netlifyStatus === "connected" ? "Connected" : "Disconnected"}
                </span>
                <button
                  onClick={() =>
                    setNetlifyStatus(
                      netlifyStatus === "connected"
                        ? "disconnected"
                        : "connected",
                    )
                  }
                  className="text-[11px] px-3 py-1.5 rounded-md font-medium border cursor-pointer"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  {netlifyStatus === "connected" ? "Disconnect" : "Connect"}
                </button>
              </div>
            </div>

            {/* Railway */}
            <div
              className="flex items-center justify-between p-4 rounded-lg border"
              style={{ borderColor: "var(--card-border)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: "#F3E8FF" }}
                >
                  <Plug size={18} style={{ color: "#7C3AED" }} />
                </div>
                <div>
                  <p
                    className="text-[13px] font-semibold"
                    style={{ color: "var(--topbar-title)" }}
                  >
                    Railway
                  </p>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--topbar-subtitle)" }}
                  >
                    Backend services and database hosting
                  </p>
                  {railwayStatus === "connected" && (
                    <p
                      className="text-[10px] mt-0.5"
                      style={{ color: "#059669" }}
                    >
                      Uptime: 99.97% (30 days)
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium"
                  style={{
                    backgroundColor:
                      railwayStatus === "connected" ? "#ECFDF5" : "#F3F4F6",
                    color:
                      railwayStatus === "connected" ? "#059669" : "#6B7280",
                  }}
                >
                  {railwayStatus === "connected" ? (
                    <CheckCircle size={10} />
                  ) : (
                    <XCircle size={10} />
                  )}
                  {railwayStatus === "connected" ? "Connected" : "Disconnected"}
                </span>
                <button
                  onClick={() =>
                    setRailwayStatus(
                      railwayStatus === "connected"
                        ? "disconnected"
                        : "connected",
                    )
                  }
                  className="text-[11px] px-3 py-1.5 rounded-md font-medium border cursor-pointer"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  {railwayStatus === "connected" ? "Disconnect" : "Connect"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── APPEARANCE TAB ───────────────────────────────────── */}
      {activeTab === "appearance" && (
        <div
          className="rounded-lg border p-6"
          style={{
            borderColor: "var(--card-border)",
            backgroundColor: "var(--card-bg)",
          }}
        >
          <h3
            className="text-[16px] font-semibold mb-1"
            style={{ color: "var(--topbar-title)" }}
          >
            Appearance
          </h3>
          <p
            className="text-[12px] mb-6"
            style={{ color: "var(--topbar-subtitle)" }}
          >
            Customize the visual appearance of your workspace
          </p>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label
                  className="text-[11px] font-semibold mb-1.5 block"
                  style={{ color: "var(--topbar-title)" }}
                >
                  Theme
                </label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full text-[12px] rounded-md border px-3 py-2 bg-transparent"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  {THEME_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  className="text-[11px] font-semibold mb-1.5 block"
                  style={{ color: "var(--topbar-title)" }}
                >
                  Sidebar Mode
                </label>
                <select
                  value={sidebarMode}
                  onChange={(e) => setSidebarMode(e.target.value)}
                  className="w-full text-[12px] rounded-md border px-3 py-2 bg-transparent"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  {SIDEBAR_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                className="flex items-center justify-between p-3 rounded-lg border"
                style={{ borderColor: "var(--card-border)" }}
              >
                <div>
                  <p
                    className="text-[12px] font-medium"
                    style={{ color: "var(--topbar-title)" }}
                  >
                    Compact Mode
                  </p>
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--topbar-subtitle)" }}
                  >
                    Reduce spacing and padding
                  </p>
                </div>
                <ToggleSwitch
                  enabled={compactMode}
                  onChange={() => setCompactMode(!compactMode)}
                />
              </div>
              <div
                className="flex items-center justify-between p-3 rounded-lg border"
                style={{ borderColor: "var(--card-border)" }}
              >
                <div>
                  <p
                    className="text-[12px] font-medium"
                    style={{ color: "var(--topbar-title)" }}
                  >
                    High Contrast
                  </p>
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--topbar-subtitle)" }}
                  >
                    Enhanced visibility mode
                  </p>
                </div>
                <ToggleSwitch
                  enabled={highContrast}
                  onChange={() => setHighContrast(!highContrast)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSaveAll}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-[13px] font-medium text-white cursor-pointer transition-all hover:opacity-90"
          style={{ backgroundColor: "#245C5A" }}
        >
          <Save size={14} />
          Save Settings
        </button>
      </div>
    </div>
  );
}
