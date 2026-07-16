import { ArrowRight, Ban, BookOpenCheck, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

interface M41cLegacyCansQuarantineProps {
  surface: "clinical" | "toolkit";
}

export function M41cLegacyCansQuarantine({
  surface,
}: M41cLegacyCansQuarantineProps) {
  const surfaceLabel =
    surface === "clinical" ? "Clinical assessment" : "Toolkit scoring";

  return (
    <main className="px-4 pb-10 pt-4 md:px-6" data-testid="m41c-legacy-cans-quarantine">
      <section
        className="mx-auto max-w-4xl overflow-hidden rounded-2xl border"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-5 md:px-7">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-100 p-2 text-amber-800">
              <ShieldAlert size={22} aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">
                M4.1C governed quarantine
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                Legacy CANS scoring is unavailable
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
                The {surfaceLabel.toLowerCase()} prototype was retired because it
                used incomplete items, home-grown totals, severity bands, and
                generic level-of-care logic. It cannot read, score, save, route,
                or update a clinical record.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 px-5 py-6 md:grid-cols-2 md:px-7">
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-900">
              <Ban size={17} aria-hidden="true" /> Quarantined capabilities
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-red-950/80">
              <li>Unverified instrument wording or response anchors</li>
              <li>Summed total-score or severity-band calculations</li>
              <li>Generic level-of-care or service-package assignment</li>
              <li>Production care, disclosure, claims, or external writes</li>
            </ul>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-950">
              <BookOpenCheck size={17} aria-hidden="true" /> Governed replacement
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-emerald-950/80">
              <li>Separate TRR CANS and DFPS CANS 3.0 metadata profiles</li>
              <li>Source, version, license, population, and owner controls</li>
              <li>Signed council validation and exact competency gates</li>
              <li>Synthetic-only pathways with named human review</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7" style={{ borderColor: "var(--card-border)" }}>
          <p className="max-w-2xl text-sm" style={{ color: "var(--topbar-subtitle)" }}>
            Use the Clinical Intelligence Fabric to inspect governed profiles,
            pathway controls, evidence, and synthetic scenarios.
          </p>
          <Link
            to="/clinical/intelligence-fabric"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#245C5A] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Open governed workflow <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
