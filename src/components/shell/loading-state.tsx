export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--search-text)", borderTopColor: "transparent" }}
        />
        <p
          className="text-[14px]"
          style={{ color: "var(--search-text)" }}
        >
          Loading onboarding data...
        </p>
      </div>
    </div>
  );
}
