import { useState } from "react";
import { useAuth, ROLE_DEFINITIONS } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Shield, LogIn, UserPlus, AlertCircle } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, register, seedAdmin, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const [form, setForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "",
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
    if (!form.role) {
      setError("Please select a role");
      return;
    }
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

  const handleSeed = async () => {
    setError("");
    try {
      const result = await seedAdmin();
      if (result.created) {
        setSeeded(true);
        setForm({ ...form, email: result.email ?? "admin@adolbi.com", password: result.password ?? "admin123" });
      } else {
        setForm({ ...form, email: "admin@adolbi.com", password: "admin123" });
      }
    } catch (err: any) {
      const msg = err.message ?? "";
      if (msg.includes("Unexpected token") || msg.includes("DOCTYPE")) {
        setError("API server not available. Run 'npm start' locally to enable full functionality.");
      } else {
        setError(msg || "Failed to seed admin");
      }
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

          {seeded && (
            <div className="p-3 rounded-lg mb-4 text-[12px]" style={{ backgroundColor: "rgba(5,150,105,0.15)", color: "#6EE7B7" }}>
              Admin account created. Email and password pre-filled.
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
                      <option value="" style={{ color: "#333" }}>Select Role</option>
                      {ROLE_DEFINITIONS.map((role) => (
                        <option key={role.id} value={role.id} style={{ color: "#333" }}>{role.label}</option>
                      ))}
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

          {/* Seed admin button */}
          {!seeded && mode === "login" && (
            <button
              onClick={handleSeed}
              className="w-full mt-3 py-2 rounded-lg text-[12px] font-medium transition-all"
              style={{ backgroundColor: "rgba(233,196,106,0.1)", color: "#e9c46a", border: "1px solid rgba(233,196,106,0.2)" }}
            >
              Create Default Admin Account
            </button>
          )}
        </div>

        <p className="text-center text-[11px] mt-6" style={{ color: "rgba(255,255,255,0.3)" }}>
          Adolbi Care, Inc. | Behavioral Health Center at Cypress
        </p>
      </div>
    </div>
  );
}
