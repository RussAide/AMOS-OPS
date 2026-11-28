import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authorizeAccess, procedureAccessResource } from "@/constants/access-control";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/providers/trpc";

const qualifications = { pending: "Pending", met: "Met", not_met: "Not met" } as const;
const dispositions = {
  pending: "Pending review",
  recommended: "Recommended",
  not_recommended: "Not recommended",
  withdrawn: "Withdrawn",
} as const;

const evidenceFields = [
  ["qualificationReference", "Minimum qualifications review reference"],
  ["screeningReference", "Screening worksheet reference"],
  ["interviewReference", "Interview scorecard reference"],
  ["referencesReference", "Reference-check record"],
] as const;

type Review = {
  qualificationOutcome: keyof typeof qualifications;
  disposition: keyof typeof dispositions;
} & Record<(typeof evidenceFields)[number][0], string>;

const blankReview: Review = {
  qualificationOutcome: "pending",
  disposition: "pending",
  qualificationReference: "",
  screeningReference: "",
  interviewReference: "",
  referencesReference: "",
};

type Draft = {
  reference: string;
  requisitionReference: string;
  sourceReference: string;
  review: Review;
  revision?: number;
};

const initialDraft: Draft = { reference: "", requisitionReference: "", sourceReference: "", review: blankReview };

const selectStyle = "mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-60";

function optionalReference(value: string) {
  return value.trim() || null;
}

