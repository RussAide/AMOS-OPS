import { PageLayout } from "@/components/shell/page-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction, BookOpen } from "lucide-react";

export function KnowledgePage() {
  return (
    <PageLayout>
      <div className="px-4 md:px-6 pb-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <BookOpen size={22} style={{ color: "#245C5A" }} />
            Knowledge &amp; SOP Library
          </h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            Standard operating procedures, policy documents, and organizational knowledge
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Construction className="h-5 w-5 text-amber-500" />
              Coming Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              This module is under development. Check back for updates.
            </p>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}

export default KnowledgePage;
