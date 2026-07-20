import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../api/router";

const MED_STATUS: Record<string, string> = {
  administered: "bg-green-100 text-green-700",
  scheduled: "bg-blue-100 text-blue-700",
  refused: "bg-orange-100 text-orange-700",
  missed: "bg-red-100 text-red-700",
  held: "bg-yellow-100 text-yellow-700",
};

const ROUTE_LABELS: Record<string, string> = {
  oral: "PO",
  sublingual: "SL",
  im: "IM",
  iv: "IV",
  subcutaneous: "SC",
  topical: "TOP",
  inhalation: "INH",
  rectal: "PR",
};

type MedicationRecord =
  inferRouterOutputs<AppRouter>["m19"]["listMedications"][number];

interface ResidentialYouth {
  id: string;
  first_name: string;
  last_name: string;
}

export function MedicationAdminPage() {
  const [filter, setFilter] = useState<string>("all");
  const utils = trpc.useUtils();
  const { data: medSummary } = trpc.m19.medSummary.useQuery();
  const {
    data: medications = [],
    isLoading: medicationsLoading,
    error: medicationsError,
  } = trpc.m19.listMedications.useQuery();
  const { data: rawYouthList = [] } = trpc.m13.listYouth.useQuery();
  const youthList = rawYouthList as ResidentialYouth[];
  const adminMed = trpc.m19.administer.useMutation({
    onSuccess: () => {
      utils.m19.listMedications.invalidate();
      utils.m19.medSummary.invalidate();
    },
  });
  const refuseMed = trpc.m19.recordRefusal.useMutation({
    onSuccess: () => {
      utils.m19.listMedications.invalidate();
      utils.m19.medSummary.invalidate();
    },
  });
  const holdMed = trpc.m19.holdMedication.useMutation({
    onSuccess: () => {
      utils.m19.listMedications.invalidate();
      utils.m19.medSummary.invalidate();
    },
  });

  const filtered =
    filter === "all"
      ? medications
      : medications.filter((m) => m.status === filter);

  // Group by youth
  const byYouth: Record<string, MedicationRecord[]> = {};
  filtered.forEach((m) => {
    if (!byYouth[m.youth_id]) byYouth[m.youth_id] = [];
    byYouth[m.youth_id].push(m);
  });

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1a3a3a]">
              Medication Administration
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              MAR, med pass, PRN tracking, controlled substances
            </p>
          </div>
        </div>

        {medSummary && (
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { k: "all", label: "All", value: medications.length },
              {
                k: "scheduled",
                label: "Scheduled",
                value: medSummary.scheduled,
              },
              {
                k: "administered",
                label: "Administered",
                value: medSummary.administered,
              },
              { k: "refused", label: "Refused", value: medSummary.refused },
              { k: "missed", label: "Missed", value: medSummary.missed },
              { k: "prn", label: "PRN", value: medSummary.prnGiven },
            ].map((s) => (
              <Card
                key={s.k}
                className={`cursor-pointer ${filter === s.k ? "ring-2 ring-[#2e8b8b]" : ""}`}
                onClick={() => setFilter(s.k)}
              >
                <CardContent className="p-3 text-center">
                  <div className="text-xl font-bold text-[#1a3a3a]">
                    {s.value}
                  </div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* MAR by Youth */}
        {!medicationsLoading && medicationsError && (
          <Card className="border-red-200 bg-red-50/40">
            <CardContent className="p-5 text-sm text-red-700">
              Medication Administration data could not be loaded. No medication
              action is available until the governed data service recovers.
            </CardContent>
          </Card>
        )}
        {!medicationsLoading &&
          !medicationsError &&
          medications.length === 0 && (
            <Card className="border-slate-200 bg-slate-50/60">
              <CardContent className="p-5">
                <p className="font-semibold text-[#1a3a3a]">
                  No medication administration records are available.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Operational workspaces never receive injected demonstration
                  medication records. Use the governed Training workspace for
                  fictional practice data.
                </p>
              </CardContent>
            </Card>
          )}
        {Object.entries(byYouth).map(([youthId, meds]) => {
          const youth = youthList.find((y) => y.id === youthId);
          return (
            <Card key={youthId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  {youth ? `${youth.first_name} ${youth.last_name}` : youthId}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({meds[0]?.mrn})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {meds.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between p-2.5 rounded border ${m.is_controlled === 1 ? "border-red-200 bg-red-50/30" : m.is_prn === 1 ? "border-purple-200 bg-purple-50/30" : "border-gray-200"}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {m.medication_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {m.dosage} · {ROUTE_LABELS[m.route] ?? m.route} ·{" "}
                          {m.frequency}
                        </span>
                        <Badge
                          className={`${MED_STATUS[m.status] ?? "bg-gray-100"} text-xs`}
                        >
                          {m.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {m.indication} · {m.prescribing_provider}
                      </div>
                      {m.administered_by && (
                        <div className="text-xs text-[#2e8b8b]">
                          {m.administered_by} at {m.admin_time}
                        </div>
                      )}
                      {m.refusal_reason && (
                        <div className="text-xs text-orange-600">
                          {m.refusal_reason}
                        </div>
                      )}
                      {m.prn_reason && (
                        <div className="text-xs text-purple-600">
                          PRN: {m.prn_reason} → {m.prn_effectiveness}
                        </div>
                      )}
                      {m.is_controlled === 1 && (
                        <div className="text-xs text-red-600">
                          #{m.controlled_count_before}→
                          {m.controlled_count_after}{" "}
                          {m.waste_witnessed_by &&
                            `· Waste: ${m.waste_witnessed_by}`}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0 items-center">
                      {m.is_prn === 1 && (
                        <Badge className="bg-purple-100 text-purple-700 text-xs">
                          PRN
                        </Badge>
                      )}
                      {m.is_controlled === 1 && (
                        <Badge className="bg-red-100 text-red-700 text-xs">
                          C-II
                        </Badge>
                      )}
                      {m.status === "scheduled" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                            onClick={() =>
                              adminMed.mutate({
                                medicationId: m.id,
                                adminTime: new Date()
                                  .toTimeString()
                                  .slice(0, 5),
                                notes: "",
                              })
                            }
                          >
                            Administer
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                            onClick={() =>
                              refuseMed.mutate({
                                medicationId: m.id,
                                reason: "Youth refused",
                              })
                            }
                          >
                            Refuse
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                            onClick={() =>
                              holdMed.mutate({
                                medicationId: m.id,
                                reason: "Clinical hold",
                              })
                            }
                          >
                            Hold
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

export default MedicationAdminPage;
