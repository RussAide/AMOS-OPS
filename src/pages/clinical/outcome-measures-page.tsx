import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  DatabaseZap,
  ShieldAlert,
} from "lucide-react";
import { Link } from "react-router-dom";

export const M41C_OUTCOME_MEASURE_PAGE_MODE =
  "metadata_only_quarantine" as const;

const GOVERNED_CONTROLS = [
  {
    icon: BookOpenCheck,
    title: "Authority metadata",
    description:
      "Source authority, version, licensing, review dates, and citations are visible without exposing protected instrument content.",
  },
  {
    icon: BadgeCheck,
    title: "Activation governance",
    description:
      "A program-specific profile requires signed validation, exact competency evidence, and a named qualified human decision.",
  },
  {
    icon: DatabaseZap,
    title: "Synthetic evaluation",
    description:
      "Deterministic scenarios demonstrate workflow controls without patient records, computed clinical outputs, or live writes.",
  },
] as const;

export function OutcomeMeasuresPage() {
  return (
    <main
      className="px-4 pb-10 pt-4 md:px-6"
      data-mode={M41C_OUTCOME_MEASURE_PAGE_MODE}
      data-testid="m41c-outcome-measure-governance"
    >
      <section className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
        <div className="border-b border-amber-200 bg-gradient-to-r from-amber-50 via-white to-teal-50 px-6 py-7 md:px-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-amber-800">
                <ShieldAlert aria-hidden="true" className="size-4" />
                Governed evaluation boundary
              </div>
              <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">
                Outcome Measure Governance
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                The inherited execution surface is quarantined. This route now
                provides authority and control metadata only; it does not request
                patient records or generate clinical determinations.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                Legacy execution unavailable
              </span>
              <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-900">
                Synthetic evaluation only
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-3 md:p-8">
          {GOVERNED_CONTROLS.map(({ icon: Icon, title, description }) => (
            <article
              className="rounded-xl border border-slate-200 bg-slate-50 p-5"
              key={title}
            >
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-teal-100 text-teal-800">
                <Icon aria-hidden="true" className="size-5" />
              </div>
              <h2 className="text-sm font-bold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {description}
              </p>
            </article>
          ))}
        </div>

        <div className="mx-6 mb-6 flex flex-col gap-4 rounded-xl border border-teal-200 bg-teal-50 p-5 md:mx-8 md:mb-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-bold text-teal-950">
              Continue in the governed Clinical Intelligence Fabric
            </h2>
            <p className="mt-1 text-sm leading-6 text-teal-900/80">
              Review registered sources, profile separation, human gates,
              competency controls, and deterministic synthetic scenarios.
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-teal-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-900"
            to="/clinical/intelligence-fabric"
          >
            Open Clinical Intelligence Fabric
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

export default OutcomeMeasuresPage;
