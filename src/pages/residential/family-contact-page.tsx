import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TYPE_LABELS: Record<string, string> = {
  phone_call: "Phone Call", video_call: "Video Call", in_person_visit: "In-Person Visit",
  letter: "Letter", email: "Email", family_therapy: "Family Therapy", education_session: "Education",
};

const TYPE_COLORS: Record<string, string> = {
  phone_call: "bg-blue-100 text-blue-700", video_call: "bg-purple-100 text-purple-700",
  in_person_visit: "bg-green-100 text-green-700", letter: "bg-gray-100 text-gray-700",
  email: "bg-gray-100 text-gray-700", family_therapy: "bg-orange-100 text-orange-700",
  education_session: "bg-yellow-100 text-yellow-700",
};

interface FamilyContact {
  id: string;
  youth_id: string;
  contact_type: string;
  contact_direction: string | null;
  contact_date: string;
  contacted_person: string;
  relationship: string | null;
  topics_discussed: string | null;
  concerns_raised: string | null;
  action_items: string | null;
  outcome: string | null;
  follow_up_needed: number | boolean;
  follow_up_date: string | null;
}

interface ResidentialYouth {
  id: string;
  first_name: string;
  last_name: string;
}

export function FamilyContactPage() {
  const [activeTab, setActiveTab] = useState("all");
  const { data: rawContacts = [] } = trpc.m18.listFamilyContacts.useQuery();
  const { data: rawYouthList = [] } = trpc.m13.listYouth.useQuery();
  const contacts = rawContacts as FamilyContact[];
  const youthList = rawYouthList as ResidentialYouth[];

  const needsFollowUp = contacts.filter((c) => c.follow_up_needed === 1);
  const byYouth: Record<string, FamilyContact[]> = {};
  contacts.forEach((c) => {
    if (!byYouth[c.youth_id]) byYouth[c.youth_id] = [];
    byYouth[c.youth_id].push(c);
  });

  return (
    <>

      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a3a]">Family Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">Calls, visits, letters, therapy sessions, and education</p>
        </div>
      </div>

      {needsFollowUp.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="p-4">
            <div className="text-sm font-medium text-yellow-800">{needsFollowUp.length} follow-up{needsFollowUp.length > 1 ? "s" : ""} pending</div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="all">All ({contacts.length})</TabsTrigger>
          <TabsTrigger value="followup">Follow-up ({needsFollowUp.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-4">
          {Object.entries(byYouth).map(([youthId, youthContacts]) => {
            const youth = youthList.find((y) => y.id === youthId);
            return (
              <Card key={youthId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    {youth ? `${youth.first_name} ${youth.last_name}` : youthId}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {youthContacts.map((c) => <ContactCard key={c.id} contact={c} />)}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="followup" className="mt-4 space-y-2">
          {needsFollowUp.map((c) => <ContactCard key={c.id} contact={c} />)}
          {needsFollowUp.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No pending follow-ups.</p>}
        </TabsContent>
      </Tabs>
    </div>
  </>
  );
}

function ContactCard({ contact: c }: { contact: FamilyContact }) {
  return (
    <div className={`p-3 rounded-lg border ${c.follow_up_needed === 1 ? "border-yellow-300 bg-yellow-50/30" : "border-gray-200"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className={`${TYPE_COLORS[c.contact_type] ?? "bg-gray-100"} text-xs`}>{TYPE_LABELS[c.contact_type] ?? c.contact_type}</Badge>
          {c.contact_direction && <Badge variant="outline" className="text-xs">{c.contact_direction}</Badge>}
          <span className="text-xs text-muted-foreground">{c.contact_date}</span>
        </div>
        {c.follow_up_needed === 1 && <Badge className="bg-yellow-100 text-yellow-700 text-xs">Follow-up {c.follow_up_date}</Badge>}
      </div>
      <div className="text-sm font-medium mt-1">{c.contacted_person} {c.relationship && <span className="text-muted-foreground font-normal">({c.relationship})</span>}</div>
      {c.topics_discussed && <div className="text-xs text-muted-foreground mt-0.5">{c.topics_discussed}</div>}
      {c.concerns_raised && <div className="text-xs text-orange-600 mt-0.5">Concern: {c.concerns_raised}</div>}
      {c.action_items && <div className="text-xs text-[#2e8b8b] mt-0.5">Actions: {c.action_items}</div>}
      {c.outcome && <div className="text-xs text-muted-foreground mt-0.5">Outcome: {c.outcome}</div>}
    </div>
  );
}

export default FamilyContactPage;
