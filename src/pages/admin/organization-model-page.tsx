import {
  BHC_DEPARTMENTS,
  CAMPUS_STAGES,
  OPERATING_DIVISIONS,
} from "@/constants/organization";

function categoryLabel(category: "profit-center" | "corporate-office"): string {
  return category === "profit-center" ? "Profit Center" : "Corporate Office";
}

function readinessLabel(value: string): string {
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter: string) => letter.toUpperCase());
}

/** Acceptance-focused rendering of the authoritative CTR-012–CTR-023 operating model. */
export function OrganizationModelPage() {
  return (
    <main className="px-4 md:px-6 pt-4 pb-8" aria-labelledby="organization-model-title">
      <header className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[1px]" style={{ color: "#245C5A" }}>
          Controlled Operating Model · Fictional Demonstration Reference
        </p>
        <h1 id="organization-model-title" className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>
          AMOS-OPS Organization & Campus Model
        </h1>
        <p className="text-[13px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>
          Four Operating Divisions, three Behavioral Health Center Division departments, and the Three-Stage Campus Development Pathway.
        </p>
      </header>

      <section aria-labelledby="division-heading" className="mb-7">
        <h2 id="division-heading" className="text-[15px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>
          Four Operating Divisions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {OPERATING_DIVISIONS.map((division) => (
            <article key={division.id} className="rounded-lg border p-4" style={{ backgroundColor: "var(--card-bg)", borderColor: `${division.color}55` }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[18px] font-bold" style={{ color: division.color }}>{division.code}</span>
                <span className="text-[9px] font-bold px-2 py-1 rounded-full" style={{ color: division.color, backgroundColor: `${division.color}15` }}>
                  {division.categoryTag} · {categoryLabel(division.category)}
                </span>
              </div>
              <h3 className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{division.name}</h3>
              <p className="text-[11px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>{division.purpose}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="department-heading" className="mb-7">
        <h2 id="department-heading" className="text-[15px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>
          Behavioral Health Center Division Departments
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Object.values(BHC_DEPARTMENTS).map((department) => (
            <article key={department.code} className="rounded-lg border p-4" style={{ backgroundColor: `${department.color}08`, borderColor: `${department.color}40` }}>
              <div className="text-[14px] font-bold" style={{ color: department.color }}>{department.shortName}</div>
              <h3 className="text-[12px] font-semibold mt-1" style={{ color: "var(--topbar-title)" }}>{department.name}</h3>
              <p className="text-[11px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>{department.purpose}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="campus-heading">
        <h2 id="campus-heading" className="text-[15px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>
          Three-Stage Campus Development Pathway
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {CAMPUS_STAGES.map((stage) => (
            <article key={stage.id} className="rounded-lg border p-4" style={{ backgroundColor: "var(--card-bg)", borderColor: `${stage.color}55` }}>
              <h3 className="text-[13px] font-semibold" style={{ color: stage.color }}>{stage.name}</h3>
              <p className="text-[11px] mt-2" style={{ color: "var(--topbar-subtitle)" }}>{stage.purpose}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <div><dt style={{ color: "var(--topbar-subtitle)" }}>Controlled capacity</dt><dd className="font-semibold" style={{ color: "var(--topbar-title)" }}>{stage.controlledCapacity}</dd></div>
                <div><dt style={{ color: "var(--topbar-subtitle)" }}>Prototype readiness</dt><dd className="font-semibold" style={{ color: stage.color }}>{readinessLabel(stage.readinessStatus)}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default OrganizationModelPage;