export default function ScreeningPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const applications = trpc.hr.listApplications.useQuery();
  const requisitions = trpc.hr.listRequisitions.useQuery();
  const create = trpc.hr.createApplication.useMutation();
  const update = trpc.hr.updateApplicationReview.useMutation();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function canWrite(procedure: "createApplication" | "updateApplicationReview") {
    const resource = procedureAccessResource(`hr.${procedure}`, "mutation");
    return !!user && !!resource && authorizeAccess({
      userId: user.id, role: user.role, department: user.department ?? undefined,
    }, resource).allowed;
  }

  const canCreate = canWrite("createApplication");
  const canUpdate = canWrite("updateApplicationReview");
  const pending = create.isPending || update.isPending;
  const positions = new Map(requisitions.data?.map(row => [row.reference, row.position]));
  const rows = applications.data?.filter(row => {
    const matches = [row.reference, row.requisitionReference, positions.get(row.requisitionReference) ?? ""];
    return matches.some(value => value.toLowerCase().includes(search.trim().toLowerCase()));
  }) ?? [];

  function openDraft(value: Draft) {
    setNotice("");
    setError("");
    setDraft(value);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || pending) return;
    setError("");
    try {
      const { reference, requisitionReference, sourceReference, review, revision } = draft;
      const saved = revision === undefined
        ? await create.mutateAsync({ reference, requisitionReference, sourceReference })
        : await update.mutateAsync({ reference, revision, review: {
          qualificationOutcome: review.qualificationOutcome,
          disposition: review.disposition,
          qualificationReference: optionalReference(review.qualificationReference),
          screeningReference: optionalReference(review.screeningReference),
          interviewReference: optionalReference(review.interviewReference),
          referencesReference: optionalReference(review.referencesReference),
        } });
      setSearch(saved.reference);
      setNotice(`Saved application ${saved.reference}.`);
      setDraft(null);
      await utils.hr.listApplications.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the application.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7f7] p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-[#1a3a38]">Applicant Screening</h1>
      <p className="mt-1 text-sm text-slate-600">Link applications to approved requisitions and record the screening disposition. Keep supporting documents in the restricted workforce record.</p>
      <section className="mt-5 rounded-lg border bg-white p-4" aria-label="Applications">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Label htmlFor="application-search">Find applications</Label>
            <Input className="mt-1 sm:w-72" id="application-search" value={search}
              onChange={event => setSearch(event.target.value)} />
          </div>
          {canCreate && <Button disabled={!requisitions.data?.length} onClick={() => openDraft(initialDraft)}>Record application</Button>}
        </div>
        {canCreate && requisitions.isSuccess && !requisitions.data.length &&
          <p className="mt-3 text-sm text-slate-600">Record an approved requisition in Recruitment before adding an application.</p>}
        {notice && <p role="status" className="mt-3 text-sm text-[#245C5A]">{notice}</p>}
        {applications.isLoading && <p role="status" className="mt-4">Loading applications…</p>}
        {(applications.isError || requisitions.isError) && <div className="mt-4">
          <p role="alert">Unable to load applications or approved requisitions.</p>
          <Button variant="outline" onClick={() => { void applications.refetch(); void requisitions.refetch(); }}>Retry</Button>
        </div>}
        {applications.isSuccess && <div className="mt-4">
          <p className="mb-3 text-sm text-slate-600">Showing {rows.length} of {applications.data.length} applications</p>
          {rows.length > 0 ? <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#245C5A] text-white"><tr>
                <th scope="col" className="p-3">Application reference</th>
                <th scope="col" className="p-3">Requisition</th>
                <th scope="col" className="p-3">Qualifications</th>
                <th scope="col" className="p-3">Screening disposition</th>
                <th scope="col" className="p-3">Actions</th>
              </tr></thead>
              <tbody>{rows.map(row => <tr key={row.reference} className="border-b">
                <td className="p-3">{row.reference}</td>
                <td className="p-3">{row.requisitionReference}{positions.has(row.requisitionReference) && <span className="block text-xs text-slate-600">{positions.get(row.requisitionReference)}</span>}</td>
                <td className="p-3">{qualifications[row.qualificationOutcome]}</td>
                <td className="p-3">{dispositions[row.disposition]}</td>
                <td className="p-3">
                  <Button variant="outline" aria-label={`${canUpdate ? "Review" : "View"} ${row.reference}`}
                    onClick={() => openDraft({ ...row, review: {
                      qualificationOutcome: row.qualificationOutcome,
                      disposition: row.disposition,
                      qualificationReference: row.qualificationReference ?? "",
                      screeningReference: row.screeningReference ?? "",
                      interviewReference: row.interviewReference ?? "",
                      referencesReference: row.referencesReference ?? "",
                    } })}>{canUpdate ? "Review" : "View"}</Button>
                </td>
              </tr>)}</tbody>
            </table>
          </div> : <p className="text-sm text-slate-600">No applications match.</p>}
        </div>}
      </section>
      <Dialog open={draft !== null} onOpenChange={open => { if (!open && !pending) setDraft(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.revision === undefined ? "Record application" : "Application review"}</DialogTitle>
            <DialogDescription>Enter record references. Use the approved hiring decision process before issuing an offer.</DialogDescription>
          </DialogHeader>
          {draft && <form className="grid gap-3" onSubmit={event => void save(event)}>
            <div><Label htmlFor="application-reference">Application reference</Label>
              <Input id="application-reference" required maxLength={120} value={draft.reference}
                readOnly={draft.revision !== undefined} disabled={pending}
                onChange={event => setDraft({ ...draft, reference: event.target.value })} />
            </div>
            <div><Label htmlFor="application-requisition">Approved requisition</Label>
              {draft.revision !== undefined ? <Input id="application-requisition" readOnly value={draft.requisitionReference} /> :
                <select id="application-requisition" className={selectStyle} required disabled={pending} value={draft.requisitionReference}
                  onChange={event => setDraft({ ...draft, requisitionReference: event.target.value })}>
                  <option value="">Select a requisition</option>
                  {requisitions.data?.map(row => <option key={row.reference} value={row.reference}>{row.reference} · {row.position}</option>)}
                </select>}
            </div>
            <div><Label htmlFor="application-source">Posting or recruitment source reference</Label>
              <Input id="application-source" required maxLength={2048} value={draft.sourceReference}
                readOnly={draft.revision !== undefined} disabled={pending}
                onChange={event => setDraft({ ...draft, sourceReference: event.target.value })} />
            </div>
            {draft.revision !== undefined && <>
              <div><Label htmlFor="qualification-outcome">Minimum qualifications outcome</Label>
                <select id="qualification-outcome" className={selectStyle} value={draft.review.qualificationOutcome} disabled={pending || !canUpdate}
                  onChange={event => setDraft({ ...draft, review: { ...draft.review, qualificationOutcome: event.target.value as Review["qualificationOutcome"] } })}>
                  {Object.entries(qualifications).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              {evidenceFields.map(([key, label]) => <div key={key}>
                <Label htmlFor={key}>{label}</Label>
                <Input id={key} maxLength={2048} value={draft.review[key]} readOnly={!canUpdate} disabled={pending}
                  onChange={event => setDraft({ ...draft, review: { ...draft.review, [key]: event.target.value } })} />
              </div>)}
              <div><Label htmlFor="application-disposition">Screening disposition</Label>
                <select id="application-disposition" className={selectStyle} value={draft.review.disposition} disabled={pending || !canUpdate}
                  onChange={event => setDraft({ ...draft, review: { ...draft.review, disposition: event.target.value as Review["disposition"] } })}>
                  {Object.entries(dispositions).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </>}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setDraft(null)}>Close</Button>
              {(draft.revision === undefined ? canCreate : canUpdate) &&
                <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save application"}</Button>}
            </DialogFooter>
          </form>}
        </DialogContent>
      </Dialog>
    </main>
  );
}
