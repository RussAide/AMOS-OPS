import { useState, type FormEvent } from "react";
import { Activity, ClipboardPlus, FileSignature, ShieldCheck } from "lucide-react";

export interface AuthoritativePlan {
  id: string;
  youthId: string;
  youthName: string;
  mrn: string;
  planStatus: string;
  intakeDate: string;
  planDueDate: string;
  caseManagerId?: string | null;
  caseManagerName?: string | null;
  therapistId?: string | null;
  therapistName?: string | null;
}

export interface AuthoritativeEncounter {
  id: string;
  youthName: string;
  mrn: string;
  encounterDate: string;
  serviceDescription: string;
  documentationStatus: string;
  minutesDelivered: number;
  unitsBilled: number;
  signedBy?: string | null;
}

interface Props {
  program: "MHTCM" | "MHRS";
  billingCode: "T1017" | "H2017";
  plans: AuthoritativePlan[];
  encounters: AuthoritativeEncounter[];
  loading: boolean;
  failed: boolean;
  busy: boolean;
  onCreatePlan: (input: {
    youthId: string;
    youthName: string;
    mrn: string;
    staffId: string;
    staffName: string;
    intakeDate: string;
  }) => Promise<void>;
  onCreateEncounter: (input: {
    plan: AuthoritativePlan;
    staffId: string;
    staffName: string;
    encounterDate: string;
    serviceDescription: string;
    minutesDelivered: number;
  }) => Promise<void>;
  onApprovePlan: (id: string, approvedBy: string) => Promise<void>;
  onSignEncounter: (id: string, signedBy: string) => Promise<void>;
}

const fieldClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-teal-700";

