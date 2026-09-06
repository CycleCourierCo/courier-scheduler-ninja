import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileText, IdCard, Trash2, Upload } from "lucide-react";

export const LICENCE_BUCKET = "driver-licences";
const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export type LicenceSlotKey = "licence_front_path" | "licence_back_path" | "licence_check_code_path";

export const LICENCE_SLOTS: {
  key: LicenceSlotKey;
  label: string;
  fileBase: string;
  allowPdf: boolean;
  hint: string;
}[] = [
  { key: "licence_front_path", label: "Licence front", fileBase: "front", allowPdf: false, hint: "Photo of the front of the photocard (JPG or PNG)" },
  { key: "licence_back_path", label: "Licence back", fileBase: "back", allowPdf: false, hint: "Photo of the back of the photocard (JPG or PNG)" },
  { key: "licence_check_code_path", label: "Check code document", fileBase: "check-code", allowPdf: true, hint: "DVLA check code summary (JPG, PNG or PDF)" },
];

export type PendingLicenceFiles = Partial<Record<LicenceSlotKey, File>>;

interface PendingLicenceUploadsProps {
  files: PendingLicenceFiles;
  onChange: (files: PendingLicenceFiles) => void;
}

/**
 * File pickers for a driver who doesn't exist yet — files are held in memory
 * and uploaded once the account has been created.
 */
const PendingLicenceUploads: React.FC<PendingLicenceUploadsProps> = ({ files, onChange }) => {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const pick = (slot: typeof LICENCE_SLOTS[number], file: File) => {
    const allowed = slot.allowPdf ? [...IMAGE_TYPES, "application/pdf"] : IMAGE_TYPES;
    if (!allowed.includes(file.type)) {
      toast.error(slot.allowPdf ? "Please choose a JPG, PNG or PDF" : "Please choose a JPG or PNG image");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File must be 10MB or smaller");
      return;
    }
    onChange({ ...files, [slot.key]: file });
  };

  const remove = (slot: typeof LICENCE_SLOTS[number]) => {
    const next = { ...files };
    delete next[slot.key];
    onChange(next);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {LICENCE_SLOTS.map((slot) => {
        const file = files[slot.key];
        const isPdf = !!file && file.type === "application/pdf";
        const previewUrl = file && !isPdf ? URL.createObjectURL(file) : null;

        return (
          <div key={slot.key} className="rounded-md border p-3 space-y-2 min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IdCard className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{slot.label}</span>
            </div>

            <div className="aspect-[3/2] w-full rounded bg-muted/40 border overflow-hidden flex items-center justify-center">
              {isPdf ? (
                <FileText className="h-8 w-8 text-muted-foreground" />
              ) : previewUrl ? (
                <img src={previewUrl} alt={`${slot.label} preview`} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-muted-foreground px-2 text-center">Not chosen</span>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground leading-snug">{slot.hint}</p>

            <input
              ref={(el) => { inputRefs.current[slot.key] = el; }}
              type="file"
              accept={slot.allowPdf ? "image/jpeg,image/png,image/webp,application/pdf" : "image/jpeg,image/png,image/webp"}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) pick(slot, f);
              }}
            />

            <div className="flex flex-wrap gap-1.5">
              <Button type="button" size="sm" variant="outline" onClick={() => inputRefs.current[slot.key]?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" />
                {file ? "Change" : "Choose"}
              </Button>
              {file && (
                <Button type="button" size="sm" variant="ghost" onClick={() => remove(slot)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PendingLicenceUploads;
