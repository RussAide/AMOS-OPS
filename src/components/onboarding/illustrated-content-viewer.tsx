import {
  Shield, Heart, Eye, Users, Megaphone, CheckCircle, XCircle,
  AlertTriangle, Clock, Target, BookOpen, ClipboardCheck,
  MessageSquare, Frown, ThumbsUp, ThumbsDown, FileCheck, AlertOctagon,
  Sparkles, ArrowRight, Compass, TrendingUp, Star, Scale, Lock,
  GraduationCap, Hand, Flame, Brain, Activity, Bell, FileText
} from "lucide-react";
import { getModuleById, getQuizForModule, hasQuiz } from "@/data/onboardingData";
import { QuizEngine } from "./quiz-engine";
import { createElement } from "react";

// ─── Principle Icons Registry ─────────────────────────────────
const PRINCIPLE_ICONS: Record<string, typeof Shield> = {
  "youth rights": Scale,
  "dignity": Heart,
  "respect": Heart,
  "supervision": Eye,
  "boundaries": Lock,
  "reporting": Megaphone,
  "mission": Target,
  "safety": Shield,
  "team": Users,
  "accountability": ClipboardCheck,
  "confidentiality": Lock,
  "privacy": Lock,
  "hipaa": FileCheck,
  "conduct": Shield,
  "abuse": AlertOctagon,
  "neglect": Frown,
  "incident": Bell,
  "emergency": Flame,
  "infection": Activity,
  "documentation": FileText,
  "trauma": Brain,
  "de-escalation": TrendingUp,
  "crisis": AlertTriangle,
  "clearance": FileCheck,
  "systems": Lock,
  "access": Lock,
  "security": Shield,
  "rights": Scale,
  "ethics": Scale,
  "preparedness": Shield,
  "control": Activity,
  "record": FileText,
  "integrity": CheckCircle,
  "client": Users,
  "resident": Users,
  "person": Users,
  "served": Users,
  "organizational": Building,
  "identity": Sparkles,
  "structure": Building,
  "chain": Link,
  "command": Users,
  "regulatory": BookOpen,
  "program": BookOpen,
  "overview": BookOpen,
  "welcome": Hand,
  "services": Compass,
  "characteristics": Target,
  "observe": Eye,
  "engage": MessageSquare,
  "protect": Shield,
  "report": Bell,
  "escalate": TrendingUp,
  "listen": MessageSquare,
  "communicate": MessageSquare,
};

import { Building, Link } from "lucide-react";

function getIconForText(text: string): typeof Shield {
  const lower = text.toLowerCase();
  for (const [key, Icon] of Object.entries(PRINCIPLE_ICONS)) {
    if (lower.includes(key)) return Icon;
  }
  return Star;
}

// ─── Color Coding ────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; light: string }> = {
  Compliance: { bg: "#7C3AED", text: "#fff", border: "#7C3AED", light: "#F5F3FF" },
  Clinical: { bg: "#2563EB", text: "#fff", border: "#2563EB", light: "#EFF6FF" },
  Operations: { bg: "#D97706", text: "#fff", border: "#D97706", light: "#FFFBEB" },
  Professional: { bg: "#059669", text: "#fff", border: "#059669", light: "#ECFDF5" },
};

// ─── Content Parser ──────────────────────────────────────────

interface ParsedSection {
  type: "welcome" | "objectives" | "principles" | "rules" | "do" | "dont" | "redflags" | "responseModel" | "scenarios" | "checklist" | "rubric" | "completion" | "generic";
  title: string;
  items: string[];
  note?: string;
}

