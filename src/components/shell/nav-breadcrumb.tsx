import { getBreadcrumbs } from "@/data/navData";
import { useNavigate } from "react-router-dom";

interface BreadcrumbProps {
  path: string;
}

export function Breadcrumb({ path }: BreadcrumbProps) {
  const navigate = useNavigate();
  const segments = getBreadcrumbs(path);

  return (
    <nav
      className="flex items-center gap-2 px-6 pt-4 pb-0 text-[13px]"
      aria-label="Breadcrumb"
    >
      {segments.map((segment, index) => (
        <span key={index} className="flex items-center gap-2">
          {index > 0 && (
            <span style={{ color: "var(--search-text)" }}>/</span>
          )}
          {segment.href && index < segments.length - 1 ? (
            <button
              onClick={() => navigate(segment.href!)}
              className="border-none bg-transparent p-0 transition-colors duration-150 hover:underline"
              style={{ color: "var(--breadcrumb-text)", cursor: "pointer" }}
            >
              {segment.label}
            </button>
          ) : (
            <span
              className="font-medium"
              style={{ color: "var(--breadcrumb-active)" }}
            >
              {segment.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
