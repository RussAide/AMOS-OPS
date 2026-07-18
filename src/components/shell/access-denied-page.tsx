import { Link } from "react-router-dom";
import { ShieldX } from "lucide-react";

export function AccessDeniedPage({ reason }: { reason: string }) {
  return (
    <section
      aria-labelledby="access-denied-title"
      className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-8 text-center"
    >
      <ShieldX
        aria-hidden="true"
        className="mx-auto mb-4 text-red-700"
        size={42}
      />
      <p className="text-xs font-semibold uppercase tracking-widest text-red-700">
        Access denied
      </p>
      <h1
        id="access-denied-title"
        className="mt-2 text-2xl font-bold text-slate-900"
      >
        This page is outside your assigned role scope
      </h1>
      <p className="mt-3 text-sm text-slate-700">{reason}</p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-lg bg-[#245C5A] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Return to dashboard
      </Link>
    </section>
  );
}

export default AccessDeniedPage;
