import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Loader2, Trash2, Upload, ExternalLink, IdCard } from "lucide-react";
import type { UserProfile } from "@/types/user";

const BUCKET = "driver-licences";
const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

type SlotKey = "licence_front_path" | "licence_back_path" | "licence_check_code_path";

const SLOTS: { key: SlotKey; label: string; fileBase: string; allowPdf: boolean; hint: string }[] = [
  { key: "licence_front_path", label: "Licence front", fileBase: "front", allowPdf: false, hint: "Photo of the front of the photocard (JPG or PNG)" },
  { key: "licence_back_path", label: "Licence back", fileBase: "back", allowPdf: false, hint: "Photo of the back of the photocard (JPG or PNG)" },
  { key: "licence_check_code_path", label: "Check code document", fileBase: "check-code", allowPdf: true, hint: "DVLA check code summary (JPG, PNG or PDF)" },
];

export const daysUntil = (dateStr?: string | null): number | null => {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
};

interface DriverLicenceTabProps {
  userId: string;
  formData: Partial<UserProfile>;
  onChange: (updates: Partial<UserProfile>) => void;
}

const DriverLicenceTab: React.FC<DriverLicenceTabProps> = ({ userId, formData, onChange }) => {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<SlotKey | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const paths = SLOTS.map((s) => (formData as any)[s.key] as string | null | undefined).join("|");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next: Record<string, string> = {};
      for (const slot of SLOTS) {
        const path = (formData as any)[slot.key] as string | null | undefined;
        if (!path) continue;
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
        if (data?.signedUrl) next[slot.key] = data.signedUrl;
      }
      if (!cancelled) setPreviews(next);
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths, userId]);

  const handleFile = async (slot: typeof SLOTS[number], file: File) => {
    const allowed = slot.allowPdf ? [...IMAGE_TYPES, "application/pdf"] : IMAGE_TYPES;
    if (!allowed.includes(file.type)) {
      toast.error(slot.allowPdf ? "Please upload a JPG, PNG or PDF" : "Please upload a JPG or PNG image");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File must be 10MB or smaller");
      return;
    }

    setBusy(slot.key);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || (file.type === "application/pdf" ? "pdf" : "jpg");
      const path = `${userId}/${slot.fileBase}.${ext}`;

      const existing = (formData as any)[slot.key] as string | null | undefined;
      if (existing && existing !== path) {
        await supabase.storage.from(BUCKET).remove([existing]);
      }

      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });
      if (error) throw error;

      onChange({ [slot.key]: path, licence_updated_at: new Date().toISOString() } as Partial<UserProfile>);
      toast.success(`${slot.label} uploaded — remember to save`);
    } catch (err: any) {
      console.error("Licence upload failed:", err);
      toast.error(err?.message || "Upload failed. Try again in a moment.");
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (slot: typeof SLOTS[number]) => {
    const existing = (formData as any)[slot.key] as string | null | undefined;
    setBusy(slot.key);
    try {
      if (existing) await supabase.storage.from(BUCKET).remove([existing]);
      onChange({ [slot.key]: null, licence_updated_at: new Date().toISOString() } as Partial<UserProfile>);
      setPreviews((p) => {
        const next = { ...p };
        delete next[slot.key];
        return next;
      });
      toast.success(`${slot.label} removed — remember to save`);
    } catch (err: any) {
      toast.error(err?.message || "Couldn't remove that file");
    } finally {
      setBusy(null);
    }
  };

  const days = daysUntil(formData.licence_expiry as any);
  const expiryBadge =
    days === null ? null : days < 0 ? (
      <Badge variant="destructive">Expired</Badge>
    ) : days <= 60 ? (
      <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-500">Expires in {days} day{days === 1 ? "" : "s"}</Badge>
    ) : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-licence-number">Licence Number</Label>
          <Input
            id="edit-licence-number"
            value={(formData.licence_number as any) || ""}
            maxLength={32}
            placeholder="e.g. SMITH901234AB9CD"
            onChange={(e) => onChange({ licence_number: e.target.value.toUpperCase() || null } as Partial<UserProfile>)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-licence-expiry" className="flex items-center gap-2">
            Licence Expiry {expiryBadge}
          </Label>
          <Input
            id="edit-licence-expiry"
            type="date"
            value={(formData.licence_expiry as any) || ""}
            onChange={(e) => onChange({ licence_expiry: e.target.value || null } as Partial<UserProfile>)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {SLOTS.map((slot) => {
          const path = (formData as any)[slot.key] as string | null | undefined;
          const url = previews[slot.key];
          const isPdf = !!path && path.toLowerCase().endsWith(".pdf");
          const isBusy = busy === slot.key;

          return (
            <div key={slot.key} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <IdCard className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{slot.label}</span>
              </div>

              <div className="aspect-[3/2] w-full rounded bg-muted/40 border overflow-hidden flex items-center justify-center">
                {isBusy ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : path && isPdf ? (
                  <FileText className="h-8 w-8 text-muted-foreground" />
                ) : url ? (
                  <img src={url} alt={`${slot.label} document`} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <span className="text-xs text-muted-foreground px-2 text-center">Not uploaded</span>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground leading-snug">{slot.hint}</p>

              <input
                ref={(el) => { inputRefs.current[slot.key] = el; }}
                type="file"
                accept={slot.allowPdf ? "image/jpeg,image/png,image/webp,application/pdf" : "image/jpeg,image/png,image/webp"}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) handleFile(slot, file);
                }}
              />

              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => inputRefs.current[slot.key]?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  {path ? "Replace" : "Upload"}
                </Button>
                {path && url && (
                  <Button type="button" size="sm" variant="outline" asChild>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      View
                      <ExternalLink className="h-3.5 w-3.5 ml-1" />
                    </a>
                  </Button>
                )}
                {path && (
                  <Button type="button" size="sm" variant="ghost" disabled={isBusy} onClick={() => handleRemove(slot)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {formData.licence_updated_at && (
        <p className="text-xs text-muted-foreground">
          Documents last changed {new Date(formData.licence_updated_at as any).toLocaleString("en-GB")}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        These files are stored privately and are only visible to admins.
      </p>
    </div>
  );
};

export default DriverLicenceTab;
