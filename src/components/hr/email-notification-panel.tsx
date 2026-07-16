import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Send, AlertCircle, CheckCircle, Clock } from "lucide-react";

export function EmailNotificationPanel() {
  const [open, setOpen] = useState(false);
  const { data: stats } = trpc.email.stats.useQuery(undefined, { enabled: open });
  const { data: emails = [] } = trpc.email.list.useQuery({ limit: 50 }, { enabled: open });
  const { data: templates = [] } = trpc.email.templates.useQuery(undefined, { enabled: open });
  const sendMutation = trpc.email.send.useMutation();
  const sendTemplateMutation = trpc.email.sendTemplate.useMutation();
  const utils = trpc.useUtils();

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!to || !subject || !body) return;
    try {
      await sendMutation.mutateAsync({ to, subject, body });
      utils.email.list.invalidate();
      utils.email.stats.invalidate();
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch (err) {
      console.error("Failed to send email:", err);
    }
  };

  const handleSendTemplate = async () => {
    if (!to || !selectedTemplate) return;
    try {
      await sendTemplateMutation.mutateAsync({
        to,
        template: selectedTemplate,
        vars: {
          personName: "Test Person",
          moduleName: "Test Module",
          fromStatus: "Old Status",
          toStatus: "New Status",
          changedBy: "HR Director",
          timestamp: new Date().toISOString(),
          credentialType: "CPR Certification",
          expiryDate: "2026-07-01",
          daysRemaining: "8",
          percentComplete: "100",
          supervisor: "Robert Fitzgerald",
        },
      });
      utils.email.list.invalidate();
      utils.email.stats.invalidate();
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch (err) {
      console.error("Failed to send template:", err);
    }
  };

  const isMock = stats?.mockMode ?? true;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full text-left p-3 rounded-lg border transition-all hover:shadow-md" style={{ borderColor: "#245C5A30", backgroundColor: "#F0FDFA08" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">Email Notifications</p>
              <p className="text-2xl font-bold mt-1" style={{ color: "#245C5A" }}>{stats?.total ?? 0}</p>
            </div>
            <Mail size={20} style={{ color: "#245C5A" }} />
          </div>
          {isMock && (
            <p className="text-[8px] mt-1" style={{ color: "#D97706" }}>Mock mode — configure SMTP to send real emails</p>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: "#245C5A" }}>
            <Mail size={18} />
            Email Notifications {isMock && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">Mock</span>}
          </DialogTitle>
        </DialogHeader>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: "Total", value: stats?.total ?? 0, color: "#245C5A", bg: "#F0FDFA" },
            { label: "Sent", value: stats?.sent ?? 0, color: "#059669", bg: "#ECFDF5" },
            { label: "Queued", value: stats?.queued ?? 0, color: "#D97706", bg: "#FFFBEB" },
            { label: "Failed", value: stats?.failed ?? 0, color: "#DC2626", bg: "#FEF2F2" },
          ].map((s) => (
            <div key={s.label} className="text-center p-2 rounded-md" style={{ backgroundColor: s.bg }}>
              <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[8px] font-medium uppercase tracking-wider" style={{ color: s.color }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Compose */}
        <div className="space-y-2 mb-3 border rounded-lg p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Send Test</p>
          <input
            type="email"
            placeholder="To: email@example.invalid"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full px-2 py-1.5 rounded border text-[12px] outline-none"
          />
          <div className="flex gap-2">
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded border text-[12px] outline-none"
            >
              <option value="">Custom message...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {selectedTemplate && (
              <Button size="sm" className="text-[11px] gap-1" style={{ backgroundColor: "#245C5A" }} onClick={handleSendTemplate} disabled={sendTemplateMutation.isPending}>
                <Send size={11} /> Template
              </Button>
            )}
          </div>
          {!selectedTemplate && (
            <>
              <input
                type="text"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-2 py-1.5 rounded border text-[12px] outline-none"
              />
              <textarea
                placeholder="Message body..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                className="w-full px-2 py-1.5 rounded border text-[12px] outline-none resize-none"
              />
              <Button size="sm" className="text-[11px] gap-1" style={{ backgroundColor: "#245C5A" }} onClick={handleSend} disabled={sendMutation.isPending || !to || !subject || !body}>
                <Send size={11} /> Send Test
              </Button>
            </>
          )}
          {sent && (
            <p className="text-[11px] flex items-center gap-1" style={{ color: "#059669" }}>
              <CheckCircle size={12} /> Email queued (mock mode)
            </p>
          )}
        </div>

        {/* Log */}
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Recent Emails</p>
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
          {emails.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">No emails sent yet.</p>
          ) : (
            emails.map((e) => (
              <div key={e.id} className="flex items-center gap-2 p-2 rounded-md border bg-gray-50">
                {e.status === "sent" ? <CheckCircle size={12} style={{ color: "#059669" }} /> :
                 e.status === "queued" ? <Clock size={12} style={{ color: "#D97706" }} /> :
                 <AlertCircle size={12} style={{ color: "#DC2626" }} />}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium truncate">{e.subject}</p>
                  <p className="text-[9px] text-muted-foreground">{e.to} · {e.template}</p>
                </div>
                <span className="text-[8px] text-muted-foreground">{e.sentAt?.slice(0, 10)}</span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
