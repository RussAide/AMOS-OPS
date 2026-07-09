import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { LogIn, AlertCircle } from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a1628" }}>
      <div className="w-full max-w-sm p-6 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <h2 className="text-xl font-bold text-white text-center mb-1">AMOS-OPS</h2>
        <p className="text-xs text-center mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>Sign in to continue</p>
        
        {error && (
          <div className="flex items-center gap-2 p-2 rounded-lg mb-3 text-xs" style={{ backgroundColor: "rgba(220,38,38,0.12)", color: "#FCA5A5" }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <label className="text-xs block mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Email</label>
            <input type="email" required className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>Password</label>
            <input type="password" required className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-50" style={{ background: "linear-gradient(135deg, #245C5A 0%, #1a8a85 100%)" }}>
            <LogIn size={15} /> {loading ? "Please wait..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
