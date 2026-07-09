import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  entityType: string;
  entityId: string;
}

export function AuditLogPanel() {
  const [entries] = useState<AuditEntry[]>([
    { id: "1", action: "LOGIN", actor: "admin", timestamp: new Date().toISOString(), entityType: "auth", entityId: "session_1" },
    { id: "2", action: "PERSON_CREATED", actor: "hr-director", timestamp: new Date(Date.now() - 3600000).toISOString(), entityType: "person", entityId: "person_1" },
  ]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ScrollText className="h-4 w-4" />
          Audit Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-xs py-1 border-b last:border-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px]">{entry.action}</Badge>
                  <span className="text-muted-foreground">{entry.actor}</span>
                </div>
                <span className="text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
