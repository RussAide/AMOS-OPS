import { useState, type FormEvent } from "react";
import { Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authorizeAccess, procedureAccessResource } from "@/constants/access-control";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/providers/trpc";

interface RequisitionDraft {
  reference: string;
  position: string;
  department: string;
  supervisor: string;
  hiringOwner: string;
  approvedHeadcount: string;
  revision?: number;
}

const blankDraft: RequisitionDraft = {
  reference: "", position: "", department: "", supervisor: "", hiringOwner: "", approvedHeadcount: "",
};

const fields = [
  ["reference", "Approved requisition reference"],
  ["position", "Position"],
  ["department", "Department"],
  ["supervisor", "Supervisor"],
  ["hiringOwner", "Hiring owner"],
  ["approvedHeadcount", "Approved headcount"],
] as const;

export default function RecruitmentPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const requisitions = trpc.hr.listRequisitions.useQuery();
  const create = trpc.hr.createRequisition.useMutation();
  const update = trpc.hr.updateRequisition.useMutation();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<RequisitionDraft | null>(null);
  const [notice, setNotice] = useState("");
  const [saveError, setSaveError] = useState("");

  function canWrite(procedure: "createRequisition" | "updateRequisition") {
    const resource = procedureAccessResource(`hr.${procedure}`, "mutation");
    return !!user && !!resource && authorizeAccess({
      userId: user.id, role: user.role, department: user.department ?? undefined,
    }, resource).allowed;
  }

  const rows = requisitions.data ?? [];
  const term = search.trim().toLowerCase();
  const visibleRows = rows.filter((row) =>
    [row.reference, row.position, row.department, row.supervisor, row.hiringOwner]
      .some((value) => value.toLowerCase().includes(term)),
  );
  const isSaving = create.isPending || update.isPending;

  function openDraft(next: RequisitionDraft) {
    setNotice("");
    setSaveError("");
    setDraft(next);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || isSaving) return;
    setSaveError("");
    const { reference, revision, approvedHeadcount, ...details } = draft;
    const values = { ...details, approvedHeadcount: Number(approvedHeadcount) };
    try {
      const saved = revision === undefined
        ? await create.mutateAsync({ reference, fields: values })
        : await update.mutateAsync({ reference, revision, fields: values });
      setSearch(saved.reference);
      setNotice(`Saved requisition ${saved.reference}.`);
      setDraft(null);
      await utils.hr.listRequisitions.invalidate();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save the requisition.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7f7] p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-[#1a3a38]">Recruitment Pipeline</h1>
      <p className="mt-1 text-sm text-slate-600">
        View and record approved requisitions. Keep supporting hiring documents in the restricted workforce record.
      </p>
      <Link to="/hr/screening" className="mt-2 inline-flex text-sm font-medium text-[#245C5A] underline">Open Applicant Screening</Link>
      <section className="mt-5 rounded-lg border bg-white p-4" aria-label="Requisitions">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Label htmlFor="requisition-search">Find requisitions</Label>
            <div className="relative mt-1">
              <Search aria-hidden="true" className="absolute left-3 top-2.5 size-4 text-slate-500" />
              <Input id="requisition-search" className="pl-9 sm:w-72" value={search}
                onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>
          {canWrite("createRequisition") && (
            <Button onClick={() => openDraft(blankDraft)}><Plus aria-hidden="true" />New Requisition</Button>
          )}
        </div>
        {notice && <p role="status" className="mt-3 text-sm text-[#245C5A]">{notice}</p>}
        {requisitions.isLoading && <p role="status" className="mt-4">Loading requisitions…</p>}
        {requisitions.isError && (
          <div className="mt-4">
            <p role="alert">Unable to load requisitions.</p>
            <Button variant="outline" onClick={() => void requisitions.refetch()}>Retry</Button>
          </div>
        )}
        {requisitions.isSuccess && (
          <>
            <p className="my-4 text-sm text-slate-600">
              {rows.length} approved requisitions · {rows.reduce((sum, row) => sum + row.approvedHeadcount, 0)} approved positions
            </p>
            {visibleRows.length === 0
              ? <p className="text-sm text-slate-600">{term ? "No matching requisitions." : "No requisitions recorded."}</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[#245C5A] text-white">
                      <tr>
                        {fields.map(([key, label]) => <th key={key} scope="col" className="p-3">{label}</th>)}
                        {canWrite("updateRequisition") && <th scope="col" className="p-3">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => (
                        <tr key={row.reference} className="border-b">
                          {fields.map(([key]) => <td key={key} className="p-3">{row[key]}</td>)}
                          {canWrite("updateRequisition") && (
                            <td className="p-3">
                              <Button variant="outline" aria-label={`Edit ${row.reference}`}
                                onClick={() => openDraft({ ...row, approvedHeadcount: String(row.approvedHeadcount) })}>
                                Edit
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </>
        )}
      </section>
      <Dialog open={draft !== null} onOpenChange={(open) => { if (!open && !isSaving) setDraft(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.revision === undefined ? "New requisition" : "Edit requisition"}</DialogTitle>
            <DialogDescription>Use the approved position record to complete these fields.</DialogDescription>
          </DialogHeader>
          {draft && (
            <form className="grid gap-3" onSubmit={(event) => void save(event)}>
              {fields.map(([key, label]) => {
                const isCount = key === "approvedHeadcount";
                return (
                  <div key={key}>
                    <Label htmlFor={`requisition-${key}`}>{label}</Label>
                    <Input id={`requisition-${key}`} className="mt-1" required value={draft[key]}
                      type={isCount ? "number" : "text"}
                      min={isCount ? 1 : undefined} max={isCount ? 999 : undefined}
                      step={isCount ? 1 : undefined}
                      maxLength={isCount ? undefined : key === "reference" ? 120 : 200}
                      readOnly={key === "reference" && draft.revision !== undefined}
                      disabled={isSaving}
                      onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} />
                  </div>
                );
              })}
              {saveError && <p role="alert" className="text-sm text-red-700">{saveError}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" disabled={isSaving} onClick={() => setDraft(null)}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>{isSaving ? "Saving…" : "Save requisition"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
