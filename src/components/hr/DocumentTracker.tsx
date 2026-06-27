import { useState } from "react";
import { FileText, CheckCircle, XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, FileCheck } from "lucide-react";
import { useHR } from "@/context/HRContext";
import { getHRModule } from "@/data/hrLifecycleData";
import { formatFileSize } from "@/data/hrDocumentData";

interface Props {
  personId: string;
  moduleId?: string;
}

export function DocumentTracker({ personId, moduleId }: Props) {
  const { getDocumentsForPerson, getDocumentCompleteness } = useHR();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const personDocs = getDocumentsForPerson(personId);

  // Group by module
  const byModule = moduleId
    ? { [moduleId]: personDocs.filter((d) => d.moduleId === moduleId) }
    : personDocs.reduce<Record<string, typeof personDocs>>((acc, d) => {
        if (!acc[d.moduleId]) acc[d.moduleId] = [];
        acc[d.moduleId].push(d);
        return acc;
      }, {});

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="space-y-3">
      {Object.entries(byModule).map(([modId, docs]) => {
        const mod = getHRModule(modId);
        if (!mod) return null;
        const comp = getDocumentCompleteness(personId, modId);
        const isExpanded = expanded[modId] !== false;

        return (
          <div key={modId} className="rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            {/* Header */}
            <button
              onClick={() => toggle(modId)}
              className="w-full flex items-center justify-between p-3 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded flex items-center justify-center" style={{ backgroundColor: comp.percent === 100 ? "#ECFDF5" : "#FEF3C7" }}>
                  {comp.percent === 100 ? (
                    <FileCheck size={15} style={{ color: "#059669" }} />
                  ) : (
                    <FileText size={15} style={{ color: "#D97706" }} />
                  )}
                </div>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                    {mod.name}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                    {docs.length} document{docs.length !== 1 ? "s" : ""} &bull; {comp.percent}% complete
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Progress bar */}
                <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${comp.percent}%`,
                      backgroundColor: comp.percent === 100 ? "#059669" : "#D97706",
                    }}
                  />
                </div>
                {isExpanded ? <ChevronUp size={14} style={{ color: "#94A3B8" }} /> : <ChevronDown size={14} style={{ color: "#94A3B8" }} />}
              </div>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t px-3 pb-3" style={{ borderColor: "var(--card-border)" }}>
                {/* Required records list */}
                <div className="mt-2 space-y-1.5">
                  {mod.requiredRecords.map((rr) => {
                    const doc = docs.find((d) => d.recordName === rr);
                    return (
                      <div key={rr} className="flex items-center gap-2 py-1">
                        {doc ? (
                          <>
                            {doc.status === "verified" && <CheckCircle size={13} style={{ color: "#059669" }} className="flex-shrink-0" />}
                            {doc.status === "uploaded" && <Clock size={13} style={{ color: "#2563EB" }} className="flex-shrink-0" />}
                            {doc.status === "rejected" && <XCircle size={13} style={{ color: "#DC2626" }} className="flex-shrink-0" />}
                            {doc.status === "expired" && <AlertTriangle size={13} style={{ color: "#D97706" }} className="flex-shrink-0" />}
                            <span className="text-[12px] flex-1" style={{ color: "var(--topbar-title)" }}>{rr}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
                              backgroundColor: doc.status === "verified" ? "#D1FAE5" : doc.status === "expired" ? "#FEF3C7" : "#EFF6FF",
                              color: doc.status === "verified" ? "#059669" : doc.status === "expired" ? "#92400E" : "#2563EB",
                            }}>
                              {doc.status}
                            </span>
                            <span className="text-[10px]" style={{ color: "#94A3B8" }}>
                              {formatFileSize(doc.fileSize)}
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={13} style={{ color: "#DC2626" }} className="flex-shrink-0" />
                            <span className="text-[12px] flex-1" style={{ color: "#DC2626" }}>{rr}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}>
                              Missing
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
