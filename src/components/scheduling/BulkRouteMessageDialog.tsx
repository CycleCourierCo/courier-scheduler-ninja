import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, Mail } from "lucide-react";
import { extractTemplateParams, getTemplateBodyText, type SendZenTemplate } from "@/lib/sendzenTemplates";
import { wrapAnnouncementEmail, buildPlainText } from "@/utils/announcementEmailTemplate";

interface Job {
  orderId: string;
  type: "collection" | "delivery";
  contactName: string;
  phoneNumber: string;
  address?: string;
  order?: any;
}

interface Recipient {
  key: string;          // `${orderId}:${type}`
  orderId: string;
  type: "collection" | "delivery";
  name: string;
  phone: string;
  email: string;
  isCompleted: boolean;
  completedReason?: string;
}

function buildRecipients(jobs: Job[]): Recipient[] {
  return jobs.map((job) => {
    const contact = job.type === "collection" ? job.order?.sender : job.order?.receiver;
    const boxStatus = job.order?.box_my_bike_status || job.order?.status;
    const boxDelivered = boxStatus === "delivered_by_3p";
    const collected = job.order?.order_collected === true;
    const delivered = job.order?.order_delivered === true;

    let isCompleted = false;
    let reason: string | undefined;
    if (boxDelivered) {
      isCompleted = true;
      reason = "Delivered by 3rd party";
    } else if (job.type === "delivery" && delivered) {
      isCompleted = true;
      reason = "Delivered";
    } else if (job.type === "collection" && collected) {
      isCompleted = true;
      reason = "Collected";
    }

    return {
      key: `${job.orderId}:${job.type}`,
      orderId: job.orderId,
      type: job.type,
      name: contact?.name || job.contactName || "Customer",
      phone: contact?.phone || job.phoneNumber || "",
      email: contact?.email || "",
      isCompleted,
      completedReason: reason,
    };
  });
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jobs: Job[];
}

