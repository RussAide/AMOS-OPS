import { useState, useEffect } from "react";
import { useHR } from "@/context/HRContext";
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
import { Pencil, AlertTriangle } from "lucide-react";

const DEPARTMENTS = [
  "Field Operations",
  "Human Resources",
  "Clinical",
  "Quality Assurance",
  "Operations",
  "Training",
  "Compliance",
  "Executive",
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
  "Management",
];

interface Props {
  personId: string;
}

export function PersonEditForm({ personId }: Props) {
  const { people, updatePerson } = useHR();
  const person = people.find((p) => p.id === personId);

  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [lane, setLane] = useState<"activation" | "management">("activation");
  const [hireDate, setHireDate] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [isEmployee, setIsEmployee] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [showDeactivate, setShowDeactivate] = useState(false);

  // Sync form state when person data loads
  useEffect(() => {
    if (person && open) {
      setFirstName(person.firstName);
      setLastName(person.lastName);
      setEmployeeId(person.employeeId);
      setRole(person.role);
      setDepartment(person.department);
      setLane(person.lane);
      setHireDate(person.hireDate);
      setSupervisor(person.supervisor);
      setIsEmployee(person.isEmployee);
      setIsActive(person.isActive);
      setShowDeactivate(false);
    }
  }, [person, open]);

  if (!person) return null;

  const validate = () => {
    const errs: string[] = [];
    if (!firstName.trim()) errs.push("First name is required");
    if (!lastName.trim()) errs.push("Last name is required");
    if (!role) errs.push("Role is required");
    if (!department) errs.push("Department is required");
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    updatePerson(personId, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      employeeId: employeeId.trim(),
      role,
      department,
      lane,
      hireDate: hireDate || "",
      supervisor: supervisor.trim(),
      isEmployee,
      isActive,
    });
    setOpen(false);
    setErrors([]);
  };

  const handleDeactivate = () => {
    updatePerson(personId, { isActive: false });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5 text-[12px]"
        >
          <Pencil size={13} />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[16px]">
            Edit {person.firstName} {person.lastName}
          </DialogTitle>
        </DialogHeader>

        {errors.length > 0 && (
          <div className="rounded-lg border p-3 mb-2" style={{ backgroundColor: "#FEE2E2", borderColor: "#FECACA" }}>
            {errors.map((e, i) => (
              <p key={i} className="text-[11px] font-medium" style={{ color: "#991B1B" }}>{e}</p>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 py-2">
          <div>
            <Label className="text-[12px]">First Name *</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="text-[13px] mt-1" />
          </div>
          <div>
            <Label className="text-[12px]">Last Name *</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="text-[13px] mt-1" />
          </div>
          <div>
            <Label className="text-[12px]">Employee ID</Label>
            <Input value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="text-[13px] mt-1" placeholder="e.g. E-1045" />
          </div>
          <div>
            <Label className="text-[12px]">Hire Date</Label>
            <Input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className="text-[13px] mt-1" />
          </div>
          <div>
            <Label className="text-[12px]">Role *</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="text-[13px] mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r} className="text-[13px]">{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[12px]">Department *</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="text-[13px] mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => <SelectItem key={d} value={d} className="text-[13px]">{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[12px]">Lane</Label>
            <Select value={lane} onValueChange={(v) => setLane(v as "activation" | "management")}>
              <SelectTrigger className="text-[13px] mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="activation" className="text-[13px]">Activation</SelectItem>
                <SelectItem value="management" className="text-[13px]">Management</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[12px]">Supervisor</Label>
            <Input value={supervisor} onChange={(e) => setSupervisor(e.target.value)} className="text-[13px] mt-1" />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-4 py-2 border-t" style={{ borderColor: "var(--card-border)" }}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isEmployee}
              onChange={(e) => setIsEmployee(e.target.checked)}
              className="rounded"
            />
            <span className="text-[12px]">Employee</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded"
            />
            <span className="text-[12px]">Active</span>
          </label>
        </div>

        {/* Deactivate warning */}
        {!isActive && (
          <div className="rounded-lg border p-3" style={{ backgroundColor: "#FEF2F2", borderColor: "#FECACA" }}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} style={{ color: "#DC2626" }} />
              <p className="text-[11px] font-semibold" style={{ color: "#991B1B" }}>
                This person will be marked as inactive
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {isActive ? (
            <Button
              variant="outline"
              size="sm"
              className="text-[12px] mr-auto"
              style={{ color: "#DC2626", borderColor: "#FECACA" }}
              onClick={() => setShowDeactivate(true)}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-[12px] mr-auto"
              style={{ color: "#059669", borderColor: "#059669" }}
              onClick={() => setIsActive(true)}
            >
              Reactivate
            </Button>
          )}

          {showDeactivate && (
            <div className="flex items-center gap-2 mr-auto">
              <span className="text-[11px]" style={{ color: "#991B1B" }}>Confirm deactivation?</span>
              <Button
                variant="outline"
                size="sm"
                className="text-[11px] h-7"
                style={{ color: "#DC2626" }}
                onClick={handleDeactivate}
              >
                Yes, deactivate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] h-7"
                onClick={() => setShowDeactivate(false)}
              >
                Cancel
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="text-[12px]"
            onClick={() => { setOpen(false); setErrors([]); }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="text-[12px] text-white"
            style={{ backgroundColor: "#245C5A" }}
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