export function AuthoritativeProgramWorkspace(props: Props) {
  const [tab, setTab] = useState<"caseload" | "intake" | "encounter">("caseload");
  const [notice, setNotice] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [actorName, setActorName] = useState("");
  const selectedPlan = props.plans.find((plan) => plan.id === selectedPlanId);

  async function submitIntake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const data = new FormData(event.currentTarget);
    await props.onCreatePlan({
      youthId: String(data.get("youthId")),
      youthName: String(data.get("youthName")),
      mrn: String(data.get("mrn")),
      staffId: String(data.get("staffId")),
      staffName: String(data.get("staffName")),
      intakeDate: String(data.get("intakeDate")),
    });
    event.currentTarget.reset();
    setNotice(`${props.program} intake and draft service plan created.`);
    setTab("caseload");
  }

  async function submitEncounter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPlan) return;
    setNotice("");
    const data = new FormData(event.currentTarget);
    await props.onCreateEncounter({
      plan: selectedPlan,
      staffId: String(data.get("staffId")),
      staffName: String(data.get("staffName")),
      encounterDate: String(data.get("encounterDate")),
      serviceDescription: String(data.get("serviceDescription")),
      minutesDelivered: Number(data.get("minutesDelivered")),
    });
    event.currentTarget.reset();
    setSelectedPlanId("");
    setNotice(`${props.program} encounter saved as a draft and added to Service Delivery.`);
    setTab("caseload");
  }

  if (props.loading) return <State title={`Loading ${props.program} records`} />;
  if (props.failed) return <State title={`${props.program} operational data could not be loaded`} detail="The authoritative store did not return a safe response. No cached or demonstration records were substituted." error />;

  const signed = props.encounters.filter((item) => item.documentationStatus === "signed" || item.documentationStatus === "submitted").length;
  return (
    <main data-testid={`${props.program.toLowerCase()}-authoritative-workspace`} className="min-h-screen bg-slate-50 p-5 text-slate-950 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl bg-slate-950 p-6 text-white sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">AMOS-OPS · Authoritative operational record</p>
              <h1 className="mt-2 text-3xl font-bold">{props.program} Program Operations</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">Intake, assignment, service planning, encounters, signatures, and billing readiness are recorded in the durable Production store.</p>
            </div>
            <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">Authoritative · writable</span>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Caseload" value={props.plans.length} />
            <Metric label="Approved plans" value={props.plans.filter((p) => p.planStatus === "approved").length} />
            <Metric label="Encounters" value={props.encounters.length} />
            <Metric label="Billing-ready notes" value={signed} />
          </div>
        </header>

        <nav className="flex flex-wrap gap-2" aria-label={`${props.program} operational sections`}>
          {([['caseload','Caseload',Activity],['intake','New intake',ClipboardPlus],['encounter','New encounter',FileSignature]] as const).map(([id,label,Icon]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold ${tab === id ? 'border-teal-800 bg-teal-800 text-white' : 'border-slate-300 bg-white text-teal-900'}`}><Icon size={16}/>{label}</button>
          ))}
        </nav>

        {notice ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">{notice}</p> : null}

        {tab === "intake" ? (
          <form onSubmit={submitIntake} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
            <FormField label="Youth/case identifier"><input required name="youthId" className={fieldClass}/></FormField>
            <FormField label="Medical record number"><input required name="mrn" className={fieldClass}/></FormField>
            <FormField label="Youth name"><input required name="youthName" className={fieldClass}/></FormField>
            <FormField label={props.program === "MHTCM" ? "Case manager name" : "Assigned practitioner name"}><input required name="staffName" className={fieldClass}/></FormField>
            <FormField label="Staff identifier"><input required name="staffId" className={fieldClass}/></FormField>
            <FormField label="Intake date"><input required name="intakeDate" type="date" className={fieldClass}/></FormField>
            <div className="sm:col-span-2"><button disabled={props.busy} className="rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">Create authoritative intake</button></div>
          </form>
        ) : tab === "encounter" ? (
          <form onSubmit={submitEncounter} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
            <FormField label="Service plan"><select required value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)} className={fieldClass}><option value="">Select a plan</option>{props.plans.map((p) => <option key={p.id} value={p.id}>{p.youthName} · {p.mrn}</option>)}</select></FormField>
            <FormField label="Encounter date/time"><input required name="encounterDate" type="datetime-local" className={fieldClass}/></FormField>
            <FormField label="Practitioner name"><input required name="staffName" className={fieldClass}/></FormField>
            <FormField label="Staff identifier"><input required name="staffId" className={fieldClass}/></FormField>
            <FormField label="Minutes delivered"><input required name="minutesDelivered" type="number" min="1" defaultValue="15" className={fieldClass}/></FormField>
            <FormField label={`Billing code`}><input readOnly value={props.billingCode} className={`${fieldClass} bg-slate-100`}/></FormField>
            <div className="sm:col-span-2"><FormField label="Service description / progress note"><textarea required name="serviceDescription" rows={5} className={fieldClass}/></FormField></div>
            <div className="sm:col-span-2"><button disabled={props.busy || !selectedPlan} className="rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">Save encounter draft</button></div>
          </form>
        ) : (
          <section className="space-y-4">
            {props.plans.length === 0 ? <State title={`No ${props.program} cases yet`} detail="Use New intake to establish the first authoritative case and draft service plan."/> : props.plans.map((plan) => (
              <article key={plan.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div><h2 className="text-lg font-bold">{plan.youthName}</h2><p className="mt-1 text-sm text-slate-500">{plan.mrn} · Case {plan.youthId}</p><p className="mt-2 text-xs text-slate-600">Assigned: {plan.caseManagerName ?? plan.therapistName ?? "Pending"} · Plan due {new Date(plan.planDueDate).toLocaleDateString()}</p></div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-700">{plan.planStatus.replaceAll('_',' ')}</span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {plan.planStatus !== "approved" ? <><input aria-label={`Approver for ${plan.youthName}`} value={actorName} onChange={(e) => setActorName(e.target.value)} placeholder="LPHA/supervisor name" className="rounded-lg border border-slate-300 px-3 py-2 text-sm"/><button disabled={props.busy || !actorName.trim()} onClick={() => props.onApprovePlan(plan.id, actorName)} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Approve plan</button></> : null}
                </div>
              </article>
            ))}
            {props.encounters.length ? <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Recent service delivery</h2><div className="mt-3 space-y-3">{props.encounters.slice(0,10).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3"><div><p className="text-sm font-semibold">{item.youthName} · {item.minutesDelivered} minutes</p><p className="text-xs text-slate-500">{item.serviceDescription}</p></div>{item.documentationStatus === 'draft' ? <button disabled={props.busy} onClick={() => props.onSignEncounter(item.id, actorName || 'Authorized practitioner')} className="rounded-lg border border-teal-800 px-3 py-1.5 text-xs font-bold text-teal-900">Sign note</button> : <span className="text-xs font-bold uppercase text-emerald-700">{item.documentationStatus}</span>}</div>)}</div></div> : null}
          </section>
        )}
      </div>
    </main>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold text-slate-700"><span className="mb-1.5 block">{label}</span>{children}</label>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-cyan-400/40 bg-cyan-400/10 p-4"><p className="text-xs uppercase tracking-wider text-cyan-100">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>; }
function State({ title, detail, error = false }: { title: string; detail?: string; error?: boolean }) { return <main className="min-h-[240px] bg-slate-50 p-6"><section className={`mx-auto max-w-3xl rounded-2xl border bg-white p-8 ${error ? 'border-red-200' : 'border-slate-200'}`}><ShieldCheck className={error ? 'text-red-700' : 'text-teal-700'}/><h1 className="mt-4 text-xl font-bold">{title}</h1>{detail ? <p className="mt-2 text-sm text-slate-600">{detail}</p> : null}</section></main>; }
