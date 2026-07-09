import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import {
  Shield, LogIn, UserPlus, AlertCircle, ChevronRight,
  ClipboardList, Users, Route, ShieldCheck, UserCheck,
  DollarSign, Lock, Activity,
} from "lucide-react";

/* ─── Floating Particles Canvas ─────────────────────────── */
function ParticleBackground() {
  useEffect(() => {
    const canvas = document.getElementById("particle-canvas") as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const particles: { x: number; y: number; r: number; dx: number; dy: number; o: number }[] = [];
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
      particles.forEach(p => {
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

  return <canvas id="particle-canvas" className="fixed inset-0 pointer-events-none" style={{ zIndex: 1 }} />;
}

const FEATURE_CARDS = [
  { icon: ClipboardList, title: "EHR / MIS", description: "Clinical records & care plans", color: "#245C5A" },
  { icon: Users, title: "Workforce", description: "Staff & personnel management", color: "#2563EB" },
  { icon: Route, title: "Care Coordination", description: "MDT, crisis & BHC-GRO routing", color: "#059669" },
  { icon: ShieldCheck, title: "QA & Compliance", description: "Audits, CAPs & compliance score", color: "#7C3AED" },
  { icon: UserCheck, title: "Admissions", description: "Referrals & intake workflow", color: "#D97706" },
  { icon: DollarSign, title: "Revenue", description: "Billing, payers & authorizations", color: "#0891B2" },
];

const DEPT_PILLS = ["Executive", "Corporate", "GAD", "BHC", "GRO"];

export function LoginPage() {
  const navigate = useNavigate();
  const { login, register, isAuthenticated } = useAuth();
  const [showForm, setShowForm] = useState(true);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", firstName: "", lastName: "", role: "rcs-day", department: "" });

  if (isAuthenticated) {
    navigate("/", { replace: true });
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/");
    } catch (err: any) {
      const msg = err.message ?? "";
      setError(msg.includes("Unexpected token") || msg.includes("DOCTYPE") ? "API server not available." : msg || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({ email: form.email, password: form.password, firstName: form.firstName, lastName: form.lastName, role: form.role, department: form.department || undefined });
      navigate("/");
    } catch (err: any) {
      setError(err.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "linear-gradient(180deg, #0a1628 0%, #0d1f35 50%, #0a1628 100%)" }}>
      <ParticleBackground />

      <div className="relative flex items-center justify-end px-6 py-3" style={{ zIndex: 10 }}>
        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
          <Lock size={10} />
          HIPAA Compliant &middot; PHI Protected
        </div>
      </div>

      <div className="relative flex flex-col items-center justify-center px-4 py-6" style={{ zIndex: 10, minHeight: "calc(100vh - 48px)" }}>

        {!showForm ? (
          <div className="w-full max-w-2xl mx-auto text-center">
            <div className="mb-2">
              <img src="/assets/AMOS-OPS_Logo_Vertical_Dark.png" alt="AMOS-OPS" className="w-[260px] mx-auto" draggable={false} />
            </div>
            <p className="text-[13px] font-semibold tracking-[0.25em] uppercase mb-0.5" style={{ color: "#5BA8A5" }}>Digital Operations System</p>
            <p className="text-[12px] mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>Adolbi Care &middot; Enterprise Healthcare Platform</p>

            <div className="grid grid-cols-3 gap-3 mb-8">
              {FEATURE_CARDS.map(card => (
                <div key={card.title} className="rounded-xl p-3 text-left transition-all hover:scale-[1.02]" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <card.icon size={16} style={{ color: card.color }} className="mb-2" />
                  <div className="text-[11px] font-semibold text-white mb-0.5">{card.title}</div>
                  <div className="text-[9px] leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>{card.description}</div>
                </div>
              ))}
            </div>

            <button onClick={() => setShowForm(true)} className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-[14px] font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98] mb-3" style={{ background: "linear-gradient(135deg, #245C5A 0%, #1a8a85 100%)", boxShadow: "0 4px 24px rgba(36,92,90,0.4), 0 0 60px rgba(36,92,90,0.15)" }}>
              <Shield size={16} />
              Access AMOS-OPS
              <ChevronRight size={16} />
            </button>

            <p className="text-[10px] mb-8" style={{ color: "rgba(255,255,255,0.25)" }}>Authorized personnel only &middot; All access is logged</p>

            <div className="flex items-center justify-center gap-2 flex-wrap">
              {DEPT_PILLS.map(dept => (
                <span key={dept} className="px-3 py-1 rounded-full text-[10px] font-medium" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>{dept}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md mx-auto">
            <button onClick={() => { setShowForm(false); setError(""); }} className="text-[11px] mb-3 flex items-center gap-1 transition-colors hover:opacity-80" style={{ color: "rgba(255,255,255,0.4)" }}>
              <ChevronRight size={12} className="rotate-180" /> Back to overview
            </button>

            <div className="text-center mb-4">
              <img src="/assets/AMOS-OPS_Logo_Vertical_Dark.png" alt="AMOS-OPS" className="w-[100px] mx-auto mb-2" draggable={false} />
              <h2 className="text-[18px] font-bold text-white">Sign In to AMOS-OPS</h2>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>Enter your credentials to continue</p>
            </div>

            <div className="rounded-xl p-5" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>
              <div className="flex mb-4 rounded-lg overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                <button onClick={() => { setMode("login"); setError(""); }} className="flex-1 py-2 text-[12px] font-medium transition-all" style={{ backgroundColor: mode === "login" ? "#245C5A" : "transparent", color: mode === "login" ? "#fff" : "rgba(255,255,255,0.4)" }}>Sign In</button>
                <button onClick={() => { setMode("register"); setError(""); }} className="flex-1 py-2 text-[12px] font-medium transition-all" style={{ backgroundColor: mode === "register" ? "#245C5A" : "transparent", color: mode === "register" ? "#fff" : "rgba(255,255,255,0.4)" }}>Register</button>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg mb-3 text-[11px]" style={{ backgroundColor: "rgba(220,38,38,0.12)", color: "#FCA5A5", border: "1px solid rgba(220,38,38,0.2)" }}>
                  <AlertCircle size={13} /> {error}
                </div>
              )}

              <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-2.5">
                <div>
                  <label className="text-[10px] font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Email</label>
                  <input type="email" required className="w-full rounded-lg px-3 py-2.5 text-[12px] outline-none transition-colors" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} placeholder="admin@adolbi.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="text-[10px] font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Password</label>
                  <input type="password" required className="w-full rounded-lg px-3 py-2.5 text-[12px] outline-none transition-colors" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} placeholder="Enter password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>

                {mode === "register" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>First Name</label>
                        <input type="text" required className="w-full rounded-lg px-3 py-2.5 text-[12px] outline-none" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-[10px] font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Last Name</label>
                        <input type="text" required className="w-full rounded-lg px-3 py-2.5 text-[12px] outline-none" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Role</label>
                      <select className="w-full rounded-lg px-3 py-2.5 text-[12px] outline-none" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                        <optgroup label="Executive">
                          <option value="super-admin">Super Admin (E. Russ Aideyan)</option>
                          <option value="administrator">Administrator / LCCA</option>
                          <option value="program-director">Program Director</option>
                        </optgroup>
                        <optgroup label="GRO Residential">
                          <option value="rcs-day">RCS - Day Shift</option>
                          <option value="rcs-night">RCS - Night Shift</option>
                          <option value="rcs-lead">RCS - Lead</option>
                          <option value="behavioral-support">Behavioral Support</option>
                        </optgroup>
                        <optgroup label="Clinical">
                          <option value="treatment-director">Treatment Director / LPHA</option>
                          <option value="clinical-director">Clinical Director / PMHNP</option>
                          <option value="qmhp-cs">QMHP-CS</option>
                          <option value="case-manager">Case Manager</option>
                          <option value="therapist">Therapist</option>
                          <option value="nurse">Nurse</option>
                        </optgroup>
                        <optgroup label="Operations">
                          <option value="billing-specialist">Billing Specialist</option>
                          <option value="hr-director">HR Director</option>
                        </optgroup>
                      </select>
                    </div>
                  </>
                )}

                <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-bold text-white transition-all disabled:opacity-50 mt-2" style={{ background: "linear-gradient(135deg, #245C5A 0%, #1a8a85 100%)" }}>
                  {mode === "login" ? <LogIn size={15} /> : <UserPlus size={15} />}
                  {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
                </button>
              </form>
            </div>

            <p className="text-center text-[10px] mt-5" style={{ color: "rgba(255,255,255,0.2)" }}>
              Adolbi Care, Inc. | Behavioral Health Center at Cypress
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginPage;