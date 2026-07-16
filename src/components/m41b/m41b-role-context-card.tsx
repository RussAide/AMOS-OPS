import type { M41bRoleContext } from "@contracts/m41b";
import {
  Building2,
  ContactRound,
  Route,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prettyToken } from "./m41b-experience-model";

function TokenList({
  values,
  emptyLabel,
}: {
  values: readonly string[];
  emptyLabel: string;
}) {
  if (values.length === 0) {
    return <p className="text-xs text-slate-500">{emptyLabel}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <Badge
          className="max-w-full border-slate-200 bg-white text-[10px] text-slate-700"
          key={value}
          variant="outline"
        >
          <span className="truncate">{prettyToken(value)}</span>
        </Badge>
      ))}
    </div>
  );
}

export function M41bRoleContextCard({ context }: { context: M41bRoleContext }) {
  return (
    <Card className="gap-4 border-sky-200 bg-gradient-to-br from-white to-sky-50/60 py-5">
      <CardHeader className="px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ContactRound
                aria-hidden="true"
                className="size-4 text-sky-700"
              />
              Server-authorized role context
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Priorities and assistant retrieval are constrained to this
              governed context.
            </CardDescription>
          </div>
          <Badge
            className="border-sky-200 bg-sky-100 text-sky-900"
            variant="outline"
          >
            {context.tier} · {prettyToken(context.role)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <dt className="flex items-center gap-1.5 font-semibold text-slate-500">
              <Building2 aria-hidden="true" className="size-3.5" />
              Division
            </dt>
            <dd className="mt-1 font-bold text-slate-900">
              {prettyToken(context.division)}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <dt className="font-semibold text-slate-500">Department</dt>
            <dd className="mt-1 font-bold text-slate-900">
              {context.department}
            </dd>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2">
            <dt className="font-semibold text-slate-500">Synthetic actor ID</dt>
            <dd className="mt-1 break-all font-mono text-[11px] font-semibold text-slate-800">
              {context.userId}
            </dd>
          </div>
        </dl>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <UsersRound
                aria-hidden="true"
                className="size-3.5 text-sky-700"
              />
              Authorized caseload scope
            </h3>
            <TokenList
              emptyLabel="No governed caseload scope returned for this role."
              values={context.caseloadIds}
            />
          </section>
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <ShieldCheck
                aria-hidden="true"
                className="size-3.5 text-sky-700"
              />
              Delegated actions
            </h3>
            <TokenList
              emptyLabel="No delegated actions returned."
              values={context.delegatedActions}
            />
          </section>
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Route aria-hidden="true" className="size-3.5 text-sky-700" />
              Supervisor routing
            </h3>
            <TokenList
              emptyLabel="No supervisor route returned; escalation cannot be inferred."
              values={context.supervisorRoles}
            />
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