function parseContent(content: string): ParsedSection[] {
  const lines = content.split("\n");
  const sections: ParsedSection[] = [];
  let current: ParsedSection | null = null;

  const flushCurrent = () => {
    if (current && (current.items.length > 0 || current.title)) {
      sections.push(current);
    }
    current = null;
  };

  const startSection = (type: ParsedSection["type"], title: string) => {
    flushCurrent();
    current = { type, title, items: [] };
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const lower = line.toLowerCase();

    if (lower.startsWith("welcome to") || lower.startsWith("welcome")) {
      startSection("welcome", "Welcome");
      current!.items.push(line);
    } else if (lower.includes("learning objectives") || lower.includes("objectives:")) {
      startSection("objectives", "Learning Objectives");
    } else if (lower.includes("principles in action") || lower.includes("core principles") || lower.includes("our principles")) {
      startSection("principles", "Principles in Action");
    } else if (lower.includes("core expectations") || lower.includes("key rules") || lower.includes("core rules")) {
      startSection("rules", "Key Rules & Core Expectations");
    } else if (lower === "do:" || lower.includes("do list") || (lower.includes("do:") && !lower.includes("do not"))) {
      startSection("do", "DO");
    } else if (lower === "do not:" || lower.includes("do not") || lower.includes("dont") || lower.includes("don't")) {
      startSection("dont", "DO NOT");
    } else if (lower.includes("red flags") || lower.includes("redflags")) {
      startSection("redflags", "Red Flags");
    } else if (lower.includes("response model") || lower.includes("response steps") || lower.includes("step-by-step")) {
      startSection("responseModel", "Response Model");
    } else if (lower.includes("scenarios:") || lower.includes("scenario practice")) {
      startSection("scenarios", "Scenario Practice");
    } else if (lower.includes("environment safety checklist") || lower.includes("safety checklist")) {
      startSection("checklist", "Safety Checklist");
    } else if (lower.includes("competency rubric") || lower.includes("supervisor competency")) {
      startSection("rubric", "Supervisor Competency Rubric");
    } else if (lower.includes("required completion point") || lower.includes("evidence required") || lower.includes("completion point")) {
      startSection("completion", "Completion Requirements");
      current!.items.push(line);
    } else if (line.startsWith("-") || line.startsWith("•")) {
      if (!current) {
        current = { type: "generic", title: "", items: [] };
      }
      current.items.push(line.replace(/^[-•]\s*/, ""));
    } else if (line.includes(":") && !line.startsWith("-")) {
      if (!current || current.type === "generic") {
        startSection("generic", "");
      }
      current!.items.push(line);
    } else {
      if (!current) {
        current = { type: "generic", title: "", items: [] };
      }
      current.items.push(line);
    }
  }

  flushCurrent();
  return sections;
}

// ─── Visual Components ───────────────────────────────────────

function PrincipleCard({ text, color }: { text: string; color: string }) {
  const parts = text.split(":");
  const title = parts[0];
  const desc = parts.slice(1).join(":").trim();

  return (
    <div
      className="rounded-lg border p-4 flex items-start gap-3 transition-all hover:shadow-md"
      style={{ borderColor: color + "30", backgroundColor: color + "08" }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color + "18" }}
      >
        {createElement(getIconForText(text), { size: 20, style: { color } })}
      </div>
      <div>
        <p className="text-[13px] font-bold" style={{ color }}>{title}</p>
        {desc && <p className="text-[12px] mt-0.5" style={{ color: "#64748B" }}>{desc}</p>}
      </div>
    </div>
  );
}