const BulkRouteMessageDialog: React.FC<Props> = ({ open, onOpenChange, jobs }) => {
  const recipients = useMemo(() => buildRecipients(jobs), [jobs]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset selection each time dialog opens
  useEffect(() => {
    if (open) {
      const initial = new Set(recipients.filter((r) => !r.isCompleted).map((r) => r.key));
      setSelected(initial);
    }
  }, [open, recipients]);

  const [sendWA, setSendWA] = useState(true);
  const [sendEmail, setSendEmail] = useState(true);

  // WA composer
  const [waMode, setWaMode] = useState<"text" | "template">("text");
  const [waMessage, setWaMessage] = useState("");
  const [selectedTemplateName, setSelectedTemplateName] = useState("");
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({});

  // Email composer
  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  // Progress
  const [isSending, setIsSending] = useState(false);
  const [waProgress, setWaProgress] = useState({ sent: 0, total: 0 });
  const [emailProgress, setEmailProgress] = useState({ sent: 0, total: 0 });

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["sendzen-templates"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-sendzen-templates");
      if (error) throw error;
      return (data?.templates || []) as SendZenTemplate[];
    },
    enabled: open && sendWA && waMode === "template",
  });

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.name === selectedTemplateName),
    [templates, selectedTemplateName]
  );
  const selectedTemplateParams = useMemo(
    () => (selectedTemplate ? extractTemplateParams(selectedTemplate) : []),
    [selectedTemplate]
  );

  const chosen = recipients.filter((r) => selected.has(r.key));
  // Dedupe for send
  const waTargets = useMemo(() => {
    const seen = new Set<string>();
    return chosen.filter((r) => {
      const p = r.phone?.replace(/\D/g, "");
      if (!p || p.length < 5) return false;
      if (seen.has(p)) return false;
      seen.add(p);
      return true;
    });
  }, [chosen]);
  const emailTargets = useMemo(() => {
    const seen = new Set<string>();
    return chosen.filter((r) => {
      const e = r.email?.trim().toLowerCase();
      if (!e) return false;
      if (seen.has(e)) return false;
      seen.add(e);
      return true;
    });
  }, [chosen]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  const selectAllActive = () =>
    setSelected(new Set(recipients.filter((r) => !r.isCompleted).map((r) => r.key)));
  const selectNone = () => setSelected(new Set());

  const validate = (): string | null => {
    if (!sendWA && !sendEmail) return "Enable at least one channel";
    if (chosen.length === 0) return "Select at least one recipient";
    if (sendWA) {
      if (waMode === "text" && !waMessage.trim()) return "Enter a WhatsApp message";
      if (waMode === "template" && !selectedTemplateName) return "Choose a WhatsApp template";
      if (waTargets.length === 0) return "No selected recipients have phone numbers";
    }
    if (sendEmail) {
      if (!subject.trim()) return "Enter an email subject";
      if (!emailBody.trim()) return "Enter an email body";
      if (emailTargets.length === 0) return "No selected recipients have email addresses";
    }
    return null;
  };

  const handleSend = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setIsSending(true);
    setWaProgress({ sent: 0, total: sendWA ? waTargets.length : 0 });
    setEmailProgress({ sent: 0, total: sendEmail ? emailTargets.length : 0 });

    let waOk = 0, waFail = 0;
    let emOk = 0, emFail = 0;

    try {
      if (sendWA) {
        for (let i = 0; i < waTargets.length; i++) {
          const r = waTargets[i];
          try {
            const body: Record<string, unknown> = { phone: r.phone };
            if (waMode === "text") {
              body.message = waMessage.trim();
            } else {
              body.templateName = selectedTemplateName;
              body.langCode = selectedTemplate?.language || "en";
              body.parameters = selectedTemplateParams.map((idx) => ({
                parameter_name: idx,
                text: templateParams[idx] || "N/A",
              }));
            }
            const { error } = await supabase.functions.invoke("send-announcement-whatsapp", { body });
            if (error) throw error;
            waOk++;
          } catch (e) {
            waFail++;
            console.error("Bulk WA failed for", r.name, e);
          }
          setWaProgress({ sent: i + 1, total: waTargets.length });
          if (i < waTargets.length - 1) await new Promise((res) => setTimeout(res, 500));
        }
      }
      if (sendEmail) {
        const brandedHtml = wrapAnnouncementEmail(emailBody, subject);
        const text = buildPlainText(emailBody);
        for (let i = 0; i < emailTargets.length; i++) {
          const r = emailTargets[i];
          try {
            const { error } = await supabase.functions.invoke("send-email", {
              body: { to: r.email, subject, html: brandedHtml, text },
            });
            if (error) throw error;
            emOk++;
          } catch (e) {
            emFail++;
            console.error("Bulk email failed for", r.name, e);
          }
          setEmailProgress({ sent: i + 1, total: emailTargets.length });
          if (i < emailTargets.length - 1) await new Promise((res) => setTimeout(res, 300));
        }
      }

      const parts: string[] = [];
      if (sendWA) parts.push(`WhatsApp ${waOk}/${waTargets.length} sent${waFail ? `, ${waFail} failed` : ""}`);
      if (sendEmail) parts.push(`Email ${emOk}/${emailTargets.length} sent${emFail ? `, ${emFail} failed` : ""}`);
      const summary = parts.join(" · ");
      if (!waFail && !emFail) toast.success(summary);
      else toast.warning(summary);
    } finally {
      setIsSending(false);
    }
  };

  const uniqueWa = waTargets.length;
  const uniqueEmail = emailTargets.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Bulk Message Customers
          </DialogTitle>
          <DialogDescription>
            Send a custom WhatsApp and/or email to the customers on this route. Great for delay or cancellation alerts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient list */}
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="text-sm font-medium">
                Recipients ({chosen.length}/{recipients.length})
              </div>
              <div className="flex gap-2 text-xs">
                <Button type="button" variant="ghost" size="sm" onClick={selectAllActive}>Select active</Button>
                <Button type="button" variant="ghost" size="sm" onClick={selectNone}>Select none</Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mb-2">
              Unique WhatsApp: <span className="font-medium">{uniqueWa}</span> · Unique Email: <span className="font-medium">{uniqueEmail}</span>
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1">
              {recipients.map((r) => (
                <label
                  key={r.key}
                  className={`flex items-start gap-2 p-2 rounded border text-xs ${r.isCompleted ? "opacity-60 bg-muted/40" : ""}`}
                >
                  <Checkbox
                    checked={selected.has(r.key)}
                    onCheckedChange={() => toggle(r.key)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium truncate">{r.name}</span>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {r.type === "collection" ? "Collect" : "Deliver"}
                      </Badge>
                      {r.isCompleted && (
                        <Badge className="text-[10px] px-1 py-0 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                          {r.completedReason}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground truncate">
                      {r.phone || "no phone"} · {r.email || "no email"}
                    </div>
                  </div>
                </label>
              ))}
              {recipients.length === 0 && (
                <div className="text-xs text-muted-foreground p-2">No jobs in this route.</div>
              )}
            </div>
          </Card>

          {/* Channel toggles */}
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch checked={sendWA} onCheckedChange={setSendWA} id="ch-wa" />
              <Label htmlFor="ch-wa" className="flex items-center gap-1 text-sm">
                <MessageSquare className="h-3.5 w-3.5" /> Send WhatsApp
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={sendEmail} onCheckedChange={setSendEmail} id="ch-em" />
              <Label htmlFor="ch-em" className="flex items-center gap-1 text-sm">
                <Mail className="h-3.5 w-3.5" /> Send Email
              </Label>
            </div>
          </div>

          {/* WhatsApp composer */}
          {sendWA && (
            <Card className="p-3 space-y-2">
              <div className="text-sm font-semibold flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" /> WhatsApp
              </div>
              <Tabs value={waMode} onValueChange={(v) => setWaMode(v as "text" | "template")}>
                <TabsList>
                  <TabsTrigger value="text">Plain Text</TabsTrigger>
                  <TabsTrigger value="template">Template</TabsTrigger>
                </TabsList>
                <TabsContent value="text" className="mt-3 space-y-1">
                  <Label className="text-xs">Message</Label>
                  <Textarea
                    value={waMessage}
                    onChange={(e) => setWaMessage(e.target.value)}
                    placeholder="Hi {name}, unfortunately your delivery is delayed…"
                    className="min-h-[120px] text-sm"
                    maxLength={4096}
                  />
                  <p className="text-[11px] text-muted-foreground text-right">
                    {waMessage.length} / 4,096
                  </p>
                </TabsContent>
                <TabsContent value="template" className="mt-3 space-y-3">
                  <div>
                    <Label className="text-xs">Template</Label>
                    <Select
                      value={selectedTemplateName}
                      onValueChange={(v) => {
                        setSelectedTemplateName(v);
                        setTemplateParams({});
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={templatesLoading ? "Loading templates..." : "Choose a template"} />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.name} value={t.name}>
                            {t.name} ({t.language})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedTemplate && (
                    <>
                      <div className="bg-muted/50 rounded-md p-2">
                        <p className="text-[11px] font-medium text-muted-foreground mb-1">Preview</p>
                        <p className="text-xs whitespace-pre-wrap">{getTemplateBodyText(selectedTemplate)}</p>
                      </div>
                      {selectedTemplateParams.length > 0 && (
                        <div className="space-y-2">
                          {selectedTemplateParams.map((idx) => (
                            <div key={idx}>
                              <Label className="text-[11px] text-muted-foreground">{"{{" + idx + "}}"}</Label>
                              <Input
                                value={templateParams[idx] || ""}
                                onChange={(e) =>
                                  setTemplateParams((p) => ({ ...p, [idx]: e.target.value }))
                                }
                                placeholder={`Value for parameter ${idx}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </Card>
          )}

          {/* Email composer */}
          {sendEmail && (
            <Card className="p-3 space-y-2">
              <div className="text-sm font-semibold flex items-center gap-1.5">
                <Mail className="h-4 w-4" /> Email
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Update about your booking" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Message</Label>
                <Textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Hello, we wanted to let you know…"
                  className="min-h-[140px] text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Cycle Courier branded header, footer and contact info are applied automatically on send.
                </p>
              </div>
            </Card>
          )}

          {/* Progress */}
          {isSending && (
            <div className="space-y-2">
              {sendWA && waProgress.total > 0 && (
                <div>
                  <Progress value={(waProgress.sent / waProgress.total) * 100} />
                  <p className="text-xs text-center text-muted-foreground mt-1">
                    WhatsApp {waProgress.sent} / {waProgress.total}
                  </p>
                </div>
              )}
              {sendEmail && emailProgress.total > 0 && (
                <div>
                  <Progress value={(emailProgress.sent / emailProgress.total) * 100} />
                  <p className="text-xs text-center text-muted-foreground mt-1">
                    Email {emailProgress.sent} / {emailProgress.total}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? "Sending..." : "Send Now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkRouteMessageDialog;
