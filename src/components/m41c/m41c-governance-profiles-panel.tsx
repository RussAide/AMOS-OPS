import type {
  M41cClinicalGovernanceCouncil,
  M41cInstrumentProfile,
  M41cInstrumentProfileRegistry,
  M41cInstrumentProfileSeparationResult,
  M41cSignedValidationRecord,
} from "@contracts/m41c";
import {
  BadgeCheck,
  Ban,
  FileKey2,
  GitCompareArrows,
  LockKeyhole,
  Scale,
  ShieldCheck,
  Signature,
  UserRoundCheck,
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
import {
  activationPresentation,
  findInstrumentProfile,
  formatM41cTimestamp,
  prettyM41cToken,
  verifyProfileSeparation,
} from "./m41c-experience-model";

function Council({ council }: { council: M41cClinicalGovernanceCouncil }) {
  const votingMembers = council.members.filter(
    (member) => member.active && member.voting,
  );
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-700">
            Named human authority
          </p>
          <h3 className="mt-1 flex items-center gap-2 text-base font-bold text-slate-950">
            <UsersRound aria-hidden="true" className="size-4" />
            {council.name}
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Charter {council.charterVersion} · review due{" "}
            {formatM41cTimestamp(council.reviewDueAt)}
          </p>
        </div>
        <Badge
          className="border-rose-200 bg-rose-50 text-rose-800"
          variant="outline"
        >
          Production authority: none
        </Badge>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {council.members.map((member) => (
          <div
            className="rounded-lg border border-slate-200 bg-slate-50 p-3"
            key={member.memberId}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {member.displayName}
                </p>
                <p className="text-xs text-slate-600">
                  {prettyM41cToken(member.role)}
                </p>
              </div>
              <Badge
                className={
                  member.voting
                    ? "border-teal-200 bg-teal-50 text-teal-800"
                    : "border-slate-200 bg-white text-slate-600"
                }
                variant="outline"
              >
                {member.voting ? "Voting" : "Advisory"}
              </Badge>
            </div>
            <p className="mt-2 text-[11px] leading-4 text-slate-600">
              {member.authorizationScopes.map(prettyM41cToken).join(" · ")}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-teal-50 p-3 text-xs text-teal-950">
        <UserRoundCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>
          {votingMembers.length} active voting members; required roles:{" "}
          {council.requiredApprovalRoles.map(prettyM41cToken).join(" and ")}. A
          model cannot sign or activate a clinical artifact.
        </p>
      </div>
    </article>
  );
}

function Validations({
  records,
}: {
  records: readonly M41cSignedValidationRecord[];
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-950">
          <Signature aria-hidden="true" className="size-4" />
          Signed validation state
        </h3>
        <Badge
          className="border-slate-200 bg-slate-50 text-slate-700"
          variant="outline"
        >
          {records.length} record{records.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <div className="mt-3 space-y-3">
        {records.length ? (
          records.map((record) => {
            const passedChecks = record.checks.filter(
              (check) => check.passed,
            ).length;
            return (
              <div
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                key={record.validationId}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {prettyM41cToken(record.artifactKind)} ·{" "}
                      {record.artifactVersion}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {record.artifactId}
                    </p>
                  </div>
                  <Badge
                    className={
                      record.approvedForSyntheticDemo
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-amber-200 bg-amber-50 text-amber-900"
                    }
                    variant="outline"
                  >
                    {record.approvedForSyntheticDemo
                      ? "Synthetic demo signed"
                      : "Not approved"}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded bg-white p-2">
                    <p className="font-black text-slate-950">
                      {passedChecks}/{record.checks.length}
                    </p>
                    <p className="text-slate-500">Checks</p>
                  </div>
                  <div className="rounded bg-white p-2">
                    <p className="font-black text-slate-950">
                      {record.signatures.length}
                    </p>
                    <p className="text-slate-500">Signatures</p>
                  </div>
                  <div className="rounded bg-white p-2">
                    <p className="font-black text-rose-700">No</p>
                    <p className="text-slate-500">Production</p>
                  </div>
                </div>
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-bold text-slate-700">
                    Review attestations
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {record.signatures.map((signature) => (
                      <li
                        className="rounded border bg-white p-2"
                        key={signature.signatureId}
                      >
                        <span className="font-bold">
                          {prettyM41cToken(signature.signedByRole)}
                        </span>
                        <span className="text-slate-500">
                          {" "}
                          · {formatM41cTimestamp(signature.signedAt)}
                        </span>
                        <p className="mt-1 text-slate-700">
                          {signature.attestation}
                        </p>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            No signed synthetic validation record was returned. Affected
            artifacts remain unavailable for demo activation.
          </div>
        )}
      </div>
    </article>
  );
}

function ProfileCard({
  profile,
  accent,
}: {
  profile: M41cInstrumentProfile;
  accent: "teal" | "indigo";
}) {
  const activation = activationPresentation(profile.activationState);
  const border =
    accent === "teal" ? "border-t-teal-600" : "border-t-indigo-600";
  return (
    <article
      className={`rounded-xl border border-t-4 border-slate-200 bg-white p-4 ${border}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            {prettyM41cToken(profile.family)} · {profile.version}
          </p>
          <h3 className="mt-1 text-base font-bold text-slate-950">
            {profile.title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {profile.purpose}
          </p>
        </div>
        <Badge className={activation.className} variant="outline">
          {activation.label}
        </Badge>
      </div>

      <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="font-bold text-slate-500">Program authority</dt>
          <dd className="mt-1 text-slate-900">{profile.programAuthority}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="font-bold text-slate-500">Population boundary</dt>
          <dd className="mt-1 text-slate-900">
            Ages {profile.populationScope.minimumAge ?? "not set"}–
            {profile.populationScope.maximumAge ?? "not set"}
            <span className="block text-slate-600">
              {profile.populationScope.programs.join(" · ")}
            </span>
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="font-bold text-slate-500">Content binding</dt>
          <dd className="mt-1 text-slate-900">
            {profile.contentBinding.contentAvailable
              ? "Available"
              : "Metadata only"}{" "}
            · proprietary content stored: no
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="font-bold text-slate-500">Scoring boundary</dt>
          <dd className="mt-1 text-slate-900">
            {profile.scoringPolicy.summary}
          </dd>
        </div>
      </dl>

      <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
        <div>
          <p className="flex items-center gap-1.5 font-bold text-slate-700">
            <FileKey2 aria-hidden="true" className="size-3.5" />
            Qualification gates
          </p>
          <ul className="mt-1 space-y-1 text-slate-600">
            {profile.certificationRequirements.map((requirement) => (
              <li key={requirement.requirementId}>• {requirement.title}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="flex items-center gap-1.5 font-bold text-slate-700">
            <LockKeyhole aria-hidden="true" className="size-3.5" />
            External mappings
          </p>
          <ul className="mt-1 space-y-1 text-slate-600">
            {profile.externalMappings.map((mapping) => (
              <li key={mapping.mappingId}>
                • {mapping.targetSystem}:{" "}
                {mapping.validated ? "validated read" : "validation pending"};
                write unavailable
              </li>
            ))}
          </ul>
        </div>
      </div>

      {profile.missingEvidence.length ? (
        <details className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <summary className="cursor-pointer font-bold">
            Missing activation evidence ({profile.missingEvidence.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {profile.missingEvidence.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}

export function M41cGovernanceProfilesPanel({
  council,
  instrumentRegistry,
  profileSeparation,
  signedValidationRecords,
}: {
  council: M41cClinicalGovernanceCouncil;
  instrumentRegistry: M41cInstrumentProfileRegistry;
  profileSeparation: M41cInstrumentProfileSeparationResult;
  signedValidationRecords: readonly M41cSignedValidationRecord[];
}) {
  const trr = findInstrumentProfile(instrumentRegistry, "trr_cans");
  const dfps = findInstrumentProfile(instrumentRegistry, "dfps_cans_3_0");
  const derivedSeparation = verifyProfileSeparation(instrumentRegistry);
  const distinct = profileSeparation.distinct && derivedSeparation.distinct;

  return (
    <section aria-labelledby="m41c-governance-title" id="governance">
      <Card className="border-slate-200 bg-slate-50/70">
        <CardHeader className="border-b bg-white">
          <CardTitle
            className="flex items-center gap-2 text-lg"
            id="m41c-governance-title"
          >
            <Scale aria-hidden="true" className="size-5 text-teal-700" />
            Clinical governance &amp; instrument boundaries
          </CardTitle>
          <CardDescription className="mt-2 max-w-3xl leading-5">
            Named humans govern synthetic activation. TRR CANS and DFPS CANS 3.0
            remain separate program profiles; neither is reduced to a generic
            score or level-of-care shortcut.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 px-4 pb-5 pt-5 md:px-6">
          <div className="grid gap-4 xl:grid-cols-2">
            <Council council={council} />
            <Validations records={signedValidationRecords} />
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-slate-700">
                <GitCompareArrows aria-hidden="true" className="size-4" />
                Profile separation control
              </h3>
              <Badge
                className={
                  distinct
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-rose-200 bg-rose-50 text-rose-800"
                }
                variant="outline"
              >
                {distinct ? "Profiles distinct" : "Separation review required"}
              </Badge>
            </div>
            <div className="mt-3 grid gap-4 xl:grid-cols-2">
              {trr ? <ProfileCard accent="teal" profile={trr} /> : null}
              {dfps ? <ProfileCard accent="indigo" profile={dfps} /> : null}
              {!trr || !dfps ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 xl:col-span-2">
                  Both required profile records were not returned. No instrument
                  experience can be activated.
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ...new Set([
                  ...profileSeparation.differences,
                  ...derivedSeparation.reasons,
                ]),
              ].map((difference) => (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                  key={difference}
                >
                  <BadgeCheck
                    aria-hidden="true"
                    className="size-3 text-teal-700"
                  />
                  {difference}
                </span>
              ))}
            </div>
          </div>

          <div id="quarantine">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-slate-700">
              <Ban aria-hidden="true" className="size-4 text-rose-700" />
              Quarantine register
            </h3>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {instrumentRegistry.quarantines.length ? (
                instrumentRegistry.quarantines.map((record) => (
                  <article
                    className="rounded-xl border border-rose-200 bg-rose-50 p-4"
                    key={record.quarantineId}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-rose-950">
                          {record.profileId}
                        </h4>
                        <p className="mt-1 text-xs leading-5 text-rose-900">
                          {record.rationale}
                        </p>
                      </div>
                      <Badge
                        className="border-rose-300 bg-white text-rose-800"
                        variant="outline"
                      >
                        Clinical use blocked
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {record.reasonCodes.map((reason) => (
                        <span
                          className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-rose-800"
                          key={reason}
                        >
                          {prettyM41cToken(reason)}
                        </span>
                      ))}
                    </div>
                    <details className="mt-3 text-xs text-rose-950">
                      <summary className="cursor-pointer font-bold">
                        Release requirements
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {record.releaseRequirements.map((requirement) => (
                          <li key={requirement}>• {requirement}</li>
                        ))}
                      </ul>
                    </details>
                  </article>
                ))
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 lg:col-span-2">
                  <span className="inline-flex items-center gap-2 font-bold">
                    <ShieldCheck aria-hidden="true" className="size-4" />
                    No quarantined profile records returned
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