function DoDontPanel({ doItems, dontItems }: { doItems: string[]; dontItems: string[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* DO Panel */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "#059669" }}>
        <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "#ECFDF5" }}>
          <CheckCircle size={16} style={{ color: "#059669" }} />
          <span className="text-[13px] font-bold" style={{ color: "#065F46" }}>DO</span>
        </div>
        <div className="p-4 space-y-2">
          {doItems.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle size={14} style={{ color: "#059669" }} className="flex-shrink-0 mt-0.5" />
              <span className="text-[12px]" style={{ color: "#374151" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* DO NOT Panel */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "#DC2626" }}>
        <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "#FEF2F2" }}>
          <XCircle size={16} style={{ color: "#DC2626" }} />
          <span className="text-[13px] font-bold" style={{ color: "#991B1B" }}>DO NOT</span>
        </div>
        <div className="p-4 space-y-2">
          {dontItems.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <XCircle size={14} style={{ color: "#DC2626" }} className="flex-shrink-0 mt-0.5" />
              <span className="text-[12px]" style={{ color: "#374151" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RedFlagsPanel({ items }: { items: string[] }) {
  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "#FED7AA" }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "#FEF3C7" }}>
        <AlertTriangle size={16} style={{ color: "#D97706" }} />
        <span className="text-[13px] font-bold" style={{ color: "#92400E" }}>RED FLAGS TO WATCH FOR</span>
      </div>
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded" style={{ backgroundColor: "#FFFBEB" }}>
            <AlertOctagon size={12} style={{ color: "#D97706" }} className="flex-shrink-0" />
            <span className="text-[11px] font-medium" style={{ color: "#78350F" }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResponseStepVisual({ items, color }: { items: string[]; color: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((item, i) => {
        const Icon = getIconForText(item);
        return (
          <div key={i} className="flex items-center gap-2">
            <div
              className="flex flex-col items-center px-4 py-3 rounded-lg border"
              style={{ borderColor: color + "30", backgroundColor: color + "08", minWidth: "100px" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center mb-1"
                style={{ backgroundColor: color + "18" }}
              >
                <Icon size={16} style={{ color }} />
              </div>
              <span className="text-[10px] font-bold text-center" style={{ color }}>
                {item.split(":")[0]}
              </span>
            </div>
            {i < items.length - 1 && (
              <ArrowRight size={14} style={{ color: "#CBD5E1" }} className="flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScenarioCard({ text, index }: { text: string; index: number }) {
  const parts = text.split(/BEST RESPONSE:|WHAT NOT TO DO:|WHY IT MATTERS:|BEST RESPONSE STEPS:/i);
  const situation = parts[0]?.replace(/^\d+\.\s*/, "").trim() || text;
  const bestResponse = parts.find((_, i) => text.toLowerCase().split(/best response:|best response steps:/i)[i]?.length > 0 && i > 0) || "";
  const whatNot = parts.find((_, i) => text.toLowerCase().split(/what not to do:/i)[i]?.length > 0 && i > 0) || "";
  const why = parts.find((_, i) => text.toLowerCase().split(/why it matters:/i)[i]?.length > 0 && i > 0) || "";

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: "#E2E8F0" }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "#245C5A08" }}>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold"
          style={{ backgroundColor: "#245C5A" }}
        >
          {index + 1}
        </div>
        <span className="text-[13px] font-bold" style={{ color: "#245C5A" }}>Scenario {index + 1}</span>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#64748B" }}>Situation</p>
          <p className="text-[13px]" style={{ color: "#374151" }}>{situation}</p>
        </div>
        {bestResponse && (
          <div className="rounded-lg p-3" style={{ backgroundColor: "#ECFDF5" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: "#059669" }}>
              <ThumbsUp size={11} /> Best Response
            </p>
            <p className="text-[12px]" style={{ color: "#065F46" }}>{bestResponse}</p>
          </div>
        )}
        {whatNot && (
          <div className="rounded-lg p-3" style={{ backgroundColor: "#FEF2F2" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: "#DC2626" }}>
              <ThumbsDown size={11} /> What Not To Do
            </p>
            <p className="text-[12px]" style={{ color: "#991B1B" }}>{whatNot}</p>
          </div>
        )}
        {why && (
          <div className="rounded-lg p-3" style={{ backgroundColor: "#EFF6FF" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#2563EB" }}>Why It Matters</p>
            <p className="text-[12px]" style={{ color: "#1E40AF" }}>{why}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LearningObjectiveCard({ items, color }: { items: string[]; color: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-start gap-3 p-3 rounded-lg border"
          style={{ borderColor: color + "20", backgroundColor: color + "06" }}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold"
            style={{ backgroundColor: color }}
          >
            {i + 1}
          </div>
          <span className="text-[12px]" style={{ color: "#374151" }}>{item}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Illustrated Content Viewer ─────────────────────────

interface Props {
  step: { content: string; contentType: string; title: string; durationMinutes: number };
  moduleId: string;
  onComplete: () => void;
  sectionNumber: number;
  totalSections: number;
}

export function IllustratedContentViewer({ step, moduleId, onComplete, sectionNumber }: Props) {
  const mod = getModuleById(moduleId);
  const catColor = CATEGORY_COLORS[mod?.category || "Compliance"];
  const color = catColor?.bg || "#245C5A";

  if (step.contentType === "quiz") {
    return (
      <IllustratedQuizSection
        step={step}
        moduleId={moduleId}
        color={color}
        sectionNumber={sectionNumber}
        onComplete={onComplete}
      />
    );
  }

  const sections = parseContent(step.content);
  const doItems = sections.find((s) => s.type === "do")?.items || [];
  const dontItems = sections.find((s) => s.type === "dont")?.items || [];

  return (
    <div className="space-y-6">
      {/* Section Title Banner */}
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[14px] font-bold"
          style={{ backgroundColor: color }}
        >
          {sectionNumber}
        </div>
        <div>
          <h3 className="text-[18px] font-bold" style={{ color: "var(--topbar-title)" }}>
            {step.title}
          </h3>
          <div className="flex items-center gap-2">
            <Clock size={12} style={{ color: "#94A3B8" }} />
            <span className="text-[11px]" style={{ color: "#94A3B8" }}>{step.durationMinutes} minutes</span>
          </div>
        </div>
      </div>

      {/* Render parsed sections */}
      {sections.map((section, idx) => {
        switch (section.type) {
          case "welcome":
            return (
              <div
                key={idx}
                className="rounded-lg border p-5"
                style={{ borderColor: color + "20", backgroundColor: color + "06" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} style={{ color }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>Welcome</span>
                </div>
                <p className="text-[14px] leading-relaxed" style={{ color: "#374151" }}>
                  {section.items[0]}
                </p>
              </div>
            );

          case "objectives":
            return (
              <div key={idx}>
                <div className="flex items-center gap-2 mb-3">
                  <Target size={16} style={{ color }} />
                  <span className="text-[13px] font-bold" style={{ color: "var(--topbar-title)" }}>Learning Objectives</span>
                </div>
                <LearningObjectiveCard items={section.items} color={color} />
              </div>
            );

          case "principles":
            return (
              <div key={idx}>
                <div className="flex items-center gap-2 mb-3">
                  <Star size={16} style={{ color }} />
                  <span className="text-[13px] font-bold" style={{ color: "var(--topbar-title)" }}>Principles in Action</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {section.items.map((item, i) => (
                    <PrincipleCard key={i} text={item} color={color} />
                  ))}
                </div>
              </div>
            );

          case "rules":
            return (
              <div key={idx}>
                <div className="flex items-center gap-2 mb-3">
                  <Shield size={16} style={{ color }} />
                  <span className="text-[13px] font-bold" style={{ color: "var(--topbar-title)" }}>{section.title}</span>
                </div>
                <div className="space-y-2">
                  {section.items.map((item, i) => {
                    const Icon = getIconForText(item);
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-lg border"
                        style={{ borderColor: color + "15", backgroundColor: color + "04" }}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[12px] font-bold"
                          style={{ backgroundColor: color }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex items-center gap-2 flex-1">
                          <Icon size={16} style={{ color }} className="flex-shrink-0" />
                          <span className="text-[13px]" style={{ color: "#374151" }}>{item}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );

          case "do":
            if (dontItems.length > 0) return null; // Rendered together below
            return (
              <div key={idx}>
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: "#059669" }}>
                  <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "#ECFDF5" }}>
                    <CheckCircle size={16} style={{ color: "#059669" }} />
                    <span className="text-[13px] font-bold" style={{ color: "#065F46" }}>DO</span>
                  </div>
                  <div className="p-4 space-y-2">
                    {section.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle size={14} style={{ color: "#059669" }} className="flex-shrink-0 mt-0.5" />
                        <span className="text-[12px]" style={{ color: "#374151" }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );

          case "dont":
            if (doItems.length > 0) return null; // Rendered together below
            return (
              <div key={idx}>
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: "#DC2626" }}>
                  <div className="px-4 py-3 flex items-center gap-2" style={{ backgroundColor: "#FEF2F2" }}>
                    <XCircle size={16} style={{ color: "#DC2626" }} />
                    <span className="text-[13px] font-bold" style={{ color: "#991B1B" }}>DO NOT</span>
                  </div>
                  <div className="p-4 space-y-2">
                    {section.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <XCircle size={14} style={{ color: "#DC2626" }} className="flex-shrink-0 mt-0.5" />
                        <span className="text-[12px]" style={{ color: "#374151" }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );

          case "redflags":
            return <RedFlagsPanel key={idx} items={section.items} />;

          case "responseModel":
            return (
              <div key={idx}>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={16} style={{ color }} />
                  <span className="text-[13px] font-bold" style={{ color: "var(--topbar-title)" }}>{section.title}</span>
                </div>
                <ResponseStepVisual items={section.items} color={color} />
              </div>
            );

          case "scenarios":
            return (
              <div key={idx}>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare size={16} style={{ color }} />
                  <span className="text-[13px] font-bold" style={{ color: "var(--topbar-title)" }}>Scenario Practice</span>
                </div>
                <div className="space-y-4">
                  {section.items.map((item, i) => (
                    <ScenarioCard key={i} text={item} index={i} />
                  ))}
                </div>
              </div>
            );

          case "checklist":
            return (
              <div key={idx} className="rounded-lg border p-4" style={{ borderColor: "#E2E8F0" }}>
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardCheck size={16} style={{ color }} />
                  <span className="text-[13px] font-bold" style={{ color: "var(--topbar-title)" }}>{section.title}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {section.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded" style={{ backgroundColor: "#F8FAFC" }}>
                      <div className="w-4 h-4 rounded border flex-shrink-0" style={{ borderColor: color }} />
                      <span className="text-[12px]" style={{ color: "#374151" }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            );

          case "rubric":
            return (
              <div key={idx} className="rounded-lg border p-4" style={{ borderColor: "#E2E8F0" }}>
                <div className="flex items-center gap-2 mb-3">
                  <FileCheck size={16} style={{ color }} />
                  <span className="text-[13px] font-bold" style={{ color: "var(--topbar-title)" }}>{section.title}</span>
                </div>
                <div className="space-y-2">
                  {section.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded" style={{ backgroundColor: "#F8FAFC" }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold" style={{ backgroundColor: color }}>
                        {i + 1}
                      </div>
                      <span className="text-[12px] flex-1" style={{ color: "#374151" }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            );

          case "completion":
            return (
              <div key={idx} className="rounded-lg border p-4" style={{ borderColor: color + "30", backgroundColor: color + "08" }}>
                <div className="flex items-center gap-2 mb-2">
                  <FileCheck size={16} style={{ color }} />
                  <span className="text-[13px] font-bold" style={{ color }}>Completion Requirements</span>
                </div>
                {section.items.map((item, i) => (
                  <p key={i} className="text-[12px]" style={{ color: "#374151" }}>{item}</p>
                ))}
              </div>
            );

          default:
            return (
              <div key={idx} className="space-y-2">
                {section.title && (
                  <h4 className="text-[13px] font-bold" style={{ color: "var(--topbar-title)" }}>{section.title}</h4>
                )}
                {section.items.map((item, i) => (
                  <p key={i} className="text-[13px] leading-relaxed" style={{ color: "#374151" }}>{item}</p>
                ))}
              </div>
            );
        }
      })}

      {/* Combined DO/DO NOT if both exist */}
      {doItems.length > 0 && dontItems.length > 0 && (
        <DoDontPanel doItems={doItems} dontItems={dontItems} />
      )}
    </div>
  );
}

// ─── Illustrated Quiz Section ────────────────────────────────

function IllustratedQuizSection({
  step,
  moduleId,
  color,
  sectionNumber,
  onComplete,
}: {
  step: { content: string; title: string };
  moduleId: string;
  color: string;
  sectionNumber: number;
  onComplete: () => void;
}) {
  const quizQuestions = getQuizForModule(moduleId);
  const mod = getModuleById(moduleId);

  return (
    <div className="space-y-6">
      {/* Section Title Banner */}
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[14px] font-bold"
          style={{ backgroundColor: color }}
        >
          {sectionNumber}
        </div>
        <div>
          <h3 className="text-[18px] font-bold" style={{ color: "var(--topbar-title)" }}>
            {step.title}
          </h3>
          <span className="text-[11px]" style={{ color: "#94A3B8" }}>Final Assessment</span>
        </div>
      </div>

      {/* Quiz Banner */}
      <div
        className="rounded-lg border p-5"
        style={{ borderColor: color + "20", backgroundColor: color + "06" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: color + "18" }}
          >
            <GraduationCap size={24} style={{ color }} />
          </div>
          <div>
            <p className="text-[14px] font-bold" style={{ color: "var(--topbar-title)" }}>
              Knowledge Check
            </p>
            <p className="text-[12px]" style={{ color: "#64748B" }}>
              {quizQuestions.length} questions &middot; 80% to pass &middot; Supervisor competency validation follows
            </p>
          </div>
        </div>
      </div>

      {!hasQuiz(moduleId) || quizQuestions.length === 0 ? (
        <div className="rounded-lg border p-4" style={{ borderColor: "#FEF3C7", backgroundColor: "#FFFBEB" }}>
          <p className="text-[13px] font-semibold" style={{ color: "#92400E" }}>Assessment questions being prepared.</p>
        </div>
      ) : (
        <QuizEngine
          questions={quizQuestions}
          moduleTitle={mod?.title || "Assessment"}
          passingScore={80}
          onComplete={(_score: number, _total: number, passed: boolean) => {
            if (passed) onComplete();
          }}
        />
      )}
    </div>
  );
}
