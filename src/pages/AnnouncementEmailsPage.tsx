import * as Sentry from "@sentry/react";
import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Mail, Send, Eye, EyeOff, Search, X, MessageSquare } from "lucide-react";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import type { UserRole } from "@/types/user";

interface ProfileRecord {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  company_name: string | null;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  b2b_customer: "B2B Customer",
  b2c_customer: "B2C Customer",
  driver: "Driver",
  loader: "Loader",
  mechanic: "Mechanic",
  route_planner: "Route Planner",
  sales: "Sales",
};

const AnnouncementEmailsPage: React.FC = () => {
  const [recipientMode, setRecipientMode] = useState<"individual" | "role">("individual");
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Set<UserRole>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  // Email state
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailProgress, setEmailProgress] = useState({ sent: 0, total: 0 });
  // WhatsApp state
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [whatsappProgress, setWhatsappProgress] = useState({ sent: 0, total: 0 });

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["profiles-for-emails"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, phone, role, company_name")
        .eq("account_status", "approved")
        .not("email", "is", null)
        .order("name");
      if (error) throw error;
      return (data || []) as ProfileRecord[];
    },
  });

  const filteredProfiles = useMemo(() => {
    if (!searchQuery) return profiles;
    const q = searchQuery.toLowerCase();
    return profiles.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.company_name?.toLowerCase().includes(q)
    );
  }, [profiles, searchQuery]);

  const recipients = useMemo(() => {
    const emailMap = new Map<string, ProfileRecord>();
    if (recipientMode === "individual") {
      profiles
        .filter((p) => selectedProfileIds.has(p.id) && p.email)
        .forEach((p) => emailMap.set(p.email!.toLowerCase(), p));
    } else {
      profiles
        .filter((p) => selectedRoles.has(p.role) && p.email)
        .forEach((p) => emailMap.set(p.email!.toLowerCase(), p));
    }
    return Array.from(emailMap.values());
  }, [recipientMode, selectedProfileIds, selectedRoles, profiles]);

  const recipientsWithPhone = useMemo(
    () => recipients.filter((r) => r.phone && r.phone.trim().length >= 5),
    [recipients]
  );

  const toggleProfile = (id: string) => {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleRole = (role: UserRole) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      next.has(role) ? next.delete(role) : next.add(role);
      return next;
    });
  };

  const handleSendEmail = async () => {
    if (!subject.trim()) { toast.error("Please enter a subject line"); return; }
    if (!htmlBody.trim()) { toast.error("Please enter email content"); return; }
    if (recipients.length === 0) { toast.error("Please select at least one recipient"); return; }

    setIsSendingEmail(true);
    setEmailProgress({ sent: 0, total: recipients.length });
    let successCount = 0;
    let failCount = 0;

    await Sentry.startSpan(
      { op: "email.send_announcement", name: "Send Announcement Emails" },
      async (span) => {
        span.setAttribute("recipient_count", recipients.length);
        for (let i = 0; i < recipients.length; i++) {
          const recipient = recipients[i];
          try {
            const { error } = await supabase.functions.invoke("send-email", {
              body: { to: recipient.email, subject, html: htmlBody, text: htmlBody.replace(/<[^>]*>/g, "") },
            });
            if (error) throw error;
            successCount++;
          } catch (err) {
            failCount++;
            Sentry.captureException(err);
          }
          setEmailProgress({ sent: i + 1, total: recipients.length });
          if (i < recipients.length - 1) await new Promise((r) => setTimeout(r, 300));
        }
      }
    );

    setIsSendingEmail(false);
    if (failCount === 0) toast.success(`Successfully sent ${successCount} email(s)`);
    else toast.warning(`Sent ${successCount}, failed ${failCount} email(s)`);
  };

  const handleSendWhatsApp = async () => {
    if (!whatsappMessage.trim()) { toast.error("Please enter a WhatsApp message"); return; }
    if (recipientsWithPhone.length === 0) { toast.error("No selected recipients have phone numbers"); return; }

    setIsSendingWhatsApp(true);
    setWhatsappProgress({ sent: 0, total: recipientsWithPhone.length });
    let successCount = 0;
    let failCount = 0;

    await Sentry.startSpan(
      { op: "whatsapp.send_announcement", name: "Send Announcement WhatsApp" },
      async (span) => {
        span.setAttribute("recipient_count", recipientsWithPhone.length);
        for (let i = 0; i < recipientsWithPhone.length; i++) {
          const recipient = recipientsWithPhone[i];
          try {
            const { error } = await supabase.functions.invoke("send-announcement-whatsapp", {
              body: { phone: recipient.phone, message: whatsappMessage.trim() },
            });
            if (error) throw error;
            successCount++;
          } catch (err) {
            failCount++;
            Sentry.captureException(err);
          }
          setWhatsappProgress({ sent: i + 1, total: recipientsWithPhone.length });
          if (i < recipientsWithPhone.length - 1) await new Promise((r) => setTimeout(r, 500));
        }
      }
    );

    setIsSendingWhatsApp(false);
    if (failCount === 0) toast.success(`Successfully sent ${successCount} WhatsApp message(s)`);
    else toast.warning(`Sent ${successCount}, failed ${failCount} WhatsApp message(s)`);
  };

  const isSending = isSendingEmail || isSendingWhatsApp;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Mail className="h-6 w-6 text-primary" />
          <MessageSquare className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
        </div>

        {/* Recipients */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Recipients</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={recipientMode} onValueChange={(v) => setRecipientMode(v as any)}>
              <TabsList className="mb-4">
                <TabsTrigger value="individual">Individual</TabsTrigger>
                <TabsTrigger value="role">By Role</TabsTrigger>
              </TabsList>

              <TabsContent value="individual">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or company..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {selectedProfileIds.size > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {profiles
                      .filter((p) => selectedProfileIds.has(p.id))
                      .map((p) => (
                        <Badge key={p.id} variant="secondary" className="cursor-pointer" onClick={() => toggleProfile(p.id)}>
                          {p.name || p.email} ✕
                        </Badge>
                      ))}
                  </div>
                )}

                <div className="max-h-60 overflow-y-auto border rounded-md divide-y divide-border">
                  {isLoading ? (
                    <p className="p-3 text-sm text-muted-foreground">Loading profiles...</p>
                  ) : filteredProfiles.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No matching profiles</p>
                  ) : (
                    filteredProfiles.map((p) => (
                      <label key={p.id} className="flex items-center gap-3 px-3 py-2 hover:bg-accent/50 cursor-pointer">
                        <Checkbox checked={selectedProfileIds.has(p.id)} onCheckedChange={() => toggleProfile(p.id)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {p.name || "Unnamed"}{" "}
                            {p.company_name && <span className="text-muted-foreground">({p.company_name})</span>}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{ROLE_LABELS[p.role]}</Badge>
                      </label>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="role">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => {
                    const count = profiles.filter((p) => p.role === role).length;
                    return (
                      <label key={role} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={selectedRoles.has(role)} onCheckedChange={() => toggleRole(role)} />
                        <span className="text-sm text-foreground">
                          {ROLE_LABELS[role]} <span className="text-muted-foreground">({count})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex flex-col gap-1 mt-3">
              <p className="text-sm text-muted-foreground">
                {recipients.length} unique recipient{recipients.length !== 1 ? "s" : ""} selected
              </p>
              <p className="text-xs text-muted-foreground">
                {recipientsWithPhone.length} of {recipients.length} have phone numbers for WhatsApp
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Compose Email */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" /> Compose Email
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" placeholder="Email subject line..." value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="body">Body (HTML)</Label>
                <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}>
                  {showPreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                  {showPreview ? "Edit" : "Preview"}
                </Button>
              </div>
              {showPreview ? (
                <div className="border rounded-md p-4 min-h-[200px] prose prose-sm max-w-none bg-background" dangerouslySetInnerHTML={{ __html: htmlBody }} />
              ) : (
                <Textarea id="body" placeholder='<p>Hello,</p><p>We have exciting news...</p>' value={htmlBody} onChange={(e) => setHtmlBody(e.target.value)} className="min-h-[200px] font-mono text-sm" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Compose WhatsApp */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Compose WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="whatsapp-message">Message (plain text)</Label>
              <Textarea
                id="whatsapp-message"
                placeholder="Hello! We wanted to let you know..."
                value={whatsappMessage}
                onChange={(e) => setWhatsappMessage(e.target.value)}
                className="min-h-[150px] text-sm"
                maxLength={4096}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {whatsappMessage.length} / 4,096 characters
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Progress bars */}
        {isSendingEmail && (
          <div className="mb-4 space-y-2">
            <Progress value={(emailProgress.sent / emailProgress.total) * 100} />
            <p className="text-sm text-muted-foreground text-center">
              Sending emails {emailProgress.sent} / {emailProgress.total}...
            </p>
          </div>
        )}
        {isSendingWhatsApp && (
          <div className="mb-4 space-y-2">
            <Progress value={(whatsappProgress.sent / whatsappProgress.total) * 100} />
            <p className="text-sm text-muted-foreground text-center">
              Sending WhatsApp {whatsappProgress.sent} / {whatsappProgress.total}...
            </p>
          </div>
        )}

        {/* Send buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            onClick={handleSendEmail}
            disabled={isSending || recipients.length === 0 || !subject.trim() || !htmlBody.trim()}
            size="lg"
          >
            <Mail className="h-4 w-4 mr-2" />
            {isSendingEmail ? "Sending..." : `Send Email (${recipients.length})`}
          </Button>
          <Button
            onClick={handleSendWhatsApp}
            disabled={isSending || recipientsWithPhone.length === 0 || !whatsappMessage.trim()}
            size="lg"
            variant="outline"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            {isSendingWhatsApp ? "Sending..." : `Send WhatsApp (${recipientsWithPhone.length})`}
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default AnnouncementEmailsPage;
