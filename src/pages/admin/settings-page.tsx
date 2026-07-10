import { useState } from "react";
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
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Check,
  AlertTriangle,
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
}

// ─── Demo Data ─────────────────────────────────────────────────
const DEMO_USERS: User[] = [
  { id: "USR-001", name: "Dr. Sarah Chen", email: "s.chen@amos-care.org", role: "Clinical Director", department: "Clinical", status: "active", lastLogin: "2026-07-08 09:23" },
  { id: "USR-002", name: "Marcus Williams", email: "m.williams@amos-care.org", role: "Program Director", department: "Operations", status: "active", lastLogin: "2026-07-08 08:45" },
  { id: "USR-003", name: "Lilian Ike", email: "l.ike@amos-care.org", role: "Nurse Manager", department: "Nursing", status: "active", lastLogin: "2026-07-08 10:01" },
  { id: "USR-004", name: "James Rodriguez", email: "j.rodriguez@amos-care.org", role: "RC Supervisor", department: "Residential", status: "active", lastLogin: "2026-07-07 22:15" },
  { id: "USR-005", name: "Aisha Patel", email: "a.patel@amos-care.org", role: "HR Manager", department: "HR", status: "active", lastLogin: "2026-07-08 07:30" },
  { id: "USR-006", name: "David Thompson", email: "d.thompson@amos-care.org", role: "Compliance Officer", department: "Compliance", status: "active", lastLogin: "2026-07-08 11:00" },
  { id: "USR-007", name: "Rachel Kim", email: "r.kim@amos-care.org", role: "Billing Specialist", department: "Revenue", status: "active", lastLogin: "2026-07-08 08:15" },
  { id: "USR-008", name: "Michael Foster", email: "m.foster@amos-care.org", role: "IT Administrator", department: "IT", status: "active", lastLogin: "2026-07-08 06:45" },
];

const ROLE_OPTIONS = [
  "Clinical Director", "Program Director", "Nurse Manager", "RC Supervisor",
  "HR Manager", "Compliance Officer", "Billing Specialist", "IT Administrator",
  "Therapist", "Case Manager", "Residential Counselor", "Receptionist",
];

const DEPT_OPTIONS = ["Clinical", "Operations", "Nursing", "Residential", "HR", "Compliance", "Revenue", "IT"];

const PASSWORD_OPTIONS = ["Standard (8+ chars)", "Strong (10+ chars, mixed case)", "Enterprise (12+ chars, special chars)"];
const SESSION_OPTIONS = ["15 minutes", "30 minutes", "1 hour", "4 hours", "8 hours"];
const MFA_OPTIONS = ["Optional", "Required for Admin", "Required for All"];
const THEME_OPTIONS = ["Light", "Dark", "System Default"];
const SIDEBAR_OPTIONS = ["Expanded", "Collapsed", "Auto-hide"];

