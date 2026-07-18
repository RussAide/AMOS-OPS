import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { runtimeConfig } from "@/config/runtime";
import {
  Shield,
  LogIn,
  UserPlus,
  AlertCircle,
  ChevronRight,
  ClipboardList,
  Users,
  Route,
  ShieldCheck,
  UserCheck,
  DollarSign,
  Lock,
  Activity,
  KeyRound,
  MailCheck,
} from "lucide-react";
import type { MfaPrompt, TotpSetup } from "@/hooks/use-auth";
import { captureTrainingInvitationToken } from "@/security/training-invitation-token";

/* ─── Floating Particles Canvas ─────────────────────────── */
function ParticleBackground() {
  useEffect(() => {
    const canvas = document.getElementById(
      "particle-canvas",
    ) as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const particles: {
      x: number;
      y: number;
      r: number;
      dx: number;
      dy: number;
      o: number;
    }[] = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.5 + 0.3,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        o: Math.random() * 0.4 + 0.1,
      });
    }

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > w) p.dx *= -1;
        if (p.y < 0 || p.y > h) p.dy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(90, 168, 165, ${p.o})`;
        ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(90, 168, 165, ${0.06 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      id="particle-canvas"
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    />
  );
}

const FEATURE_CARDS = [
  {
    icon: ClipboardList,
    title: "EHR / MIS",
    description: "Clinical records & care plans",
    color: "#245C5A",
  },
  {
    icon: Users,
    title: "Workforce",
    description: "Staff & personnel management",
    color: "#2563EB",
  },
  {
    icon: Route,
    title: "Care Coordination",
    description: "MDT, crisis & BHC-GRO routing",
    color: "#059669",
  },
  {
    icon: ShieldCheck,
    title: "QA & Compliance",
    description: "Audits, CAPs & compliance score",
    color: "#7C3AED",
  },
  {
    icon: UserCheck,
    title: "Admissions",
    description: "Referrals & intake workflow",
    color: "#D97706",
  },
  {
    icon: DollarSign,
    title: "Revenue",
    description: "Billing, payers & authorizations",
    color: "#0891B2",
  },
];

const DEPT_PILLS = ["Executive", "Corporate", "GAD", "BHC", "GRO"];

let pendingInvitationToken: string | null = null;

function captureInvitationToken(): string | null {
  const token = captureTrainingInvitationToken(window.location, (pathname) =>
    window.history.replaceState({}, "", pathname),
  );
  if (token) {
    // Keep the secret only in this page's JavaScript memory. The module-level
    // handoff also survives React StrictMode's development remount.
    pendingInvitationToken = token;
  }
  return pendingInvitationToken;
}

export function LoginPage() {
  const [invitationToken] = useState(captureInvitationToken);
  useEffect(() => {
    // The state initializer now owns the token. Clear the StrictMode handoff so
    // a later login-page remount cannot reopen a consumed or abandoned invite.
    pendingInvitationToken = null;
  }, []);
  const {
    login,
    completeMfa,
    register,
    enterEvaluation,
    requestPasswordReset,
    resetPassword,
    isAuthenticated,
  } = useAuth();
  const [showForm, setShowForm] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [authStep, setAuthStep] = useState<
    "credentials" | "mfa" | "recovery-request" | "recovery-reset" | "totp-setup"
  >(invitationToken ? "recovery-reset" : "credentials");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    invitationToken ? "Create your password to activate your account." : "",
  );
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    department: "",
  });
  const [mfaPrompt, setMfaPrompt] = useState<MfaPrompt | null>(null);
  const [totpSetup, setTotpSetup] = useState<TotpSetup | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [recoveryToken, setRecoveryToken] = useState(invitationToken ?? "");
  const [newPassword, setNewPassword] = useState("");

  if (isAuthenticated) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const prompt = await login(form.email, form.password);
      if (prompt) {
        setMfaPrompt(prompt);
        setMfaCode(prompt.evaluationCode ?? "");
        setAuthStep("mfa");
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "";
      setError(
        msg.includes("Unexpected token") || msg.includes("DOCTYPE")
          ? "API server not available."
          : msg || "Login failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const prompt = await register({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        department: form.department || undefined,
      });
      if (prompt) {
        setMfaPrompt(prompt);
        setMfaCode(prompt.evaluationCode ?? "");
        setAuthStep("mfa");
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluationEntry = async () => {
    setError("");
    setLoading(true);
    try {
      await enterEvaluation();
    } catch (error: unknown) {
      setError(
        error instanceof Error
          ? error.message
          : "Synthetic evaluation access is unavailable.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaPrompt) return;
    setError("");
    setLoading(true);
    try {
      await completeMfa(mfaPrompt.challengeId, mfaCode);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const result = await requestPasswordReset(form.email);
      setNotice(
        "If the account exists, recovery instructions have been prepared.",
      );
      if (result.evaluationToken) {
        setRecoveryToken(result.evaluationToken);
        setAuthStep("recovery-reset");
      }
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Recovery request failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const setup = await resetPassword(recoveryToken, newPassword);
      pendingInvitationToken = null;
      if (setup) {
        setTotpSetup(setup);
        setForm((current) => ({
          ...current,
          email: setup.accountName,
          password: "",
        }));
        setNotice(
          "Password updated. Add AMOS-OPS to your authenticator before signing in.",
        );
        setRecoveryToken("");
        setNewPassword("");
        setAuthStep("totp-setup");
        return;
      }
      setNotice("Password updated. Sign in with your new password.");
      setForm((current) => ({ ...current, password: "" }));
      setRecoveryToken("");
      setNewPassword("");
      setAuthStep("credentials");
      setMode("login");
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : "Password reset failed",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, #0a1628 0%, #0d1f35 50%, #0a1628 100%)",
      }}
    >
      <ParticleBackground />

      {/* ─── Top Bar ───────────────────────────────────── */}
      <div
        className="relative flex items-center justify-end px-6 py-3"
        style={{ zIndex: 10 }}
      >
        <div
          className="flex items-center gap-1.5 text-[11px]"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          {runtimeConfig.evaluationMode ? (
            <Activity size={10} />
          ) : (
            <Lock size={10} />
          )}
          {runtimeConfig.evaluationMode
            ? `DEMO - NOT FOR CARE DELIVERY · AMOS-OPS-PHASE3-EVALUATION · ${runtimeConfig.environmentId} · Fictional Data`
            : runtimeConfig.productionReleaseAuthorized
              ? `PRODUCTION · ${runtimeConfig.environmentId} · Secure Access`
              : `CONTROLLED PATH · ${runtimeConfig.environmentId} · Live Operations Locked`}
        </div>
      </div>

      {/* ─── Main Content ──────────────────────────────── */}
      <div
        className="relative flex flex-col items-center justify-center px-4 py-6"
        style={{ zIndex: 10, minHeight: "calc(100vh - 48px)" }}
      >
        {!showForm ? (
          /* ═══════════ LANDING VIEW ═══════════ */
          <div className="w-full max-w-2xl mx-auto text-center">
            {/* AMOS-OPS Logo */}
            <div className="mb-2">
              <img
                src="/assets/AMOS-OPS_Logo_Vertical_Dark.png"
                alt="AMOS-OPS"
                className="w-[260px] mx-auto"
                draggable={false}
              />
            </div>

            {/* Tagline */}
            <p
              className="text-[13px] font-semibold tracking-[0.25em] uppercase mb-0.5"
              style={{ color: "#5BA8A5" }}
            >
              Digital Operations System
            </p>
            <p
              className="text-[12px] mb-8"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Adolbi Care &middot; Enterprise Healthcare Platform
            </p>

            {/* Feature Cards */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {FEATURE_CARDS.map((card) => (
                <div
                  key={card.title}
                  className="rounded-xl p-3 text-left transition-all hover:scale-[1.02]"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <card.icon
                    size={16}
                    style={{ color: card.color }}
                    className="mb-2"
                  />
                  <div className="text-[11px] font-semibold text-white mb-0.5">
                    {card.title}
                  </div>
                  <div
                    className="text-[9px] leading-relaxed"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    {card.description}
                  </div>
                </div>
              ))}
            </div>

            {/* Access Button */}
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-[14px] font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] mb-3"
              style={{
                background: "linear-gradient(135deg, #245C5A 0%, #1a8a85 100%)",
                boxShadow:
                  "0 4px 24px rgba(36,92,90,0.4), 0 0 60px rgba(36,92,90,0.15)",
              }}
            >
              <Shield size={16} />
              Access AMOS-OPS
              <ChevronRight size={16} />
            </button>

            <p
              className="text-[10px] mb-8"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              Authorized personnel only &middot; All access is logged
            </p>

            {/* Department Pills */}
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {DEPT_PILLS.map((dept) => (
                <span
                  key={dept}
                  className="px-3 py-1 rounded-full text-[10px] font-medium"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  {dept}
                </span>
              ))}
            </div>
          </div>
        ) : (
          /* ═══════════ LOGIN FORM VIEW ═══════════ */
          <div className="w-full max-w-md mx-auto">
            {/* Back to landing */}
            <button
              onClick={() => {
                setShowForm(false);
                setError("");
              }}
              className="text-[11px] mb-3 flex items-center gap-1 transition-colors hover:opacity-80"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              <ChevronRight size={12} className="rotate-180" /> Back to overview
            </button>

            {/* Logo */}
            <div className="text-center mb-4">
              <img
                src="/assets/AMOS-OPS_Logo_Vertical_Dark.png"
                alt="AMOS-OPS"
                className="w-[100px] mx-auto mb-2"
                draggable={false}
              />
              <h2 className="text-[18px] font-bold text-white">
                Sign In to AMOS-OPS
              </h2>
              <p
                className="text-[11px]"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                Enter your credentials to continue
              </p>
            </div>

            {/* Card */}
            <div
              className="rounded-xl p-5"
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(20px)",
              }}
            >
              {authStep === "credentials" && (
                <div
                  className="flex mb-4 rounded-lg overflow-hidden"
                  style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                >
                  <button
                    onClick={() => {
                      setMode("login");
                      setError("");
                      setNotice("");
                    }}
                    className="flex-1 py-2 text-[12px] font-medium transition-all"
                    style={{
                      backgroundColor:
                        mode === "login" ? "#245C5A" : "transparent",
                      color:
                        mode === "login" ? "#fff" : "rgba(255,255,255,0.4)",
                    }}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      setMode("register");
                      setError("");
                      setNotice("");
                    }}
                    className="flex-1 py-2 text-[12px] font-medium transition-all"
                    style={{
                      backgroundColor:
                        mode === "register" ? "#245C5A" : "transparent",
                      color:
                        mode === "register" ? "#fff" : "rgba(255,255,255,0.4)",
                    }}
                  >
                    Register
                  </button>
                </div>
              )}

              {error && (
                <div
                  className="flex items-center gap-2 p-2.5 rounded-lg mb-3 text-[11px]"
                  style={{
                    backgroundColor: "rgba(220,38,38,0.12)",
                    color: "#FCA5A5",
                    border: "1px solid rgba(220,38,38,0.2)",
                  }}
                >
                  <AlertCircle size={13} /> {error}
                </div>
              )}

              {notice && (
                <div
                  className="flex items-center gap-2 p-2.5 rounded-lg mb-3 text-[11px]"
                  style={{
                    backgroundColor: "rgba(16,185,129,0.12)",
                    color: "#A7F3D0",
                    border: "1px solid rgba(16,185,129,0.2)",
                  }}
                >
                  <MailCheck size={13} /> {notice}
                </div>
              )}

              {runtimeConfig.evaluationMode && authStep === "credentials" && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={handleEvaluationEntry}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-[13px] font-bold text-white transition-all disabled:opacity-50"
                    style={{
                      background:
                        "linear-gradient(135deg, #245C5A 0%, #1a8a85 100%)",
                      border: "1px solid rgba(125,211,207,0.3)",
                    }}
                  >
                    <ShieldCheck size={15} />
                    {loading
                      ? "Opening evaluation workspace..."
                      : "Enter synthetic evaluation workspace"}
                  </button>
                  <p
                    className="text-[10px] text-center leading-relaxed mt-2"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Opens an authorized administrator persona with fictional
                    data only. No credentials or real records are required.
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-[9px] uppercase tracking-widest text-white/30">
                      or use an account
                    </span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                </div>
              )}

              {authStep === "credentials" && (
                <form
                  onSubmit={mode === "login" ? handleLogin : handleRegister}
                  className="space-y-2.5"
                >
                  <div>
                    <label
                      className="text-[10px] font-medium mb-1 block"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      className="w-full rounded-lg px-3 py-2.5 text-[12px] outline-none transition-colors"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "#fff",
                      }}
                      placeholder="evaluator@amos-ops.invalid"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label
                      className="text-[10px] font-medium mb-1 block"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={12}
                      className="w-full rounded-lg px-3 py-2.5 text-[12px] outline-none transition-colors"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "#fff",
                      }}
                      placeholder="12+ characters"
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                    />
                  </div>

                  {mode === "register" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label
                            className="text-[10px] font-medium mb-1 block"
                            style={{ color: "rgba(255,255,255,0.4)" }}
                          >
                            First Name
                          </label>
                          <input
                            type="text"
                            required
                            className="w-full rounded-lg px-3 py-2.5 text-[12px] outline-none"
                            style={{
                              backgroundColor: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              color: "#fff",
                            }}
                            value={form.firstName}
                            onChange={(e) =>
                              setForm({ ...form, firstName: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label
                            className="text-[10px] font-medium mb-1 block"
                            style={{ color: "rgba(255,255,255,0.4)" }}
                          >
                            Last Name
                          </label>
                          <input
                            type="text"
                            required
                            className="w-full rounded-lg px-3 py-2.5 text-[12px] outline-none"
                            style={{
                              backgroundColor: "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              color: "#fff",
                            }}
                            value={form.lastName}
                            onChange={(e) =>
                              setForm({ ...form, lastName: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <p
                        className="text-[10px] leading-relaxed"
                        style={{ color: "rgba(255,255,255,0.35)" }}
                      >
                        Use fictional information only. New accounts receive
                        standard evaluation access.
                      </p>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-bold text-white transition-all disabled:opacity-50 mt-2"
                    style={{
                      background:
                        "linear-gradient(135deg, #245C5A 0%, #1a8a85 100%)",
                    }}
                  >
                    {mode === "login" ? (
                      <LogIn size={15} />
                    ) : (
                      <UserPlus size={15} />
                    )}
                    {loading
                      ? "Please wait..."
                      : mode === "login"
                        ? "Sign In"
                        : "Create Account"}
                  </button>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthStep("recovery-request");
                        setError("");
                        setNotice("");
                      }}
                      className="w-full text-[11px] py-1"
                      style={{ color: "#7DD3CF" }}
                    >
                      Forgot password or account locked?
                    </button>
                  )}
                </form>
              )}

              {authStep === "mfa" && mfaPrompt && (
                <form onSubmit={handleMfa} className="space-y-3">
                  <div className="text-center">
                    <KeyRound
                      size={24}
                      className="mx-auto mb-2"
                      style={{ color: "#5BA8A5" }}
                    />
                    <h3 className="text-[14px] font-semibold text-white">
                      Verification required
                    </h3>
                    <p
                      className="text-[10px] mt-1"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      {mfaPrompt.deliveryMethod === "totp"
                        ? "Enter the current six-digit code from your authenticator app."
                        : `Enter the six-digit code prepared for ${mfaPrompt.destination}.`}
                    </p>
                  </div>
                  {mfaPrompt.evaluationCode && (
                    <div
                      className="rounded-lg p-3 text-center"
                      style={{
                        backgroundColor: "rgba(91,168,165,0.12)",
                        border: "1px solid rgba(91,168,165,0.25)",
                      }}
                    >
                      <div
                        className="text-[9px] uppercase tracking-widest"
                        style={{ color: "rgba(255,255,255,0.45)" }}
                      >
                        Synthetic demo code
                      </div>
                      <div
                        className="text-xl tracking-[0.35em] font-bold mt-1"
                        style={{ color: "#A7F3D0" }}
                      >
                        {mfaPrompt.evaluationCode}
                      </div>
                    </div>
                  )}
                  <input
                    aria-label="Verification code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    className="w-full rounded-lg px-3 py-3 text-center text-[18px] tracking-[0.3em] outline-none"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#fff",
                    }}
                    value={mfaCode}
                    onChange={(e) =>
                      setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                  />
                  <button
                    type="submit"
                    disabled={loading || mfaCode.length !== 6}
                    className="w-full py-2.5 rounded-lg text-[13px] font-bold text-white disabled:opacity-50"
                    style={{ backgroundColor: "#245C5A" }}
                  >
                    {loading ? "Verifying..." : "Verify and continue"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep("credentials");
                      setMfaPrompt(null);
                      setMfaCode("");
                      setError("");
                    }}
                    className="w-full text-[11px]"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Use a different account
                  </button>
                </form>
              )}

              {authStep === "recovery-request" && (
                <form onSubmit={handleRecoveryRequest} className="space-y-3">
                  <div className="text-center">
                    <MailCheck
                      size={24}
                      className="mx-auto mb-2"
                      style={{ color: "#5BA8A5" }}
                    />
                    <h3 className="text-[14px] font-semibold text-white">
                      Account recovery
                    </h3>
                    <p
                      className="text-[10px] mt-1"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      Enter the account email. The response does not reveal
                      whether an account exists.
                    </p>
                  </div>
                  <input
                    type="email"
                    required
                    className="w-full rounded-lg px-3 py-2.5 text-[12px] outline-none"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#fff",
                    }}
                    placeholder="evaluator@amos-ops.invalid"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-lg text-[13px] font-bold text-white disabled:opacity-50"
                    style={{ backgroundColor: "#245C5A" }}
                  >
                    {loading ? "Preparing..." : "Prepare recovery"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep("credentials");
                      setError("");
                      setNotice("");
                    }}
                    className="w-full text-[11px]"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Back to sign in
                  </button>
                </form>
              )}

              {authStep === "recovery-reset" && (
                <form onSubmit={handlePasswordReset} className="space-y-3">
                  <div className="text-center">
                    <KeyRound
                      size={24}
                      className="mx-auto mb-2"
                      style={{ color: "#5BA8A5" }}
                    />
                    <h3 className="text-[14px] font-semibold text-white">
                      Set a new password
                    </h3>
                    <p
                      className="text-[10px] mt-1"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      Completing recovery revokes every existing session.
                    </p>
                  </div>
                  {!runtimeConfig.evaluationMode && (
                    <input
                      type="text"
                      required
                      className="w-full rounded-lg px-3 py-2.5 text-[11px] outline-none"
                      style={{
                        backgroundColor: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "#fff",
                      }}
                      placeholder="Recovery token"
                      value={recoveryToken}
                      onChange={(e) => setRecoveryToken(e.target.value)}
                    />
                  )}
                  <input
                    type="password"
                    required
                    minLength={12}
                    className="w-full rounded-lg px-3 py-2.5 text-[12px] outline-none"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#fff",
                    }}
                    placeholder="New 12+ character password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={loading || !recoveryToken}
                    className="w-full py-2.5 rounded-lg text-[13px] font-bold text-white disabled:opacity-50"
                    style={{ backgroundColor: "#245C5A" }}
                  >
                    {loading ? "Updating..." : "Update password"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep("credentials");
                      setError("");
                      setNotice("");
                    }}
                    className="w-full text-[11px]"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Cancel
                  </button>
                </form>
              )}

              {authStep === "totp-setup" && totpSetup && (
                <div className="space-y-3">
                  <div className="text-center">
                    <ShieldCheck
                      size={24}
                      className="mx-auto mb-2"
                      style={{ color: "#5BA8A5" }}
                    />
                    <h3 className="text-[14px] font-semibold text-white">
                      Add your authenticator
                    </h3>
                    <p
                      className="text-[10px] mt-1"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      In Microsoft Authenticator, Google Authenticator,
                      1Password, or another TOTP app, add an account manually.
                    </p>
                  </div>
                  <div
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: "rgba(91,168,165,0.12)",
                      border: "1px solid rgba(91,168,165,0.25)",
                    }}
                  >
                    <div
                      className="text-[9px] uppercase tracking-widest"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      Account
                    </div>
                    <div className="text-[11px] text-white mt-1 break-all">
                      {totpSetup.accountName}
                    </div>
                    <div
                      className="text-[9px] uppercase tracking-widest mt-3"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      Setup key
                    </div>
                    <code
                      className="block text-[14px] tracking-[0.12em] mt-1 break-all select-all"
                      style={{ color: "#A7F3D0" }}
                    >
                      {totpSetup.secret}
                    </code>
                  </div>
                  <p
                    className="text-[10px] text-center"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    Save this key now. It is shown once. The first code you
                    enter will complete authenticator enrollment.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setTotpSetup(null);
                      setNotice(
                        "Authenticator prepared. Sign in, then enter its current six-digit code.",
                      );
                      setAuthStep("credentials");
                      setMode("login");
                    }}
                    className="w-full py-2.5 rounded-lg text-[13px] font-bold text-white"
                    style={{ backgroundColor: "#245C5A" }}
                  >
                    Continue to sign in
                  </button>
                </div>
              )}
            </div>

            <p
              className="text-center text-[10px] mt-5"
              style={{ color: "rgba(255,255,255,0.2)" }}
            >
              Adolbi Care, Inc. | Behavioral Health Center at Cypress
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
