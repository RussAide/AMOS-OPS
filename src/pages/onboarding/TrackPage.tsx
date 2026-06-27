import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";
import { TrackDetailView } from "@/components/onboarding/TrackDetailView";
import { getTrackById } from "@/data/onboardingData";

export function TrackPage() {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();

  const track = trackId ? getTrackById(trackId) : undefined;

  if (!track) {
    return (
      <div className="text-center py-16">
        <BookOpen size={48} className="mx-auto mb-4" style={{ color: "#CBD5E1" }} />
        <h2 className="text-[18px] font-semibold mb-2" style={{ color: "var(--topbar-title)" }}>
          Track Not Found
        </h2>
        <p className="text-[13px] mb-4" style={{ color: "var(--topbar-subtitle)" }}>
          The onboarding track you are looking for does not exist.
        </p>
        <button
          onClick={() => navigate("/onboarding")}
          className="px-4 py-2 rounded-lg text-[13px] font-medium text-white"
          style={{ backgroundColor: "#245C5A" }}
        >
          Back to Onboarding
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => navigate("/onboarding")}
          className="flex items-center gap-1 text-[13px] font-medium hover:underline transition-all"
          style={{ color: "#245C5A" }}
        >
          <ArrowLeft size={14} />
          Back to Tracks
        </button>
        <span style={{ color: "var(--topbar-subtitle)" }}>/</span>
        <span className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
          {track.name}
        </span>
      </div>

      <TrackDetailView trackId={track.id} />
    </div>
  );
}
