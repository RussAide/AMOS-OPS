import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../api/router";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authorizeAccess, procedureAccessResource } from "@/constants/access-control";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/providers/trpc";

type Offer = inferRouterOutputs<AppRouter>["hr"]["listOffers"][number];
const offerStatuses = { pending: "Awaiting response", accepted: "Accepted", declined: "Declined" };
const packetStatuses = { pending: "Pending", incomplete: "Incomplete", ready_for_review: "Ready for review" };
const selectStyle = "mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm";
type Editor = { kind: "new" } | { kind: "existing"; offer: Offer };

function OfferField({ name, label, value, maxLength = 2048 }: {
  name: string; label: string; value?: string; maxLength?: number;
}) {
  return <div>
    <Label htmlFor={name}>{label}</Label>
    <Input className="mt-1" id={name} name={name} defaultValue={value} maxLength={maxLength} required />
  </div>;
}

export default function OffersPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const offers = trpc.hr.listOffers.useQuery();
  const applications = trpc.hr.listApplications.useQuery();
  const create = trpc.hr.createOffer.useMutation();
  const respond = trpc.hr.recordOfferResponse.useMutation();
  const packet = trpc.hr.updateOfferPacket.useMutation();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [response, setResponse] = useState<"accepted" | "declined">("accepted");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function canWrite(procedure: "createOffer" | "recordOfferResponse" | "updateOfferPacket") {
    const resource = procedureAccessResource(`hr.${procedure}`, "mutation");
    return !!user && !!resource && authorizeAccess({
      userId: user.id, role: user.role, department: user.department ?? undefined,
    }, resource).allowed;
  }

  const canCreate = canWrite("createOffer");
  const canRespond = canWrite("recordOfferResponse");
  const canUpdatePacket = canWrite("updateOfferPacket");
  const busy = create.isPending || respond.isPending || packet.isPending;
  const saved = editor?.kind === "existing" ? editor.offer : undefined;
  const editingResponse = saved?.status === "pending" && canRespond;
  const editingPacket = saved?.status === "accepted" && canUpdatePacket;
  const allOffers = offers.data ?? [];
  const linked = new Set(allOffers.map(row => row.applicationReference));
  const available = applications.data?.filter(row => row.disposition === "recommended" && !linked.has(row.reference)) ?? [];
  const term = search.trim().toLowerCase();
  const visible = allOffers.filter(row =>
    [row.applicationReference, row.offerReference].some(value => value.toLowerCase().includes(term)));

  function open(next: Editor) {
    setEditor(next);
    setResponse("accepted");
    setError("");
    setNotice("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    setError("");
    try {
      let updated: Offer;
      if (editor.kind === "new") {
        updated = await create.mutateAsync({
          applicationReference: value("application"), offerReference: value("issued-offer"),
          selectionReference: value("selection"),
        });
      } else {
        const { applicationReference, revision } = editor.offer;
        if (editingResponse) {
          const evidence = value("response-evidence");
          updated = await respond.mutateAsync({ applicationReference, revision, response: response === "accepted"
            ? { status: "accepted", evidence, firstName: value("first-name"), lastName: value("last-name") }
            : { status: "declined", evidence } });
        } else if (editingPacket) {
          updated = await packet.mutateAsync({ applicationReference, revision,
            packetReference: value("packet-index"), fileChecklistReference: value("file-checklist"),
            packetStatus: value("packet-status") === "ready_for_review" ? "ready_for_review" : "incomplete" });
        } else {
          return;
        }
      }
      setSearch(updated.offerReference);
      setNotice(`Saved offer ${updated.offerReference}.`);
      setEditor(null);
      await Promise.all([utils.hr.listOffers.invalidate(), utils.hr.listPeople.invalidate(), utils.hr.dashboard.invalidate()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the offer.");
    }
  }

  return <main className="min-h-screen bg-[#f5f7f7] p-4 sm:p-6">
    <h1 className="text-2xl font-bold text-[#1a3a38]">Offers &amp; Pre-Employment</h1>
    <p className="mt-1 text-sm text-slate-600">Record issued offers, responses and personnel packet references. Keep signed documents in the restricted workforce record.</p>
    <section className="mt-5 rounded-lg border bg-white p-4" aria-label="Offers">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><Label htmlFor="offer-search">Find offers</Label>
          <Input className="mt-1 sm:w-72" id="offer-search" value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        {canCreate && <Button disabled={!offers.isSuccess || !available.length} onClick={() => open({ kind: "new" })}>Record issued offer</Button>}
      </div>
      {canCreate && offers.isSuccess && applications.isSuccess && !available.length &&
        <p className="mt-3 text-sm text-slate-600">A recommended application without a recorded offer is needed to start.</p>}
      {notice && <p role="status" className="mt-3 text-sm text-[#245C5A]">{notice}</p>}
      {(offers.isLoading || applications.isLoading) && <p className="mt-3 text-sm" role="status">Loading offer records…</p>}
      {(offers.isError || applications.isError) && <div className="mt-3">
        <p role="alert">Unable to load offers or screened applications.</p>
        <Button variant="outline" onClick={() => { void offers.refetch(); void applications.refetch(); }}>Retry</Button>
      </div>}
      {offers.isSuccess && <div className="mt-4">
        <p className="mb-2 text-sm text-slate-600">Showing {visible.length} of {allOffers.length} offers</p>
        {visible.length > 0 ? <div className="overflow-x-auto"><table className="w-full text-left text-sm">
          <thead className="bg-[#245C5A] text-white"><tr>
            {["Offer", "Application", "Response", "Personnel packet", "Actions"].map(label =>
              <th key={label} scope="col" className="p-3">{label}</th>)}
          </tr></thead>
          <tbody>{visible.map(row => <tr key={row.applicationReference} className="border-b">
            <td className="p-3">{row.offerReference}</td>
            <td className="p-3">{row.applicationReference}</td>
            <td className="p-3">{offerStatuses[row.status]}</td>
            <td className="p-3">{row.status === "accepted" ? packetStatuses[row.packetStatus] : "—"}</td>
            <td className="p-3"><Button variant="outline" aria-label={`Open ${row.offerReference}`} onClick={() => open({ kind: "existing", offer: row })}>Open</Button></td>
          </tr>)}</tbody>
        </table></div> : <p className="text-sm text-slate-600">No offers match.</p>}
      </div>}
    </section>
    <Dialog open={editor !== null} onOpenChange={open => { if (!open && !busy) setEditor(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{saved ? saved.offerReference : "Record issued offer"}</DialogTitle>
          <DialogDescription>Use the approved decision and offer records. Duty clearance follows the separate workforce review.</DialogDescription>
        </DialogHeader>
        {editor && <form className="grid gap-3" onSubmit={event => void submit(event)}>
          {editor.kind === "new" ? <>
            <div><Label htmlFor="application">Recommended application</Label>
              <select className={selectStyle} id="application" name="application" required defaultValue="">
                <option value="">Select an application</option>
                {available.map(row => <option key={row.reference} value={row.reference}>{row.reference} · {row.requisitionReference}</option>)}
              </select>
            </div>
            <OfferField name="selection" label="Approved selection reference" />
            <OfferField name="issued-offer" label="Issued offer reference" maxLength={120} />
          </> : <>
            <dl className="grid gap-1 break-words text-sm">
              <div><dt className="inline font-semibold">Application </dt><dd className="inline">{editor.offer.applicationReference}</dd></div>
              <div><dt className="inline font-semibold">Selection evidence </dt><dd className="inline">{editor.offer.selectionReference}</dd></div>
              <div><dt className="inline font-semibold">Response </dt><dd className="inline">{offerStatuses[editor.offer.status]}</dd></div>
              {editor.offer.responseReference && <div><dt className="inline font-semibold">Response evidence </dt><dd className="inline">{editor.offer.responseReference}</dd></div>}
            </dl>
            {editor.offer.personId && <Link className="text-sm font-medium text-[#245C5A] underline" to={`/hr/person/${encodeURIComponent(editor.offer.personId)}`}>Open personnel record</Link>}
            {editingResponse && <>
              <div><Label htmlFor="offer-response">Offer response</Label>
                <select id="offer-response" className={selectStyle} value={response}
                  onChange={event => setResponse(event.target.value === "declined" ? "declined" : "accepted")}>
                  <option value="accepted">Accepted</option><option value="declined">Declined</option>
                </select>
              </div>
              <OfferField name="response-evidence" label={response === "accepted" ? "Signed acceptance reference" : "Decline evidence reference"} />
              {response === "accepted" && <div className="grid gap-3 sm:grid-cols-2">
                <OfferField name="first-name" label="First name" maxLength={200} />
                <OfferField name="last-name" label="Last name" maxLength={200} />
              </div>}
            </>}
            {editingPacket && <>
              <OfferField name="packet-index" label="Returned packet index reference" value={editor.offer.packetReference ?? ""} />
              <OfferField name="file-checklist" label="Personnel file checklist reference" value={editor.offer.fileChecklistReference ?? ""} />
              <div><Label htmlFor="packet-status">Packet status</Label>
                <select id="packet-status" name="packet-status" className={selectStyle}
                  defaultValue={editor.offer.packetStatus === "pending" ? "" : editor.offer.packetStatus} required>
                  <option value="">Select a review status</option>
                  <option value="incomplete">Incomplete</option><option value="ready_for_review">Ready for review</option>
                </select>
              </div>
            </>}
            {editor.offer.status === "accepted" && !editingPacket && <dl className="grid gap-1 break-words text-sm">
              <div><dt className="inline font-semibold">Packet status </dt><dd className="inline">{packetStatuses[editor.offer.packetStatus]}</dd></div>
              {editor.offer.packetReference && <div><dt className="inline font-semibold">Packet index </dt><dd className="inline">{editor.offer.packetReference}</dd></div>}
              {editor.offer.fileChecklistReference && <div><dt className="inline font-semibold">File checklist </dt><dd className="inline">{editor.offer.fileChecklistReference}</dd></div>}
            </dl>}
          </>}
          {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setEditor(null)}>Close</Button>
            {(editor.kind === "new" || editingResponse || editingPacket) &&
              <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save offer"}</Button>}
          </DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
  </main>;
}
