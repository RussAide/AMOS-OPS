import { Link, useLocation } from "react-router-dom";
import { FileQuestion } from "lucide-react";

export function NotFoundPage() {
  const location = useLocation();

  return (
    <section
      aria-labelledby="not-found-title"
      className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm"
    >
      <FileQuestion
        aria-hidden="true"
        className="mx-auto mb-4 text-[#245C5A]"
        size={42}
      />
      <p className="text-xs font-semibold uppercase tracking-widest text-[#245C5A]">
        Page not found
      </p>
      <h1
        id="not-found-title"
        className="mt-2 text-2xl font-bold text-slate-900"
      >
        This AMOS-OPS destination does not exist
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        No registered page matches <code>{location.pathname}</code>.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex rounded-lg bg-[#245C5A] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Return to dashboard
      </Link>
    </section>
  );
}

export default NotFoundPage;
