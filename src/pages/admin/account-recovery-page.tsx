import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle,
  Lock,
  RefreshCw,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { trpc } from "@/providers/trpc";

function formatTimestamp(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Never";
}

export default function AccountRecoveryPage() {
  const trpcUtils = trpc.useUtils();
  const usersQuery = trpc.auth.listUsers.useQuery(undefined, {
    retry: false,
  });
  const [error, setError] = useState("");
  const [recoveryLink, setRecoveryLink] = useState<{
    email: string;
    url: string;
    expiresAt: string;
  } | null>(null);
  const issueRecovery = trpc.auth.issueAccountRecovery.useMutation({
    onSuccess: async () => trpcUtils.auth.listUsers.invalidate(),
  });
  const unlockAccount = trpc.auth.unlockAccount.useMutation({
    onSuccess: async () => trpcUtils.auth.listUsers.invalidate(),
  });

  const copyRecoveryLink = async (url: string) => {
    if (!navigator.clipboard) {
      setError(
        "The recovery link is ready below. Select it manually because this browser does not provide clipboard access.",
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setError("");
    } catch {
      setError(
        "The recovery link is ready below. Select it manually because the browser blocked clipboard access.",
      );
    }
  };

  const handleRecovery = async (user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  }) => {
    if (
      !window.confirm(
        `Recover access for ${user.email}? Active sessions and older recovery links will be revoked, and the password and authenticator must both be enrolled again.`,
      )
    ) {
      return;
    }
    const rationale = window
      .prompt("Reason for this account recovery:")
      ?.trim();
    if (!rationale || rationale.length < 5) return;
    setError("");
    try {
      const result = await issueRecovery.mutateAsync({
        userId: user.id,
        rationale,
      });
      const url = `${window.location.origin}/login?invite=${encodeURIComponent(result.recoveryToken)}`;
      setRecoveryLink({
        email: result.email,
        url,
        expiresAt: result.expiresAt,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Account recovery could not be issued.",
      );
    }
  };

  const handleUnlock = async (user: { id: string; email: string }) => {
    const rationale = window
      .prompt(`Reason for unlocking ${user.email}:`)
      ?.trim();
    if (!rationale || rationale.length < 5) return;
    setError("");
    try {
      await unlockAccount.mutateAsync({ userId: user.id, rationale });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The account could not be unlocked.",
      );
    }
  };

  const users = usersQuery.data ?? [];
  const lockedUsers = users.filter(
    (user) => user.lockedUntil || user.failedLoginCount > 0,
  ).length;
  const recoveryUsers = users.filter(
    (user) => user.mustChangePassword || user.pendingRecoveryExpiresAt,
  ).length;

  return (
    <div className="px-4 pb-8 pt-4 md:px-6">
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#245C5A]">
            <ShieldCheck size={20} color="white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-[var(--topbar-title)]">
              Account Recovery
            </h1>
            <p className="text-[12px] text-[var(--topbar-subtitle)]">
              Permanent password, lockout, session, and authenticator recovery
            </p>
          </div>
        </div>
        <Link
          to="/admin/settings"
          className="w-fit rounded-md border px-3 py-2 text-[11px] font-semibold text-[#245C5A]"
          style={{ borderColor: "var(--card-border)" }}
        >
          Back to System Settings
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { label: "Team accounts", value: users.length, icon: Users },
          { label: "Locked or failed", value: lockedUsers, icon: Lock },
          {
            label: "Recovery in progress",
            value: recoveryUsers,
            icon: RefreshCw,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-lg border bg-[var(--card-bg)] p-4"
            style={{ borderColor: "var(--card-border)" }}
          >
            <div className="flex items-center gap-2 text-[var(--topbar-subtitle)]">
              <Icon size={14} />
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                {label}
              </span>
            </div>
            <p className="mt-1 text-[24px] font-bold text-[#245C5A]">{value}</p>
          </div>
        ))}
      </div>

      <div
        className="mb-4 rounded-lg border p-4 text-[11px]"
        style={{ borderColor: "#99F6E4", backgroundColor: "#F0FDFA" }}
      >
        <p className="font-semibold text-[#115E59]">Secure recovery policy</p>
        <p className="mt-1 text-[#0F766E]">
          Recovery links are stored only as keyed hashes, expire after one hour,
          and are shown once. Issuing a link unlocks the account, revokes active
          sessions and older links, requires a new password, and rotates the
          user&apos;s authenticator enrollment. Every action is audited.
        </p>
      </div>

      {recoveryLink && (
        <div
          className="mb-4 rounded-lg border p-4"
          style={{ borderColor: "#0F766E", backgroundColor: "#F0FDFA" }}
        >
          <p className="text-[12px] font-semibold text-[#115E59]">
            One-time recovery link for {recoveryLink.email}
          </p>
          <p className="mb-2 text-[10px] text-[#0F766E]">
            Expires {formatTimestamp(recoveryLink.expiresAt)}. Share only with
            the intended team member.
          </p>
          <div className="flex flex-col gap-2 lg:flex-row">
            <input
              readOnly
              value={recoveryLink.url}
              aria-label="One-time account recovery link"
              className="min-w-0 flex-1 rounded border border-[#99F6E4] bg-white px-3 py-2 text-[11px] text-slate-700"
              onFocus={(event) => event.currentTarget.select()}
            />
            <button
              type="button"
              onClick={() => void copyRecoveryLink(recoveryLink.url)}
              className="rounded bg-[#0F766E] px-3 py-2 text-[11px] font-semibold text-white"
            >
              Copy link
            </button>
            <button
              type="button"
              onClick={() => setRecoveryLink(null)}
              className="rounded border border-[#99F6E4] bg-white px-3 py-2 text-[11px] font-semibold text-[#0F766E]"
            >
              Hide
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-[11px] text-red-700">
          {error}
        </div>
      )}

      <div
        className="overflow-hidden rounded-lg border bg-[var(--card-bg)]"
        style={{ borderColor: "var(--card-border)" }}
      >
        <div
          className="border-b p-4"
          style={{ borderColor: "var(--card-border)" }}
        >
          <h2 className="text-[15px] font-semibold text-[var(--topbar-title)]">
            Team authentication directory
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-black/[0.02] text-[var(--topbar-subtitle)]">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Team member</th>
                <th className="px-3 py-2.5 font-semibold">Role</th>
                <th className="px-3 py-2.5 font-semibold">Authentication</th>
                <th className="px-3 py-2.5 font-semibold">Last login</th>
                <th className="px-3 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const accessAvailable =
                  user.isActive &&
                  user.accessStatus !== "suspended" &&
                  user.accessStatus !== "deactivated";
                return (
                  <tr
                    key={user.id}
                    className="border-t"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    <td className="px-3 py-3">
                      <p className="font-semibold text-[var(--topbar-title)]">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-[10px] text-[var(--topbar-subtitle)]">
                        {user.email}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-[var(--topbar-subtitle)]">
                      {user.role}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-[150px] flex-col items-start gap-1">
                        <span
                          className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
                            accessAvailable
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {accessAvailable ? (
                            <CheckCircle size={10} />
                          ) : (
                            <XCircle size={10} />
                          )}
                          {accessAvailable ? "Active" : "Unavailable"}
                        </span>
                        {user.lockedUntil && (
                          <span className="text-[10px] font-semibold text-amber-700">
                            Locked until {formatTimestamp(user.lockedUntil)}
                          </span>
                        )}
                        {user.mustChangePassword && (
                          <span className="text-[10px] font-semibold text-blue-700">
                            Password recovery required
                          </span>
                        )}
                        {user.pendingRecoveryExpiresAt && (
                          <span className="text-[10px] text-slate-500">
                            Link expires{" "}
                            {formatTimestamp(user.pendingRecoveryExpiresAt)}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">
                          MFA:{" "}
                          {user.mfaMethod === "totp"
                            ? "Authenticator"
                            : "Not enrolled"}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[var(--topbar-subtitle)]">
                      {formatTimestamp(user.lastLoginAt)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-[170px] flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleRecovery(user)}
                          disabled={!accessAvailable || issueRecovery.isPending}
                          className="rounded bg-[#E0F2FE] px-2.5 py-1.5 font-semibold text-[#0369A1] disabled:opacity-50"
                        >
                          Recover access
                        </button>
                        {(user.failedLoginCount > 0 || user.lockedUntil) && (
                          <button
                            type="button"
                            onClick={() => void handleUnlock(user)}
                            disabled={
                              !accessAvailable || unlockAccount.isPending
                            }
                            className="rounded bg-amber-50 px-2.5 py-1.5 font-semibold text-amber-700 disabled:opacity-50"
                          >
                            Unlock only
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!usersQuery.isLoading && users.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-[var(--topbar-subtitle)]"
                  >
                    {usersQuery.isError
                      ? "An authorized Operational administrator session is required."
                      : "No team accounts are available."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
