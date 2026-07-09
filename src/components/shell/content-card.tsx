import type { ReactNode } from "react";

interface ContentCardProps {
  children: ReactNode;
  className?: string;
}

export function ContentCard({ children, className = "" }: ContentCardProps) {
  return (
    <div
      className={`mx-6 mt-4 mb-6 px-6 py-6 rounded-xl ${className}`}
      style={{
        backgroundColor: "var(--card-bg)",
        border: "1px solid var(--card-border)",
      }}
    >
      {children}
    </div>
  );
}
