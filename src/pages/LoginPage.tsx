import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Shield, LogIn, UserPlus, AlertCircle } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, register, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "staff",
    department: "",
  });

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
      setError(msg.includes("Unexpected token") || msg.includes("DOCTYPE") ? "API server not available. Run 'npm start' locally." : msg || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role,
        department: form.department || undefined,
      });
      navigate("/");
    } catch (err: any) {
      setError(err.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
      <div className="w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: "rgba(233,196,106,0.15)" }}>
            <Shield size={32} style={{ color: "#e9c46a" }} />
          </div>
          <h1 className="text-[24px] font-bold text-white mb-1">AMOS-OPS</h1>
          <p className="text-[14px]" style={{ color: "rgba(255,255,255,0.6)" }}>Enterprise Intranet</p>
        </div>

        {/* Card */}
        <div className="rounded-xl p-6" style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(10px)" }}>
          {/* Tabs */}
          <div className="flex mb-6 rounded-lg overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
            <button
              onClick={() => { setMode("login"); setError(""); }}
              className="flex-1 py-2 text-[13px] font-medium transition-all"
              style={{ backgroundColor: mode === "login" ? "#245C5A" : "transparent", color: mode === "login" ? "#fff" : "rgba(255,255,255,0.5)" }}
            >
              Sign In
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); }}
              className="flex-1 py-2 text-[13px] font-medium transition-all"
              style={{ backgroundColor: mode === "register" ? "#245C5A" : "transparent", color: mode === "register" ? "#fff" : "rgba(255,255,255,0.5)" }}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg mb-4 text-[12px]" style={{ backgroundColor: "rgba(220,38,38,0.15)", color: "#FCA5A5" }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}



          <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4">
            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Email</label>
              <input
                type="email"
                required
                className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none"
                style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                placeholder="admin@adolbi.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <label className="text-[11px] font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Password</label>
              <input
                type="password"
                required
                minLength={6}
                className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none"
                style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                placeholder="Enter password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            {mode === "register" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>First Name</label>
                    <input type="text" required className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none" style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Last Name</label>
                    <input type="text" required className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none" style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Role</label>
                    <select className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none" style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                      <option value="residential-care-specialist">Residential Care Specialist</option>
                      <option value="rcs-lead">RCS Lead</option>
                      <option value="rcs-night">RCS Night Shift</option>
                      <option value="rcs-prn">RCS PRN</option>
                      <option value="behavioral-support-specialist">Behavioral Support Specialist</option>
                      <option value="recreation-coordinator">Recreation Coordinator</option>
                      <option value="medication-aide">Medication Aide</option>
                      <option value="qmhp-cs">QMHP-CS / Case Manager</option>
                      <option value="ccmg-clinical-director">CCMG Clinical Director</option>
                      <option value="treatment-director-lpha">Treatment Director / LPHA</option>
                      <option value="pmhnp-fnp">PMHNP-FNP</option>
                      <option value="hr-director">HR Director</option>
                      <option value="hr-compliance-officer">HR / Compliance Officer</option>
                      <option value="administrator-lcca">Administrator / LCCA</option>
                      <option value="gro-administrator">GRO Administrator</option>
                      <option value="it-administrator">IT Administrator</option>
                      <option value="accountant">Accountant</option>
                      <option value="contract-manager">Contract Manager</option>
                      <option value="compliance-officer">Compliance Officer</option>
                      <option value="qa-coordinator">QA Coordinator</option>
                      <option value="utilization-review">Utilization Review</option>
                      <option value="super-admin">Super Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium mb-1 block" style={{ color: "rgba(255,255,255,0.5)" }}>Department</label>
                    <input type="text" className="w-full rounded-lg px-3 py-2.5 text-[13px] outline-none" style={{ backgroundColor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }} placeholder="Optional" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-medium text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: "#245C5A" }}
            >
              {mode === "login" ? <LogIn size={16} /> : <UserPlus size={16} />}
              {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>


        </div>

        <p className="text-center text-[11px] mt-6" style={{ color: "rgba(255,255,255,0.3)" }}>
          Adolbi Care, Inc. | Behavioral Health Center at Cypress
        </p>
      </div>
    </div>
  );
}
