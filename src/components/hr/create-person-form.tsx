import { useState } from "react";
import { useHR } from "@/context/hr-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, UserPlus } from "lucide-react";

const DEPARTMENTS = [
  "Field Operations",
  "Human Resources",
  "Clinical",
  "Quality Assurance",
  "Operations",
  "Training",
  "Compliance",
  "Administration",
];

const ROLES = [
  "GRO Specialist",
  "GRO Associate",
  "GRO Trainee",
  "Supervisor",
  "HR Coordinator",
  "Clinical Director",
  "QA Officer",
  "Operations Manager",
  "Training Coordinator",
  "Administrator",
];

export function CreatePersonForm({ onCreated }: { onCreated?: () => void }) {
  const { createPerson } = useHR();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [lane, setLane] = useState<"activation" | "management">("activation");
  const [hireDate, setHireDate] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const validate = () => {
    const errs: string[] = [];
    if (!firstName.trim()) errs.push("First name is required");
    if (!lastName.trim()) errs.push("Last name is required");
    if (!role) errs.push("Role is required");
    if (!department) errs.push("Department is required");
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    createPerson({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      employeeId: employeeId.trim() || "",
      role,
      department,
      lane,
      hireDate: hireDate || "",
      supervisor: supervisor.trim() || "",
      isEmployee: lane === "management" || !!hireDate,
    });
    setOpen(false);
    setFirstName("");
    setLastName("");
    setEmployeeId("");
    setRole("");
    setDepartment("");
    setLane("activation");
    setHireDate("");
    setSupervisor("");
    setErrors([]);
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="gap-1.5"
          style={{ backgroundColor: "#245C5A" }}
        >
          <Plus size={14} />
          Add Person
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: "#245C5A" }}>
            <UserPlus size={18} />
            Add New Person
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-2.5">
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700">{e}</p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-first">First Name *</Label>
              <Input
                id="cp-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Synthetic-Person-001"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-last">Last Name *</Label>
              <Input
                id="cp-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Johnson"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cp-empid">Employee ID</Label>
            <Input
              id="cp-empid"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="e.g. E-1051 (optional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department *</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue placeholder="Select dept" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Lane</Label>
              <Select value={lane} onValueChange={(v) => setLane(v as "activation" | "management")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activation">Activation</SelectItem>
                  <SelectItem value="management">Management</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-hire">Hire Date</Label>
              <Input
                id="cp-hire"
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cp-super">Supervisor</Label>
            <Input
              id="cp-super"
              value={supervisor}
              onChange={(e) => setSupervisor(e.target.value)}
              placeholder="e.g. Robert Fitzgerald (optional)"
            />
          </div>

          <div className="text-[10px] text-muted-foreground bg-gray-50 p-2 rounded">
            <strong>Note:</strong> Person will be created with all module statuses set to &quot;Pending&quot;.
            {lane === "management" && " Management lane will auto-mark as Employee."}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" style={{ backgroundColor: "#245C5A" }} onClick={handleSubmit}>
            Create Person
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