// ─── Toggle Switch Component ──────────────────────────────────
function ToggleSwitch({ enabled, onChange, label }: { enabled: boolean; onChange: () => void; label?: string }) {
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
        <span className="text-[12px] font-medium" style={{ color: enabled ? "#245C5A" : "#6B7280" }}>
          {enabled ? "On" : "Off"}
        </span>
      )}
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"organization" | "users" | "security" | "notifications" | "integrations" | "appearance">("organization");
  const [savedMessage, setSavedMessage] = useState(false);

  // Organization state
  const [facilityName, setFacilityName] = useState("Adolescent Behavioral Care - Houston Campus");
  const [facilityAddress, setFacilityAddress] = useState("2450 Fondren Road, Houston, TX 77063");
  const [licenseNumber, setLicenseNumber] = useState("TX-BH-2024-0847");
  const [stateCode, setStateCode] = useState("TX");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [adminEmail, setAdminEmail] = useState("admin@amos-care.org");

  // Users state
  const [users, setUsers] = useState<User[]>(DEMO_USERS);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ role: "", department: "" });

  // Security state
  const [passwordPolicy, setPasswordPolicy] = useState("Enterprise (12+ chars, special chars)");
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [mfaPolicy, setMfaPolicy] = useState("Required for Admin");
  const [sessionTimeout, setSessionTimeout] = useState("1 hour");
  const [enforceLogout, setEnforceLogout] = useState(true);
  const [auditLogEnabled, setAuditLogEnabled] = useState(true);

  // Notifications state
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [alertCritical, setAlertCritical] = useState(true);
  const [alertCompliance, setAlertCompliance] = useState(true);
  const [alertSystem, setAlertSystem] = useState(true);
  const [alertUpdates, setAlertUpdates] = useState(false);

  // Integration state
  const [entraStatus, setEntraStatus] = useState<"connected" | "disconnected">("connected");
  const [netlifyStatus, setNetlifyStatus] = useState<"connected" | "disconnected">("connected");
  const [railwayStatus, setRailwayStatus] = useState<"connected" | "disconnected">("connected");

  // Appearance state
  const [theme, setTheme] = useState("Light");
  const [sidebarMode, setSidebarMode] = useState("Expanded");
  const [compactMode, setCompactMode] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  // Active sessions count
  const activeSessions = 18;
  const totalUsers = 24;

  // ─── Handlers ────────────────────────────────────────────────
  const handleEdit = (u: User) => {
    setEditingUser(u.id);
    setEditForm({ role: u.role, department: u.department });
  };

  const handleSaveUser = (id: string) => {
    setUsers(users.map((u) => (u.id === id ? { ...u, role: editForm.role, department: editForm.department } : u)));
    setEditingUser(null);
  };

  const handleToggleStatus = (id: string) => {
    setUsers(users.map((u) => (u.id === id ? { ...u, status: u.status === "active" ? "inactive" : "active" } : u)));
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
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#245C5A" }}>
            <Settings size={20} color="white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>System Settings</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Manage organization configuration, users, security, and preferences
            </p>
          </div>
        </div>
        {savedMessage && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
            <CheckCircle size={14} />
            <span className="text-[12px] font-medium">Settings saved successfully</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--card-border)" }}>
        {tabConfig.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-4 py-2 text-[13px] font-medium capitalize rounded-t-lg flex items-center gap-2"
              style={{
                color: activeTab === tab.key ? "#245C5A" : "var(--topbar-subtitle)",
                borderBottom: activeTab === tab.key ? "2px solid #245C5A" : "2px solid transparent",
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
        <div className="rounded-lg border p-6" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <h3 className="text-[16px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>Organization Settings</h3>
          <p className="text-[12px] mb-6" style={{ color: "var(--topbar-subtitle)" }}>Configure your facility details and operational parameters</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: "var(--topbar-title)" }}>Facility Name</label>
              <input
                type="text"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                className="w-full text-[12px] rounded-md border px-3 py-2"
                style={{ borderColor: "var(--card-border)" }}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: "var(--topbar-title)" }}>License Number</label>
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="w-full text-[12px] rounded-md border px-3 py-2"
                style={{ borderColor: "var(--card-border)" }}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: "var(--topbar-title)" }}>Facility Address</label>
              <input
                type="text"
                value={facilityAddress}
                onChange={(e) => setFacilityAddress(e.target.value)}
                className="w-full text-[12px] rounded-md border px-3 py-2"
                style={{ borderColor: "var(--card-border)" }}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: "var(--topbar-title)" }}>State</label>
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
              <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: "var(--topbar-title)" }}>Timezone</label>
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
              <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: "var(--topbar-title)" }}>Administrator Email</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full text-[12px] rounded-md border px-3 py-2"
                style={{ borderColor: "var(--card-border)" }}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: "var(--topbar-title)" }}>Bed Capacity</label>
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
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Total Users</p>
              <p className="text-[22px] font-bold" style={{ color: "#245C5A" }}>{totalUsers}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Active Users</p>
              <p className="text-[22px] font-bold" style={{ color: "#059669" }}>{users.filter((u) => u.status === "active").length}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Active Sessions</p>
              <p className="text-[22px] font-bold" style={{ color: "#2563EB" }}>{activeSessions}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <p className="text-[11px] uppercase tracking-wide" style={{ color: "var(--topbar-subtitle)" }}>Departments</p>
              <p className="text-[22px] font-bold" style={{ color: "#7C3AED" }}>{DEPT_OPTIONS.length}</p>
            </div>
          </div>

          {/* Users Table */}
          <div className="rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
              <h3 className="text-[15px] font-semibold" style={{ color: "var(--topbar-title)" }}>User Management</h3>
              <span className="text-[11px] px-2 py-1 rounded" style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>{users.length} of {totalUsers} shown</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--card-border)", backgroundColor: "rgba(36,92,90,0.03)" }}>
                    <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Name</th>
                    <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Email</th>
                    <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Role</th>
                    <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Department</th>
                    <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Status</th>
                    <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Last Login</th>
                    <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b hover:bg-black/[0.02]" style={{ borderColor: "var(--card-border)" }}>
                      <td className="py-2.5 px-3 font-medium" style={{ color: "var(--topbar-title)" }}>{u.name}</td>
                      <td className="py-2.5 px-3" style={{ color: "var(--topbar-subtitle)" }}>{u.email}</td>
                      <td className="py-2.5 px-3">
                        {editingUser === u.id ? (
                          <select
                            value={editForm.role}
                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                            className="text-[11px] rounded border px-1.5 py-1 bg-transparent"
                            style={{ borderColor: "var(--card-border)" }}
                          >
                            {ROLE_OPTIONS.map((r) => (<option key={r} value={r}>{r}</option>))}
                          </select>
                        ) : (
                          <span className="text-[11px]">{u.role}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {editingUser === u.id ? (
                          <select
                            value={editForm.department}
                            onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                            className="text-[11px] rounded border px-1.5 py-1 bg-transparent"
                            style={{ borderColor: "var(--card-border)" }}
                          >
                            {DEPT_OPTIONS.map((d) => (<option key={d} value={d}>{d}</option>))}
                          </select>
                        ) : (
                          <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{u.department}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => handleToggleStatus(u.id)}
                          className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium cursor-pointer"
                          style={{
                            backgroundColor: u.status === "active" ? "#ECFDF5" : "#F3F4F6",
                            color: u.status === "active" ? "#059669" : "#6B7280",
                          }}
                        >
                          {u.status === "active" ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          {u.status === "active" ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="py-2.5 px-3" style={{ color: "var(--topbar-subtitle)" }}>{u.lastLogin}</td>
                      <td className="py-2.5 px-3">
                        {editingUser === u.id ? (
                          <button onClick={() => handleSaveUser(u.id)} className="text-[10px] px-2 py-1 rounded font-medium" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
                            Save
                          </button>
                        ) : (
                          <button onClick={() => handleEdit(u)} className="text-[10px] px-2 py-1 rounded font-medium" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── SECURITY TAB ─────────────────────────────────────── */}
      {activeTab === "security" && (
        <div className="rounded-lg border p-6" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <h3 className="text-[16px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>Security Settings</h3>
          <p className="text-[12px] mb-6" style={{ color: "var(--topbar-subtitle)" }}>Configure password policies, MFA, and session management</p>

          <div className="space-y-6">
            {/* Password Policy */}
            <div className="border-b pb-5" style={{ borderColor: "var(--card-border)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Lock size={14} style={{ color: "#245C5A" }} />
                <h4 className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>Password Policy</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "var(--topbar-title)" }}>Policy Level</label>
                  <select
                    value={passwordPolicy}
                    onChange={(e) => setPasswordPolicy(e.target.value)}
                    className="w-full text-[12px] rounded-md border px-3 py-2 bg-transparent"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    {PASSWORD_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
                  </select>
                </div>
                <div className="flex items-end">
                  <div className="flex items-center gap-2 px-3 py-2 rounded" style={{ backgroundColor: "#ECFDF5" }}>
                    <CheckCircle size={14} style={{ color: "#059669" }} />
                    <span className="text-[11px]" style={{ color: "#059669" }}>All 24 users have compliant passwords</span>
                  </div>
                </div>
              </div>
            </div>

            {/* MFA */}
            <div className="border-b pb-5" style={{ borderColor: "var(--card-border)" }}>
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck size={14} style={{ color: "#245C5A" }} />
                <h4 className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>Multi-Factor Authentication</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                  <span className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>Enable MFA</span>
                  <ToggleSwitch enabled={mfaEnabled} onChange={() => setMfaEnabled(!mfaEnabled)} />
                </div>
                <div>
                  <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "var(--topbar-title)" }}>MFA Requirement</label>
                  <select
                    value={mfaPolicy}
                    onChange={(e) => setMfaPolicy(e.target.value)}
                    disabled={!mfaEnabled}
                    className="w-full text-[12px] rounded-md border px-3 py-2 bg-transparent disabled:opacity-50"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    {MFA_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
                  </select>
                </div>
              </div>
            </div>

            {/* Session */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} style={{ color: "#245C5A" }} />
                <h4 className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>Session Management</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-medium mb-1.5 block" style={{ color: "var(--topbar-title)" }}>Session Timeout</label>
                  <select
                    value={sessionTimeout}
                    onChange={(e) => setSessionTimeout(e.target.value)}
                    className="w-full text-[12px] rounded-md border px-3 py-2 bg-transparent"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    {SESSION_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
                  </select>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                  <span className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>Enforce Logout on Timeout</span>
                  <ToggleSwitch enabled={enforceLogout} onChange={() => setEnforceLogout(!enforceLogout)} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── NOTIFICATIONS TAB ────────────────────────────────── */}
      {activeTab === "notifications" && (
        <div className="rounded-lg border p-6" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <h3 className="text-[16px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>Notification Preferences</h3>
          <p className="text-[12px] mb-6" style={{ color: "var(--topbar-subtitle)" }}>Control how and when you receive system notifications</p>

          <div className="space-y-6">
            {/* Channels */}
            <div className="border-b pb-5" style={{ borderColor: "var(--card-border)" }}>
              <h4 className="text-[13px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Notification Channels</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                  <div className="flex items-center gap-2">
                    <Mail size={14} style={{ color: "#245C5A" }} />
                    <span className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>Email</span>
                  </div>
                  <ToggleSwitch enabled={emailEnabled} onChange={() => setEmailEnabled(!emailEnabled)} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                  <div className="flex items-center gap-2">
                    <MessageSquare size={14} style={{ color: "#2563EB" }} />
                    <span className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>In-App</span>
                  </div>
                  <ToggleSwitch enabled={inAppEnabled} onChange={() => setInAppEnabled(!inAppEnabled)} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                  <div className="flex items-center gap-2">
                    <Smartphone size={14} style={{ color: "#7C3AED" }} />
                    <span className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>SMS</span>
                  </div>
                  <ToggleSwitch enabled={smsEnabled} onChange={() => setSmsEnabled(!smsEnabled)} />
                </div>
              </div>
            </div>

            {/* Alert Types */}
            <div>
              <h4 className="text-[13px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Alert Types</h4>
              <div className="space-y-2">
                {[
                  { key: "critical", label: "Critical Alerts", desc: "System failures, security breaches", state: alertCritical, set: setAlertCritical },
                  { key: "compliance", label: "Compliance Alerts", desc: "Audit findings, policy violations", state: alertCompliance, set: setAlertCompliance },
                  { key: "system", label: "System Updates", desc: "Maintenance windows, new features", state: alertSystem, set: setAlertSystem },
                  { key: "updates", label: "Enhancement Updates", desc: "New releases, roadmap changes", state: alertUpdates, set: setAlertUpdates },
                ].map((alert) => (
                  <div key={alert.key} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                    <div>
                      <p className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{alert.label}</p>
                      <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{alert.desc}</p>
                    </div>
                    <ToggleSwitch enabled={alert.state} onChange={() => alert.set(!alert.state)} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── INTEGRATIONS TAB ─────────────────────────────────── */}
      {activeTab === "integrations" && (
        <div className="rounded-lg border p-6" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <h3 className="text-[16px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>Integration Settings</h3>
          <p className="text-[12px] mb-6" style={{ color: "var(--topbar-subtitle)" }}>Manage external system connections and API access</p>

          <div className="space-y-4">
            {/* Entra ID */}
            <div className="flex items-center justify-between p-4 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EFF6FF" }}>
                  <ShieldCheck size={18} style={{ color: "#2563EB" }} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>Microsoft Entra ID</p>
                  <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>SSO and user directory synchronization</p>
                  {entraStatus === "connected" && (
                    <p className="text-[10px] mt-0.5" style={{ color: "#059669" }}>Last sync: 2026-07-08 10:15 AM</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium"
                  style={{
                    backgroundColor: entraStatus === "connected" ? "#ECFDF5" : "#F3F4F6",
                    color: entraStatus === "connected" ? "#059669" : "#6B7280",
                  }}
                >
                  {entraStatus === "connected" ? <CheckCircle size={10} /> : <XCircle size={10} />}
                  {entraStatus === "connected" ? "Connected" : "Disconnected"}
                </span>
                <button
                  onClick={() => setEntraStatus(entraStatus === "connected" ? "disconnected" : "connected")}
                  className="text-[11px] px-3 py-1.5 rounded-md font-medium border cursor-pointer"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  {entraStatus === "connected" ? "Disconnect" : "Connect"}
                </button>
              </div>
            </div>

            {/* Netlify */}
            <div className="flex items-center justify-between p-4 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#F0FDFA" }}>
                  <RefreshCw size={18} style={{ color: "#245C5A" }} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>Netlify</p>
                  <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Frontend deployment and hosting</p>
                  {netlifyStatus === "connected" && (
                    <p className="text-[10px] mt-0.5" style={{ color: "#059669" }}>Last deploy: 2026-07-08 06:30 AM</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium"
                  style={{
                    backgroundColor: netlifyStatus === "connected" ? "#ECFDF5" : "#F3F4F6",
                    color: netlifyStatus === "connected" ? "#059669" : "#6B7280",
                  }}
                >
                  {netlifyStatus === "connected" ? <CheckCircle size={10} /> : <XCircle size={10} />}
                  {netlifyStatus === "connected" ? "Connected" : "Disconnected"}
                </span>
                <button
                  onClick={() => setNetlifyStatus(netlifyStatus === "connected" ? "disconnected" : "connected")}
                  className="text-[11px] px-3 py-1.5 rounded-md font-medium border cursor-pointer"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  {netlifyStatus === "connected" ? "Disconnect" : "Connect"}
                </button>
              </div>
            </div>

            {/* Railway */}
            <div className="flex items-center justify-between p-4 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#F3E8FF" }}>
                  <Plug size={18} style={{ color: "#7C3AED" }} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>Railway</p>
                  <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Backend services and database hosting</p>
                  {railwayStatus === "connected" && (
                    <p className="text-[10px] mt-0.5" style={{ color: "#059669" }}>Uptime: 99.97% (30 days)</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium"
                  style={{
                    backgroundColor: railwayStatus === "connected" ? "#ECFDF5" : "#F3F4F6",
                    color: railwayStatus === "connected" ? "#059669" : "#6B7280",
                  }}
                >
                  {railwayStatus === "connected" ? <CheckCircle size={10} /> : <XCircle size={10} />}
                  {railwayStatus === "connected" ? "Connected" : "Disconnected"}
                </span>
                <button
                  onClick={() => setRailwayStatus(railwayStatus === "connected" ? "disconnected" : "connected")}
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
        <div className="rounded-lg border p-6" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <h3 className="text-[16px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>Appearance</h3>
          <p className="text-[12px] mb-6" style={{ color: "var(--topbar-subtitle)" }}>Customize the visual appearance of your workspace</p>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: "var(--topbar-title)" }}>Theme</label>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full text-[12px] rounded-md border px-3 py-2 bg-transparent"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  {THEME_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold mb-1.5 block" style={{ color: "var(--topbar-title)" }}>Sidebar Mode</label>
                <select
                  value={sidebarMode}
                  onChange={(e) => setSidebarMode(e.target.value)}
                  className="w-full text-[12px] rounded-md border px-3 py-2 bg-transparent"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  {SIDEBAR_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                <div>
                  <p className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>Compact Mode</p>
                  <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Reduce spacing and padding</p>
                </div>
                <ToggleSwitch enabled={compactMode} onChange={() => setCompactMode(!compactMode)} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                <div>
                  <p className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>High Contrast</p>
                  <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Enhanced visibility mode</p>
                </div>
                <ToggleSwitch enabled={highContrast} onChange={() => setHighContrast(!highContrast)} />
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
