import { useEffect, useState } from "react";

export function SuspenseFallback() {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ backgroundColor: "var(--content-bg, #F1F5F9)" }}
    >
      {/* Logo mark */}
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 animate-pulse"
        style={{ backgroundColor: "rgba(36,92,90,0.1)" }}
      >
        <img
          src="/assets/AMOS-OPS_Icon_Transparent.png"
          alt="AMOS-OPS"
          className="w-8 h-8 object-contain"
          draggable={false}
        />
      </div>

      {/* Spinner */}
      <div
        className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin mb-3"
        style={{ borderColor: "#245C5A", borderTopColor: "transparent" }}
      />

      {/* Text */}
      <p
        className="text-[13px] font-medium tracking-wide"
        style={{ color: "#245C5A" }}
      >
        Loading AMOS-OPS{dots}
      </p>

      {/* Subtle progress bar */}
      <div
        className="w-[140px] h-[2px] rounded-full mt-4 overflow-hidden"
        style={{ backgroundColor: "rgba(36,92,90,0.1)" }}
      >
        <div
          className="h-full rounded-full animate-shimmer"
          style={{
            backgroundColor: "#245C5A",
            animation: "shimmer 1.5s ease-in-out infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes shimmer {
          0% { width: 0%; opacity: 0.4; }
          50% { width: 70%; opacity: 1; }
          100% { width: 100%; opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
