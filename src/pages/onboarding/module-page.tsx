import { useParams } from "react-router-dom";
import { ModuleContentViewer } from "@/components/onboarding/module-content-viewer";

export function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();

  if (!moduleId) {
    return (
      <div className="text-center py-16">
        <h2 className="text-[18px] font-semibold mb-2" style={{ color: "var(--topbar-title)" }}>
          No Module Selected
        </h2>
        <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
          Please select a module from a track to begin.
        </p>
      </div>
    );
  }

  return <ModuleContentViewer moduleId={moduleId} />;
}

export default ModulePage;
