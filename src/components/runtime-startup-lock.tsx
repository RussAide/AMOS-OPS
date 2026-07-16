export function RuntimeStartupLock(): React.JSX.Element {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      <section className="max-w-xl rounded-xl border border-rose-700 bg-slate-900 p-6 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-300">
          Safe startup lock
        </p>
        <h1 className="mt-3 text-2xl font-semibold">AMOS-OPS did not start</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          The server-issued runtime mode could not be verified. Demo fixtures,
          production data, and external writes remain unavailable.
        </p>
        <button
          type="button"
          className="mt-5 rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-950"
          onClick={() => window.location.reload()}
        >
          Retry startup
        </button>
      </section>
    </main>
  );
}
