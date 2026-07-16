import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Filter,
  LockKeyhole,
  Search,
  ShieldCheck,
  TestTube2,
} from "lucide-react";
import {
  REGULATORY_EXCEPTIONS,
  REGULATORY_RULE_REVIEWS,
  REGULATORY_RULES,
  REGULATORY_SCENARIOS,
  REGULATORY_SOURCE_VALIDATIONS,
  regulatoryRegisterSummary,
  type RegulatoryDomain,
} from "@contracts/regulatory/register";

type DomainFilter = "ALL" | RegulatoryDomain;

const DOMAIN_COLORS: Record<RegulatoryDomain, string> = {
  MHTCM: "#2563EB",
  MHRS: "#7C3AED",
  BILLING: "#D97706",
  GRO: "#0F766E",
  PART2: "#991B1B",
};

const OUTCOME_STYLE = {
  allow: { color: "#047857", background: "#ECFDF5", label: "ALLOW" },
  deny: { color: "#B91C1C", background: "#FEF2F2", label: "DENY" },
  review: { color: "#B45309", background: "#FFFBEB", label: "REVIEW" },
};

export function RegulatoryFrameworkPage() {
  const [domain, setDomain] = useState<DomainFilter>("ALL");
  const [query, setQuery] = useState("");
  const summary = regulatoryRegisterSummary();

  const filteredRules = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return REGULATORY_RULES.filter((rule) => {
      if (domain !== "ALL" && rule.domain !== domain) return false;
      if (!normalized) return true;
      return [rule.id, rule.title, rule.citation, rule.owner, rule.domain]
        .some((value) => value.toLowerCase().includes(normalized));
    });
  }, [domain, query]);

  const metricCards = [
    { label: "Controlled rules", value: summary.rules, detail: `${summary.operational} operational`, icon: ShieldCheck, color: "#0F766E" },
    { label: "Validated sources", value: summary.sources, detail: "Primary authorities", icon: BookOpenCheck, color: "#2563EB" },
    { label: "Prototype reviews", value: summary.reviews, detail: "Two lanes per rule", icon: ClipboardCheck, color: "#7C3AED" },
    { label: "Automated scenarios", value: summary.scenarios, detail: "Allow, deny, review", icon: TestTube2, color: "#D97706" },
  ];

  return (
    <div className="px-4 md:px-6 pt-4 pb-10 space-y-5">
      <section className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <div className="px-5 py-5 md:px-6 md:py-6" style={{ background: "linear-gradient(135deg, #102A43 0%, #163C4C 58%, #0F766E 100%)" }}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[9px] font-bold tracking-[1.2px] px-2 py-1 rounded" style={{ color: "#D1FAE5", backgroundColor: "rgba(16,185,129,.16)", border: "1px solid rgba(167,243,208,.25)" }}>M1.2 CONTROLLED</span>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,.65)" }}>Synthetic prototype environment</span>
              </div>
              <h1 className="text-[24px] md:text-[28px] font-bold text-white">Regulatory Framework Command Center</h1>
              <p className="mt-2 max-w-3xl text-[13px] leading-5" style={{ color: "rgba(255,255,255,.75)" }}>
                One governed view of MHTCM, MHRS, billing, GRO Chapter 748, and 42 CFR Part 2 controls—with traceability from authority to test evidence.
              </p>
            </div>
            <div className="rounded-lg px-4 py-3 min-w-[220px]" style={{ backgroundColor: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)" }}>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-white"><CheckCircle2 size={14} color="#6EE7B7" /> Register integrity</div>
              <div className="text-[21px] font-bold text-white mt-1">30 / 30 mapped</div>
              <div className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,.62)" }}>UI · API · database · audit · exception · test</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {metricCards.map((card) => (
          <div key={card.label} className="rounded-lg border p-4" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
            <div className="flex items-center justify-between">
              <card.icon size={16} style={{ color: card.color }} />
              <span className="text-[22px] font-bold" style={{ color: card.color }}>{card.value}</span>
            </div>
            <div className="text-[12px] font-semibold mt-2" style={{ color: "var(--topbar-title)" }}>{card.label}</div>
            <div className="text-[10px] mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>{card.detail}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <div>
            <h2 className="text-[14px] font-bold" style={{ color: "var(--topbar-title)" }}>Current-source validation</h2>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>Authoritative references controlling this prototype rule set</p>
          </div>
          <span className="text-[10px] px-2 py-1 rounded-full" style={{ color: "#047857", backgroundColor: "#ECFDF5" }}>4 validated</span>
        </div>
        <div className="grid md:grid-cols-2 gap-3 p-4">
          {REGULATORY_SOURCE_VALIDATIONS.map((source) => (
            <a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="rounded-lg border p-3 transition-colors hover:bg-black/[.02]" style={{ borderColor: "var(--card-border)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold" style={{ color: "var(--topbar-title)" }}>{source.title}</div>
                  <div className="text-[9px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>{source.authority} · {source.versionOrEffectiveDate}</div>
                  <div className="text-[9px] mt-1" style={{ color: "#047857" }}>Validated {source.validatedOn}</div>
                </div>
                <ExternalLink size={13} style={{ color: "var(--topbar-subtitle)" }} />
              </div>
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--card-border)" }}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-bold" style={{ color: "var(--topbar-title)" }}>Requirements-to-control matrix</h2>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>{filteredRules.length} rules shown</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex items-center gap-2 rounded-md border px-2" style={{ borderColor: "var(--card-border)" }}>
                <Search size={13} style={{ color: "var(--topbar-subtitle)" }} />
                <input aria-label="Search regulatory rules" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rule, citation, owner" className="h-8 w-full sm:w-52 bg-transparent text-[11px] outline-none" style={{ color: "var(--topbar-title)" }} />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={13} style={{ color: "var(--topbar-subtitle)" }} />
                <select aria-label="Filter regulatory domain" value={domain} onChange={(event) => setDomain(event.target.value as DomainFilter)} className="h-8 rounded-md border px-2 text-[11px]" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)", color: "var(--topbar-title)" }}>
                  <option value="ALL">All domains</option>
                  {Object.keys(DOMAIN_COLORS).map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead>
              <tr className="text-[9px] uppercase tracking-[.7px]" style={{ color: "var(--topbar-subtitle)", backgroundColor: "rgba(148,163,184,.07)" }}>
                <th className="px-4 py-2.5">Rule</th><th className="px-3 py-2.5">Authority</th><th className="px-3 py-2.5">Owner</th><th className="px-3 py-2.5">Implementation</th><th className="px-3 py-2.5">Control coverage</th><th className="px-4 py-2.5">State</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule) => (
                <tr key={rule.id} className="border-t" style={{ borderColor: "var(--card-border)" }}>
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: DOMAIN_COLORS[rule.domain], backgroundColor: `${DOMAIN_COLORS[rule.domain]}12` }}>{rule.domain}</span>
                      <div><div className="text-[10px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{rule.id}</div><div className="text-[11px] font-semibold mt-0.5" style={{ color: "var(--topbar-title)" }}>{rule.title}</div></div>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top"><div className="text-[10px]" style={{ color: "var(--topbar-title)" }}>{rule.citation}</div><div className="text-[9px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>{rule.authorityId}</div></td>
                  <td className="px-3 py-3 align-top text-[10px]" style={{ color: "var(--topbar-title)" }}>{rule.owner}</td>
                  <td className="px-3 py-3 align-top text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{rule.implementationPoint}</td>
                  <td className="px-3 py-3 align-top"><div className="flex flex-wrap gap-1">{["UI", "API", "DB", "AUDIT", "EXCEPTION", "TEST"].map((item) => <span key={item} className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ color: "#0F766E", backgroundColor: "#ECFDF5" }}>{item}</span>)}</div></td>
                  <td className="px-4 py-3 align-top"><span className="text-[9px] font-semibold px-2 py-1 rounded-full" style={{ color: rule.state === "operational" ? "#047857" : "#B45309", backgroundColor: rule.state === "operational" ? "#ECFDF5" : "#FFFBEB" }}>{rule.state}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-lg border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--card-border)" }}><h2 className="text-[14px] font-bold" style={{ color: "var(--topbar-title)" }}>Synthetic scenario demonstrations</h2><p className="text-[10px] mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>Controlled examples exercise allow, deny, and review behavior</p></div>
          <div className="grid md:grid-cols-2 gap-3 p-4">
            {REGULATORY_SCENARIOS.map((scenario) => {
              const style = OUTCOME_STYLE[scenario.expectedOutcome];
              return <div key={scenario.id} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)" }}><div className="flex items-start justify-between gap-2"><span className="text-[9px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{scenario.id} · {scenario.domain}</span><span className="text-[8px] font-bold px-2 py-0.5 rounded" style={{ color: style.color, backgroundColor: style.background }}>{style.label}</span></div><div className="text-[11px] font-semibold mt-2" style={{ color: "var(--topbar-title)" }}>{scenario.title}</div><div className="text-[9px] mt-1 leading-4" style={{ color: "var(--topbar-subtitle)" }}>{scenario.evidence}</div></div>;
            })}
          </div>
        </div>
        <div className="rounded-lg border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--card-border)" }}><h2 className="text-[14px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}><AlertTriangle size={14} color="#D97706" /> Controlled exceptions</h2><p className="text-[10px] mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>Each exception preserves a fail-closed disposition</p></div>
          <div className="p-4 space-y-3">
            {REGULATORY_EXCEPTIONS.map((exception) => <div key={exception.id} className="rounded-lg p-3" style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}><div className="text-[9px] font-mono" style={{ color: "#92400E" }}>{exception.id} · {exception.ruleId}</div><div className="text-[11px] font-semibold mt-1" style={{ color: "#78350F" }}>{exception.title}</div><div className="text-[9px] mt-1 leading-4" style={{ color: "#92400E" }}>{exception.safeDisposition}</div><div className="text-[8px] font-semibold mt-2" style={{ color: "#B45309" }}>OWNER: {exception.owner}</div></div>)}
          </div>
        </div>
      </section>

      <section className="rounded-lg border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3" style={{ backgroundColor: "#F8FAFC", borderColor: "#CBD5E1" }}>
        <div className="flex items-start gap-3"><LockKeyhole size={18} color="#334155" /><div><div className="text-[12px] font-semibold text-slate-800">Prototype review record is explicit</div><div className="text-[10px] mt-1 text-slate-600">{REGULATORY_RULE_REVIEWS.length} synthetic review rows demonstrate both review lanes. They do not impersonate a human signature.</div></div></div>
        <div className="text-[10px] font-semibold text-slate-700 whitespace-nowrap">M1.2 · Fictional data only</div>
      </section>
    </div>
  );
}

export default RegulatoryFrameworkPage;
