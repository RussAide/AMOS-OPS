import { useMemo, useState } from "react";
import { useHR } from "@/context/hr-context";
import { trpc } from "@/providers/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldAlert, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";

interface CredentialRecord {
  id: string;
  personId: string;
  personName: string;
  department: string;
  credentialType: string;
  expiryDate: string;
  daysRemaining: number;
  status: "green" | "amber" | "red" | "gray";
}

function computeStatus(daysRemaining: number): "green" | "amber" | "red" | "gray" {
  if (daysRemaining < 0) return "gray";
  if (daysRemaining < 30) return "red";
  if (daysRemaining < 90) return "amber";
  return "green";
}

export function CredentialExpiryDashboard() {
  const { people } = useHR();
  const { data: apiCredentials = [] } = trpc.credentials.list.useQuery(undefined);
  const [filter, setFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");

  // Build credential records from API data + person lookup
  const credentialRecords: CredentialRecord[] = useMemo(() => {
    const records: CredentialRecord[] = [];
    for (const c of apiCredentials) {
      const person = people.find((p) => p.id === c.personId);
      const expiry = c.expiryDate ? new Date(c.expiryDate) : null;
      const daysRemaining = expiry
        ? Math.ceil((expiry.getTime() - Date.now()) / 86400000)
        : -999;
      records.push({
        id: c.id,
        personId: c.personId,
        personName: person ? `${person.firstName} ${person.lastName}` : c.personId,
        department: person?.department || "Unknown",
        credentialType: c.credentialType,
        expiryDate: c.expiryDate || "",
        daysRemaining,
        status: computeStatus(daysRemaining),
      });
    }
    return records;
  }, [apiCredentials, people]);

  // Compute departments from people
  const departments = useMemo(
    () => [...new Set(people.map((p) => p.department))].sort(),
    [people]
  );

  const filtered = useMemo(() => {
    return credentialRecords.filter((c) => {
      if (filter === "expired") return c.status === "gray";
      if (filter === "red") return c.status === "red";
      if (filter === "amber") return c.status === "amber";
      if (filter === "green") return c.status === "green";
      return true;
    }).filter((c) => {
      if (deptFilter === "all") return true;
      return c.department === deptFilter;
    }).sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [filter, deptFilter, credentialRecords]);

  const stats = useMemo(() => ({
    total: credentialRecords.length,
    expired: credentialRecords.filter((c) => c.status === "gray").length,
    red: credentialRecords.filter((c) => c.status === "red").length,
    amber: credentialRecords.filter((c) => c.status === "amber").length,
    green: credentialRecords.filter((c) => c.status === "green").length,
  }), [credentialRecords]);

  const statusConfig: Record<string, { color: string; bg: string; label: string; icon: typeof CheckCircle2 }> = {
    green: { color: "#059669", bg: "#f0fdf4", label: "Valid", icon: CheckCircle2 },
    amber: { color: "#D97706", bg: "#fffbeb", label: "Expiring Soon", icon: Clock },
    red: { color: "#DC2626", bg: "#fef2f2", label: "Critical", icon: AlertTriangle },
    gray: { color: "#6B7280", bg: "#f3f4f6", label: "Expired", icon: ShieldAlert },
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="w-full text-left p-3 rounded-lg border transition-all hover:shadow-md" style={{ borderColor: "#DC262630", backgroundColor: "#fef2f208" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Expiring Credentials</p>
              <p className="text-2xl font-bold mt-1" style={{ color: "#DC2626" }}>{stats.expired + stats.red + stats.amber}</p>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#fef2f2", color: "#DC2626" }}>
                {stats.red} critical
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#fffbeb", color: "#D97706" }}>
                {stats.amber} expiring
              </span>
            </div>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: "#245C5A" }}>
            <ShieldAlert size={18} />
            Credential Expiry Dashboard
          </DialogTitle>
        </DialogHeader>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: "Expired", value: stats.expired, color: "#6B7280", bg: "#f3f4f6" },
            { label: "Critical (<30d)", value: stats.red, color: "#DC2626", bg: "#fef2f2" },
            { label: "Expiring Soon", value: stats.amber, color: "#D97706", bg: "#fffbeb" },
            { label: "Valid", value: stats.green, color: "#059669", bg: "#f0fdf4" },
          ].map((s) => (
            <div key={s.label} className="text-center p-2 rounded-md" style={{ backgroundColor: s.bg }}>
              <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[8px] font-medium uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 text-xs w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="red">Critical (&lt;30d)</SelectItem>
              <SelectItem value="amber">Expiring Soon</SelectItem>
              <SelectItem value="green">Valid</SelectItem>
            </SelectContent>
          </Select>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Credential list */}
        <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
          {filtered.map((cred) => {
            const config = statusConfig[cred.status];
            const Icon = config.icon;
            return (
              <div
                key={cred.id}
                className="flex items-center gap-3 p-2.5 rounded-md border"
                style={{ borderColor: `${config.color}30`, backgroundColor: config.bg }}
              >
                <Icon size={16} style={{ color: config.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold truncate">{cred.personName}</span>
                    <span className="text-[8px] px-1 py-0.5 rounded bg-white/70 text-gray-500 font-medium">{cred.department}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{cred.credentialType}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] font-medium" style={{ color: config.color }}>
                    {cred.daysRemaining < 0
                      ? `${Math.abs(cred.daysRemaining)} days overdue`
                      : `${cred.daysRemaining} days left`}
                  </p>
                  <p className="text-[9px] text-muted-foreground">Exp: {cred.expiryDate}</p>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No credentials match the selected filters.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
